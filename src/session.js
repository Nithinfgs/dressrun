import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { walk, totalSize } from './walk.js';
import { cloneTree } from './clone.js';
import { computeChanges } from './changes.js';
import { groupChanges } from './group.js';
import { UsageError, realHome } from './util.js';

export function sessionsBase() {
  return process.env.DRESSRUN_DIR || path.join(os.tmpdir(), `dressrun-${process.getuid ? process.getuid() : 'user'}`);
}

export function sessionPaths(id) {
  const dir = path.join(sessionsBase(), id);
  return {
    dir,
    work: path.join(dir, 'work'),
    home: path.join(dir, 'home'),
    tmp: path.join(dir, 'tmp'),
    meta: path.join(dir, 'meta.json'),
    baseline: path.join(dir, 'baseline.json'),
    report: path.join(dir, 'report.json'),
  };
}

function newId() {
  const t = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `${t}-${randomBytes(2).toString('hex')}`;
}

export function listSessions() {
  const base = sessionsBase();
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base)
    .filter((n) => fs.existsSync(path.join(base, n, 'meta.json')))
    .sort()
    .reverse()
    .map((id) => ({ id, meta: JSON.parse(fs.readFileSync(sessionPaths(id).meta, 'utf8')) }));
}

export function resolveSession(idOrPrefix) {
  const all = listSessions();
  if (all.length === 0) throw new UsageError('no dressrun sessions found (run one with: dressrun -- <command>)');
  if (!idOrPrefix || idOrPrefix === 'last') return all[0].id;
  const hits = all.filter((s) => s.id.startsWith(idOrPrefix));
  if (hits.length === 0) throw new UsageError(`no session matches "${idOrPrefix}"`);
  if (hits.length > 1) throw new UsageError(`"${idOrPrefix}" is ambiguous (${hits.length} sessions match)`);
  return hits[0].id;
}

export function loadSession(id) {
  const p = sessionPaths(id);
  return {
    id,
    paths: p,
    meta: JSON.parse(fs.readFileSync(p.meta, 'utf8')),
    baseline: JSON.parse(fs.readFileSync(p.baseline, 'utf8')),
    report: fs.existsSync(p.report) ? JSON.parse(fs.readFileSync(p.report, 'utf8')) : null,
  };
}

export function deleteSession(id) {
  fs.rmSync(sessionPaths(id).dir, { recursive: true, force: true });
}

const toMap = (obj) => new Map(Object.entries(obj));
const fromMap = (map) => Object.fromEntries(map);

/** Build the pristine-content reader for the project: only trustworthy while the real file is untouched. */
export function projectBefore(root, sourceBaseline) {
  return (rel) => {
    try {
      const st = fs.lstatSync(path.join(root, rel));
      const b = sourceBaseline.get(rel);
      if (!b || b.size !== st.size || b.mtimeMs !== st.mtimeMs) return null;
      return fs.readFileSync(path.join(root, rel));
    } catch {
      return null;
    }
  };
}

function homeBefore(meta) {
  return (rel) => {
    if (!meta.seeded.includes(rel)) return null;
    try {
      return fs.readFileSync(path.join(meta.realHome, rel));
    } catch {
      return null;
    }
  };
}

/** Compute the report for a finished session from the files on disk. */
export function buildReport(session, run = {}) {
  const { meta, paths, baseline } = session;
  const projBase = toMap(baseline.work);
  const projCur = walk(paths.work, { exclude: meta.exclude });
  const projChanges = computeChanges({
    baseline: projBase,
    current: projCur,
    before: projectBefore(meta.root, toMap(baseline.source)),
    afterRoot: paths.work,
    area: 'project',
  });
  const report = {
    id: session.id,
    command: meta.command,
    exitCode: run.exitCode ?? session.report?.exitCode ?? null,
    signal: run.signal ?? session.report?.signal ?? null,
    durationMs: run.durationMs ?? session.report?.durationMs ?? 0,
    root: meta.root,
    project: { entries: groupChanges(projChanges, { baseline: projBase, current: projCur }) },
    home: null,
  };
  if (meta.homeMode === 'fake') {
    const homeBase = toMap(baseline.home);
    const homeCur = walk(paths.home);
    const homeChanges = computeChanges({
      baseline: homeBase,
      current: homeCur,
      before: homeBefore(meta),
      afterRoot: paths.home,
      area: 'home',
    });
    report.home = { entries: groupChanges(homeChanges, { baseline: homeBase, current: homeCur }) };
  }
  return report;
}

