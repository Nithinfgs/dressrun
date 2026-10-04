import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UsageError } from './util.js';
import { colorEnabled, makeColors } from './color.js';
import { applyEntries, selectEntries } from './apply.js';
import { ask, parseSelection } from './prompt.js';
import { renderDiffs, renderReport } from './render.js';
import { deleteSession, listSessions, loadSession, rehearse, resolveSession } from './session.js';

const DEFAULT_SEEDS = ['.gitconfig', '.zshrc', '.zprofile', '.zshenv', '.bashrc', '.bash_profile', '.profile'];
const COMMANDS = new Set(['ls', 'show', 'apply', 'discard', 'help', 'version']);

const HELP = `dressrun - rehearse a command, review what it changed, then apply or discard.

Usage
  dressrun [options] -- <command> [args...]
  dressrun [options] -c "<shell string>"
  dressrun ls                      list kept rehearsals
  dressrun show [id] [--diff]      re-display a rehearsal's report
  dressrun apply [id] [options]    apply a kept rehearsal to your real tree
  dressrun discard [id | --all]    delete kept rehearsals

Run options
  --root <dir>        directory to clone (default: current directory)
  --exclude <path>    skip a path inside the root (repeatable), e.g. node_modules
  --max-size <MB>     refuse to clone more than this (default 1024)
  --home fake|real    fake: sandboxed ~ (default); real: use your real home, untracked
  --seed <path>       file copied from real ~ into the fake one (repeatable; replaces the defaults:
                      .gitconfig and shell startup files, so appends show up as diffs)
  --apply             apply project changes without asking when the command exits 0
  --discard           discard without asking (inspection only)
  --keep              keep the rehearsal for later; do not ask
  --diff              print unified diffs with the report
  --json              print the report as JSON on stdout (command stdout goes to stderr)
  --no-color

Apply options
  --home              also apply files written to the fake home (paths are rewritten to your real ~)
  --only <glob>       only apply matching paths (repeatable)
  --force             overwrite files that changed in your real tree since the rehearsal
  --keep              keep the rehearsal after applying

Exit codes: the command's own exit code; 64 usage error; 70 internal error; 3 apply had conflicts.
dressrun is a preview tool, not a security sandbox: the command still has network access and
can write outside the project and fake home via absolute paths.
`;

function parseArgs(argv) {
  const o = { exclude: [], seed: [], only: [], positional: [], flags: new Set(), values: {} };
  let i = 0;
  const needValue = (name) => {
    if (i + 1 >= argv.length) throw new UsageError(`${name} needs a value`);
    return argv[++i];
  };
  for (; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      o.command = argv.slice(i + 1);
      break;
    }
    if (a === '-c') {
      o.shell = needValue('-c');
      continue;
    }
    if (a === '--exclude') o.exclude.push(needValue(a));
    else if (a === '--seed') o.seed.push(needValue(a));
    else if (a === '--only') o.only.push(needValue(a));
    else if (a === '--root') o.values.root = needValue(a);
    else if (a === '--max-size') o.values.maxSize = Number(needValue(a));
    else if (a === '--home') {
      // `--home fake|real` for runs; bare `--home` for apply
      const next = argv[i + 1];
      if (next === 'fake' || next === 'real') {
        o.values.home = next;
        i++;
      } else o.flags.add('home');
    } else if (a.startsWith('--')) o.flags.add(a.slice(2));
    else if (a === '-h') o.flags.add('help');
    else o.positional.push(a);
  }
  return o;
}

function say(s = '') {
  process.stderr.write(`${s}\n`);
}

function summarize(results, c) {
  const counts = { applied: 0, conflict: 0, error: 0 };
  for (const r of results) {
    counts[r.status]++;
    if (r.status !== 'applied') {
      say(`  ${r.status === 'conflict' ? c.yellow('skipped') : c.red('error')} ${r.area === 'home' ? '~/' : ''}${r.path}: ${r.note}`);
    }
  }
  say(
    `${c.bold('applied')} ${counts.applied} file${counts.applied === 1 ? '' : 's'}` +
      (counts.conflict ? c.yellow(` · ${counts.conflict} skipped (conflicts; use --force to overwrite)`) : '') +
      (counts.error ? c.red(` · ${counts.error} errors`) : ''),
  );
  return counts;
}

/** @param {{withHome?: boolean, only?: string[], force?: boolean, ids?: number[], c: any}} opts */
function doApply(session, opts) {
  const { withHome = false, only, force = false, ids, c } = opts;
  const report = session.report;
  const results = applyEntries({
    session,
    area: 'project',
    entries: selectEntries(report.project.entries, { only, ids }),
    force,
  });
  if (withHome && report.home) {
    results.push(
      ...applyEntries({ session, area: 'home', entries: selectEntries(report.home.entries, { only }), force }),
    );
  }
  const counts = summarize(results, c);
  return counts.conflict || counts.error ? 3 : 0;
}

export function choicesLine(hasHome) {
  return `[a]pply project${hasHome ? ' · apply [h]ome too' : ''} · [d]iff · [s]elect · [k]eep · [n] discard`;
}

