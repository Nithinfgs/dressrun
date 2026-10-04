import fs from 'node:fs';
import path from 'node:path';

export function isExcluded(rel, excludes) {
  return excludes.some((e) => rel === e || rel.startsWith(`${e}/`));
}

/**
 * Snapshot a directory tree: relative posix path -> stat summary.
 * Sockets, FIFOs and devices are skipped.
 */
export function walk(root, { exclude = [] } = {}) {
  const ex = exclude.map((e) => e.replace(/\/+$/, ''));
  const out = new Map();
  (function rec(rel) {
    const abs = rel ? path.join(root, rel) : root;
    let entries;
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of entries) {
      const r = rel ? `${rel}/${d.name}` : d.name;
      if (isExcluded(r, ex)) continue;
      let st;
      try {
        st = fs.lstatSync(path.join(root, r));
      } catch {
        continue;
      }
      const base = { size: st.size, mtimeMs: st.mtimeMs, mode: st.mode & 0o7777 };
      if (st.isSymbolicLink()) {
        out.set(r, { ...base, type: 'symlink', link: fs.readlinkSync(path.join(root, r)) });
      } else if (st.isDirectory()) {
        out.set(r, { ...base, type: 'dir' });
        rec(r);
      } else if (st.isFile()) {
        out.set(r, { ...base, type: 'file' });
      }
    }
  })('');
  return out;
}

export function totalSize(map) {
  let n = 0;
  for (const v of map.values()) if (v.type === 'file') n += v.size;
  return n;
}