export function rehearse(opts) {
  const root = fs.realpathSync(path.resolve(opts.root));
  const cwd = fs.realpathSync(path.resolve(opts.cwd));
  const rel = path.relative(root, cwd);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new UsageError('the working directory must be inside --root');
  if (root === path.parse(root).root || root === realHome()) {
    throw new UsageError(`refusing to clone ${root}; run from a project directory or pass --root`);
  }

  const sourceMap = walk(root, { exclude: opts.exclude });
  const size = totalSize(sourceMap);
  if (size > opts.maxSizeMB * 1024 * 1024) {
    throw new UsageError(
      `${root} is ${(size / 1048576).toFixed(0)} MB (limit ${opts.maxSizeMB} MB). ` +
        'Use --exclude <dir> (e.g. node_modules) or raise --max-size <MB>.',
    );
  }

  const id = newId();
  const p = sessionPaths(id);
  if (p.dir.startsWith(`${root}${path.sep}`)) throw new UsageError('DRESSRUN_DIR / TMPDIR must not be inside the project');
  fs.mkdirSync(sessionsBase(), { recursive: true, mode: 0o700 });
  for (const d of [p.dir, p.home, p.tmp]) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  cloneTree(root, p.work, { exclude: opts.exclude });

  const hReal = realHome();
  const seeded = [];
  const seedStat = {};
  if (opts.homeMode === 'fake') {
    for (const s of opts.seed) {
      const src = path.join(hReal, s);
      if (fs.existsSync(src) && fs.statSync(src).isFile()) {
        fs.mkdirSync(path.dirname(path.join(p.home, s)), { recursive: true });
        fs.copyFileSync(src, path.join(p.home, s));
        seeded.push(s);
        const st = fs.statSync(src);
        seedStat[s] = { size: st.size, mtimeMs: st.mtimeMs };
      }
    }
  }

  const workMap = walk(p.work, { exclude: opts.exclude });
  const homeMap = opts.homeMode === 'fake' ? walk(p.home) : new Map();
  const meta = {
    id,
    root,
    cwdRel: rel,
    command: opts.display,
    createdAt: new Date().toISOString(),
    exclude: opts.exclude,
    homeMode: opts.homeMode,
    realHome: hReal,
    seeded,
    seedStat,
  };
  fs.writeFileSync(p.meta, JSON.stringify(meta, null, 2));
  fs.writeFileSync(p.baseline, JSON.stringify({ source: fromMap(sourceMap), work: fromMap(workMap), home: fromMap(homeMap) }));

  const env = { ...process.env, DRESSRUN: '1', DRESSRUN_SESSION: id, TMPDIR: p.tmp };
  if (opts.homeMode === 'fake') {
    Object.assign(env, {
      HOME: p.home,
      XDG_CONFIG_HOME: path.join(p.home, '.config'),
      XDG_DATA_HOME: path.join(p.home, '.local/share'),
      XDG_CACHE_HOME: path.join(p.home, '.cache'),
      XDG_STATE_HOME: path.join(p.home, '.local/state'),
    });
  }

  const started = Date.now();
  const result = spawnSync(opts.argv[0], opts.argv.slice(1), {
    cwd: path.join(p.work, rel),
    env,
    stdio: opts.childStdio ?? 'inherit',
  });
  const durationMs = Date.now() - started;
  if (result.error && /** @type {any} */ (result.error).code === 'ENOENT') {
    deleteSession(id);
    throw new UsageError(`command not found: ${opts.argv[0]}`);
  }
  const exitCode = result.status ?? (result.signal ? 128 + (os.constants.signals[result.signal] || 0) : 1);

  const session = loadSession(id);
  const report = buildReport(session, { exitCode, signal: result.signal, durationMs });
  fs.writeFileSync(p.report, JSON.stringify(report, null, 2));
  return { id, report };
}
