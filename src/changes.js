import fs from 'node:fs';
import path from 'node:path';
import { diffStats, splitLines } from './diff.js';
import { isBinary } from './util.js';
import { flagsFor } from './sensitive.js';

const MAX_TEXT = 2 * 1024 * 1024;

function readSafe(p) {
  try {
    return fs.readFileSync(p);
  } catch {
    return null;
  }
}

function lineCount(buf) {
  return buf && buf.length <= MAX_TEXT && !isBinary(buf) ? splitLines(buf.toString('utf8')).length : null;
}

/**
 * Compare a baseline snapshot with the current tree.
 * `before(rel)` returns the pristine Buffer (or null if unknown); `afterRoot` is the tree holding current content.
 */
export function computeChanges({ baseline, current, before, afterRoot, area }) {
  const changes = [];
  const mk = (rel, kind, type, extra = {}) => ({
    path: rel,
    kind,
    type,
    flags: flagsFor(rel, area),
    ...extra,
  });

  for (const [rel, cur] of current) {
    if (cur.type === 'dir') continue;
    const base = baseline.get(rel);
    if (!base || base.type === 'dir') {
      const buf = cur.type === 'file' ? readSafe(path.join(afterRoot, rel)) : null;
      const n = lineCount(buf);
      changes.push(
        mk(rel, 'added', cur.type, {
          size: cur.size,
          add: n,
          binary: buf ? isBinary(buf) : false,
          executable: cur.type === 'file' && (cur.mode & 0o111) !== 0,
          link: cur.link,
        }),
      );
      continue;
    }
    if (base.type !== cur.type) {
      changes.push(mk(rel, 'modified', cur.type, { size: cur.size, link: cur.link }));
      continue;
    }
    if (cur.type === 'symlink') {
      if (cur.link !== base.link) changes.push(mk(rel, 'modified', 'symlink', { link: cur.link, from: base.link }));
      continue;
    }
    if (cur.size === base.size && cur.mtimeMs === base.mtimeMs && cur.mode === base.mode) continue;
    const a = readSafe(path.join(afterRoot, rel));
    const b = before(rel);
    if (a && b && a.equals(b)) {
      if (cur.mode !== base.mode) changes.push(mk(rel, 'mode', 'file', { mode: cur.mode, fromMode: base.mode }));
      continue;
    }
    const extra = { size: cur.size, before: base.size };
    if (a && b && a.length <= MAX_TEXT && b.length <= MAX_TEXT && !isBinary(a) && !isBinary(b)) {
      Object.assign(extra, diffStats(splitLines(b.toString('utf8')), splitLines(a.toString('utf8'))));
    } else extra.binary = true;
    changes.push(mk(rel, 'modified', 'file', extra));
  }

  for (const [rel, base] of baseline) {
    if (base.type === 'dir') continue;
    const cur = current.get(rel);
    if (!cur || cur.type === 'dir') {
      const buf = base.type === 'file' ? before(rel) : null;
      changes.push(mk(rel, 'deleted', base.type, { size: base.size, del: lineCount(buf) }));
    }
  }

  changes.sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));
  return changes;
}
