import fs from 'node:fs';
import path from 'node:path';
import { isExcluded } from './walk.js';
import { toPosix } from './util.js';

/**
 * Copy a tree using copy-on-write clones where the filesystem supports it
 * (APFS, btrfs, XFS reflinks); falls back to a plain copy elsewhere.
 */
export function cloneTree(src, dst, { exclude = [] } = {}) {
  const ex = exclude.map((e) => e.replace(/\/+$/, ''));
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(src, dst, {
    recursive: true,
    preserveTimestamps: true,
    verbatimSymlinks: true,
    mode: fs.constants.COPYFILE_FICLONE,
    filter: (s) => {
      const rel = toPosix(path.relative(src, s));
      if (!rel) return true;
      if (isExcluded(rel, ex)) return false;
      const st = fs.lstatSync(s);
      return st.isFile() || st.isDirectory() || st.isSymbolicLink();
    },
  });
}
