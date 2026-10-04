import fs from 'node:fs';
import path from 'node:path';
import { fmtBytes, fmtDuration, isBinary, realHome } from './util.js';
import { splitLines, unifiedDiff } from './diff.js';
import { projectBefore } from './session.js';

const SYMBOL = { added: '+', modified: '~', deleted: '-', mode: 'x', git: '~' };

function shortRoot(p) {
  const h = realHome();
  return p === h || p.startsWith(`${h}/`) ? `~${p.slice(h.length)}` : p;
}

function detail(e, c) {
  const parts = [];
  if (e.files > 1) parts.push(`${e.files} files, ${fmtBytes(e.bytes)}`);
  else if (e.kind === 'added') {
    const ch = e.changes[0];
    if (ch.type === 'symlink') parts.push(`-> ${ch.link}`);
    else parts.push(ch.add != null ? `+${ch.add}` : fmtBytes(ch.size || 0));
    if (ch.executable) parts.push('executable');
  } else if (e.kind === 'modified') {
    const ch = e.changes[0];
    if (ch.binary) parts.push('binary');
    else if (ch.type === 'symlink') parts.push(`-> ${ch.link}`);
    else parts.push(`+${ch.add ?? 0} -${ch.del ?? 0}`);
  } else if (e.kind === 'deleted') {
    const ch = e.changes[0];
    parts.push(ch.del != null ? `-${ch.del}` : fmtBytes(ch.size || 0));
  } else if (e.kind === 'mode') parts.push('permissions');
  return parts.join(', ') && c.dim(parts.join(', '));
}

function section(title, subtitle, area, entries, c, { showIds }) {
  const lines = [];
  lines.push(`${c.bold(title)}  ${c.dim(subtitle)}`);
  if (entries.length === 0) {
    lines.push(c.dim('  (no changes)'));
    return lines;
  }
  const prefix = (e) => (area === 'home' ? `~/${e.label}` : e.label);
  const width = Math.min(52, Math.max(...entries.map((e) => prefix(e).length)));
  for (const e of entries) {
    const sym = SYMBOL[e.kind];
    const color = e.kind === 'added' ? c.green : e.kind === 'deleted' ? c.red : c.yellow;
    const id = showIds ? c.dim(`${String(e.id).padStart(2)} `) : '';
    const label = prefix(e);
    const warn = e.flags.length ? `  ${c.red('! ' + e.flags.join(', '))}` : '';
    lines.push(`  ${id}${color(sym)} ${label.padEnd(width)}  ${detail(e, c)}${warn}`);
  }
  return lines;
}

export function renderReport(report, c, { showIds = false } = {}) {
  const out = [];
  const status = report.exitCode === 0 ? c.green('exit 0') : c.red(`exit ${report.exitCode}`);
  out.push(`${c.bold('dressrun')} ${c.cyan(report.command)}`);
  out.push(c.dim(`rehearsal ${report.id} · `) + status + c.dim(` · ${fmtDuration(report.durationMs)}`));
  out.push('');
  out.push(...section('PROJECT', shortRoot(report.root), 'project', report.project.entries, c, { showIds }));
  out.push('');
  if (report.home) {
    out.push(
      ...section('HOME', 'fake ~ for this run; your real home is untouched', 'home', report.home.entries, c, {
        showIds: false,
      }),
    );
  } else {
    out.push(`${c.bold('HOME')}  ${c.dim('real home was used (--home real); changes there are not tracked')}`);
  }
  out.push('');
  const pf = report.project.entries.reduce((n, e) => n + e.files, 0);
  const hf = report.home ? report.home.entries.reduce((n, e) => n + e.files, 0) : 0;
  const flagged = [...report.project.entries, ...(report.home?.entries || [])].filter((e) => e.flags.length).length;
  out.push(
    c.dim(`${pf} project file${pf === 1 ? '' : 's'} changed · ${hf} home file${hf === 1 ? '' : 's'} written`) +
      (flagged ? c.red(` · ${flagged} flagged`) : ''),
  );
  return out.join('\n');
}

/** Render unified diffs (project side) for the given entries. */
export function renderDiffs(session, entries, c, area = 'project') {
  const { meta, paths, baseline } = session;
  const out = [];
  const before =
    area === 'project'
      ? projectBefore(meta.root, new Map(Object.entries(baseline.source)))
      : (rel) => {
          try {
            return meta.seeded.includes(rel) ? fs.readFileSync(path.join(meta.realHome, rel)) : null;
          } catch {
            return null;
          }
        };
  const afterRoot = area === 'project' ? paths.work : paths.home;
  for (const e of entries) {
    for (const ch of e.changes) {
      if (e.kind === 'git' || ch.type === 'symlink') continue;
      const a = ch.kind === 'added' ? Buffer.alloc(0) : before(ch.path);
      let b = Buffer.alloc(0);
      if (ch.kind !== 'deleted') {
        try {
          b = fs.readFileSync(path.join(afterRoot, ch.path));
        } catch {
          continue;
        }
      }
      out.push(c.bold(`${ch.kind === 'added' ? 'new file' : ch.kind === 'deleted' ? 'deleted' : 'modified'}: ${area === 'home' ? '~/' : ''}${ch.path}`));
      if (!a || isBinary(a) || isBinary(b) || a.length > 2e6 || b.length > 2e6) {
        out.push(c.dim('  (binary or large file; no line diff)'), '');
        continue;
      }
      const text = unifiedDiff(splitLines(a.toString('utf8')), splitLines(b.toString('utf8')), {
        from: `a/${ch.path}`,
        to: `b/${ch.path}`,
      });
      const lines = text.split('\n').slice(2);
      for (const l of lines.slice(0, 80)) {
        out.push(l.startsWith('+') ? c.green(l) : l.startsWith('-') ? c.red(l) : l.startsWith('@@') ? c.cyan(l) : l);
      }
      if (lines.length > 80) out.push(c.dim(`  ... ${lines.length - 80} more diff lines`));
      out.push('');
    }
  }
  return out.join('\n');
}
