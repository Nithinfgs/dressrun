/**
 * Collapse raw per-file changes into reviewable entries:
 *  - everything under .git/ becomes one "git metadata" entry
 *  - a brand-new directory with >= 4 added files becomes one entry
 *  - a removed directory with >= 4 deleted files becomes one entry
 */
const COLLAPSE_AT = 4;

function ancestors(rel) {
  const parts = rel.split('/');
  const out = [];
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join('/'));
  return out;
}

export function groupChanges(changes, { baseline, current }) {
  const keyOf = new Map();
  for (const c of changes) {
    if (c.path === '.git' || c.path.startsWith('.git/')) {
      keyOf.set(c.path, { key: '.git', label: '.git/ (git metadata)', kind: 'git' });
      continue;
    }
    let top = null;
    if (c.kind === 'added') top = ancestors(c.path).find((a) => !baseline.has(a));
    else if (c.kind === 'deleted') top = ancestors(c.path).find((a) => !current.has(a));
    if (top) keyOf.set(c.path, { key: `${c.kind}:${top}`, label: `${top}/`, kind: c.kind });
  }
  const buckets = new Map();
  for (const c of changes) {
    const g = keyOf.get(c.path);
    const key = g ? g.key : `file:${c.path}`;
    if (!buckets.has(key)) buckets.set(key, { group: g, changes: [] });
    buckets.get(key).changes.push(c);
  }
  /** @type {any[]} */
  const entries = [];
  for (const { group, changes: list } of buckets.values()) {
    const collapse = group && (group.kind === 'git' || list.length >= COLLAPSE_AT);
    const parts = collapse ? [list] : list.map((c) => [c]);
    for (const part of parts) {
      const single = !collapse;
      const first = part[0];
      entries.push({
        label: single ? first.path : group.label,
        kind: single ? first.kind : group.kind,
        changes: part,
        files: part.length,
        bytes: part.reduce((n, c) => n + (c.size || 0), 0),
        add: part.reduce((n, c) => n + (c.add || 0), 0),
        del: part.reduce((n, c) => n + (c.del || 0), 0),
        flags: [...new Set(part.flatMap((c) => c.flags))],
      });
    }
  }
  entries.sort((x, y) => {
    const gx = x.kind === 'git' ? 1 : 0;
    const gy = y.kind === 'git' ? 1 : 0;
    return gx - gy || (x.label < y.label ? -1 : x.label > y.label ? 1 : 0);
  });
  entries.forEach((e, i) => (e.id = i + 1));
  return entries;
}
