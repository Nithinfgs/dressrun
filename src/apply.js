import fs from 'node:fs';
import path from 'node:path';
import { isBinary, matchesAny } from './util.js';

function inside(base, target) {
  const rel = path.relative(base, target);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function lstatOrNull(p) {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
}

function sameAsBaseline(st, b) {
  return st && b && st.size === b.size && st.mtimeMs === b.mtimeMs;
}

function copyEntry(from, to, change, rewrite) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.rmSync(to, { force: true });
  if (change.type === 'symlink') {
    fs.symlinkSync(fs.readlinkSync(from), to);
    return;
  }
  const buf = fs.readFileSync(from);
  if (rewrite && !isBinary(buf)) {
    fs.writeFileSync(to, buf.toString('utf8').split(rewrite.from).join(rewrite.to));
  } else fs.copyFileSync(from, to);
  fs.chmodSync(to, fs.statSync(from).mode & 0o7777);
}

/**
 * Apply selected change entries from a session to the real tree.
 * Returns one result per file: applied | conflict | error.
 */
export function applyEntries({ session, area, entries, force = false }) {
  const { meta, paths, baseline } = session;
  const isHome = area === 'home';
  const targetRoot = isHome ? meta.realHome : meta.root;
  const fromRoot = isHome ? paths.home : paths.work;
  const base = new Map(Object.entries(isHome ? baseline.home : baseline.source));
  const rewrite = isHome ? { from: paths.home, to: meta.realHome } : null;
  const results = [];

  for (const entry of entries) {
    for (const c of entry.changes) {
      const target = path.join(targetRoot, c.path);
      const from = path.join(fromRoot, c.path);
      const res = { path: c.path, kind: c.kind, area, status: 'applied', note: '' };
      results.push(res);
      if (!inside(targetRoot, target)) {
        res.status = 'error';
        res.note = 'path escapes target root';
        continue;
      }
      try {
        const st = lstatOrNull(target);
        const b = base.get(c.path);
        const seeded = isHome && meta.seeded.includes(c.path);
        let conflict = null;
        if (c.kind === 'added') {
          if (st) conflict = 'already exists in your real tree';
        } else if (isHome) {
          const seed = meta.seedStat?.[c.path];
          if (!seeded && st) conflict = 'already exists in your real home';
          else if (seeded && st && !sameAsBaseline(st, seed)) conflict = 'changed in your real home since the rehearsal started';
        } else if (!st) conflict = 'no longer exists in your real tree';
        else if (!sameAsBaseline(st, b) && !(st.isSymbolicLink() && b?.link === fs.readlinkSync(target))) {
          conflict = 'changed in your real tree since the rehearsal started';
        }
        if (conflict && !force) {
          res.status = 'conflict';
          res.note = conflict;
          continue;
        }
        if (c.kind === 'deleted') {
          fs.rmSync(target, { force: true });
        } else if (c.kind === 'mode') {
          fs.chmodSync(target, fs.statSync(from).mode & 0o7777);
        } else {
          copyEntry(from, target, c, rewrite);
        }
      } catch (err) {
        res.status = 'error';
        res.note = err.message;
      }
    }
  }

  // tidy directories the command removed entirely
  if (!isHome) {
    const gone = [...base.entries()]
      .filter(([rel, v]) => v.type === 'dir' && !fs.existsSync(path.join(fromRoot, rel)))
      .map(([rel]) => rel)
      .sort((a, b) => b.length - a.length);
    for (const rel of gone) {
      try {
        fs.rmdirSync(path.join(targetRoot, rel));
      } catch {
        /* not empty or already gone */
      }
    }
  }
  return results;
}

/** @param {any[]} entries @param {{only?: string[], ids?: number[]}} filter */
export function selectEntries(entries, filter) {
  const { only, ids } = filter;
  const out = [];
  for (const e of entries) {
    if (ids && !ids.includes(e.id)) continue;
    const changes = only && only.length ? e.changes.filter((c) => matchesAny(c.path, only)) : e.changes;
    if (changes.length) out.push({ ...e, changes });
  }
  return out;
}