async function interactive(session, c, errC) {
  const report = session.report;
  const hasHome = report.home && report.home.entries.length > 0;
  for (;;) {
    const ans = await ask(`${errC.dim(choicesLine(hasHome))}\n> `);
    if (ans === 'a' || ans === 'h') {
      const code = doApply(session, { withHome: ans === 'h', c: errC });
      deleteSession(session.id);
      return code;
    }
    if (ans === 'd') {
      say(renderDiffs(session, report.project.entries, c));
      if (hasHome) say(renderDiffs(session, report.home.entries, c, 'home'));
    } else if (ans === 's') {
      const sel = parseSelection(await ask('entries to apply (e.g. 1,3-4): '));
      if (!sel || sel.length === 0) say('no valid selection');
      else {
        const code = doApply(session, { ids: sel, c: errC });
        deleteSession(session.id);
        return code;
      }
    } else if (ans === 'k') {
      say(`kept: dressrun show ${session.id} · dressrun apply ${session.id}`);
      return 0;
    } else if (ans === 'n' || ans === '') {
      deleteSession(session.id);
      say('discarded; your project and home are untouched');
      return 0;
    }
  }
}

async function cmdRun(o) {
  let argv;
  let display;
  if (o.shell != null) {
    argv = ['sh', '-c', o.shell];
    display = o.shell;
  } else if (o.command && o.command.length) {
    argv = o.command;
    display = o.command.join(' ');
  } else {
    throw new UsageError('missing command: dressrun [options] -- <command>   (see dressrun help)');
  }
  const json = o.flags.has('json');
  const c = makeColors(colorEnabled(process.stderr, o.flags.has('no-color') ? false : undefined));
  const homeMode = o.values.home || 'fake';
  const { id, report } = rehearse({
    root: o.values.root || process.cwd(),
    cwd: process.cwd(),
    argv,
    display,
    exclude: o.exclude,
    maxSizeMB: o.values.maxSize || 1024,
    homeMode,
    seed: o.seed.length ? o.seed : DEFAULT_SEEDS,
    childStdio: json ? ['inherit', 2, 'inherit'] : 'inherit',
  });
  const session = loadSession(id);
  const wantDiff = o.flags.has('diff');
  const tty = process.stdin.isTTY && process.stderr.isTTY;
  const interactiveMode = tty && !json && !['apply', 'discard', 'keep'].some((f) => o.flags.has(f));

  if (json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    say();
    say(renderReport(report, c, { showIds: interactiveMode }));
    if (wantDiff) {
      say();
      say(renderDiffs(session, report.project.entries, c));
      if (report.home) say(renderDiffs(session, report.home.entries, c, 'home'));
    }
    say();
  }

  let code = report.exitCode;
  if (o.flags.has('discard')) {
    deleteSession(id);
  } else if (o.flags.has('apply')) {
    if (report.exitCode === 0) {
      const r = doApply(session, { withHome: false, c });
      deleteSession(id);
      if (r) code = r;
    } else {
      say(c.yellow('command failed; not applying. Rehearsal kept.'));
      say(`inspect: dressrun show ${id} --diff   apply anyway: dressrun apply ${id}`);
    }
  } else if (interactiveMode) {
    const r = await interactive(session, c, c);
    if (r) code = r;
  } else {
    say(`kept: dressrun show ${id} --diff · dressrun apply ${id} · dressrun discard ${id}`);
  }
  return code;
}

async function cmdShow(o) {
  const c = makeColors(colorEnabled(process.stderr, o.flags.has('no-color') ? false : undefined));
  const session = loadSession(resolveSession(o.positional[1]));
  if (!session.report) throw new UsageError('that rehearsal has no report');
  if (o.flags.has('json')) {
    process.stdout.write(`${JSON.stringify(session.report, null, 2)}\n`);
    return 0;
  }
  say(renderReport(session.report, c, { showIds: true }));
  if (o.flags.has('diff')) {
    say();
    say(renderDiffs(session, session.report.project.entries, c));
    if (session.report.home) say(renderDiffs(session, session.report.home.entries, c, 'home'));
  }
  return 0;
}

async function cmdApply(o) {
  const c = makeColors(colorEnabled(process.stderr, o.flags.has('no-color') ? false : undefined));
  const session = loadSession(resolveSession(o.positional[1]));
  if (!session.report) throw new UsageError('that rehearsal has no report');
  const code = doApply(session, {
    withHome: o.flags.has('home'),
    only: o.only,
    force: o.flags.has('force'),
    c,
  });
  if (!o.flags.has('keep') && code === 0) deleteSession(session.id);
  return code;
}

async function cmdDiscard(o) {
  if (o.flags.has('all')) {
    const all = listSessions();
    all.forEach((s) => deleteSession(s.id));
    say(`discarded ${all.length} rehearsal${all.length === 1 ? '' : 's'}`);
    return 0;
  }
  const id = resolveSession(o.positional[1]);
  deleteSession(id);
  say(`discarded ${id}`);
  return 0;
}

export async function main(argv) {
  const o = parseArgs(argv);
  const sub = o.positional[0];
  const hasCommand = o.command !== undefined || o.shell !== undefined;
  if (o.flags.has('help') || (!hasCommand && (sub === 'help' || argv.length === 0))) {
    process.stdout.write(HELP);
    return 0;
  }
  if (!hasCommand && sub === 'version') {
    const pkg = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'));
    process.stdout.write(`${pkg.version}\n`);
    return 0;
  }
  if (!hasCommand && COMMANDS.has(sub)) {
    if (sub === 'ls') {
      const all = listSessions();
      if (all.length === 0) say('no kept rehearsals');
      for (const s of all) say(`${s.id}  ${s.meta.command}  ${s.meta.root}`);
      return 0;
    }
    if (sub === 'show') return cmdShow(o);
    if (sub === 'apply') return cmdApply(o);
    return cmdDiscard(o);
  }
  if (!hasCommand && o.positional.length) {
    throw new UsageError(`unknown command "${sub}". To rehearse a command, put -- before it: dressrun -- ${o.positional.join(' ')}`);
  }
  return cmdRun(o);
}
