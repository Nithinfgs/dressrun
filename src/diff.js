/** Line diff (Myers O(ND)) and unified-diff rendering. No dependencies. */

const MAX_D = 3000;

function myers(a, b) {
  const n = a.length;
  const m = b.length;
  const max = Math.min(n + m, MAX_D);
  const off = max + 1;
  let v = new Int32Array(2 * max + 3);
  const trace = [];
  for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && v[k - 1 + off] < v[k + 1 + off])) x = v[k + 1 + off];
      else x = v[k - 1 + off] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[k + off] = x;
      if (x >= n && y >= m) return backtrack(trace, a, b, off);
    }
  }
  return null;
}

function backtrack(trace, a, b, off) {
  let x = a.length;
  let y = b.length;
  const ops = [];
  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d];
    const k = x - y;
    const prevK = k === -d || (k !== d && v[k - 1 + off] < v[k + 1 + off]) ? k + 1 : k - 1;
    const prevX = v[prevK + off];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push({ t: ' ', line: a[x - 1] });
      x--;
      y--;
    }
    if (d > 0) {
      if (x === prevX) ops.push({ t: '+', line: b[y - 1] });
      else ops.push({ t: '-', line: a[x - 1] });
    }
    x = prevX;
    y = prevY;
  }
  return ops.reverse();
}

/** Fallback for huge edits: keep common prefix/suffix, replace the middle. */
function coarse(a, b) {
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let e = 0;
  while (e < a.length - s && e < b.length - s && a[a.length - 1 - e] === b[b.length - 1 - e]) e++;
  return [
    ...a.slice(0, s).map((line) => ({ t: ' ', line })),
    ...a.slice(s, a.length - e).map((line) => ({ t: '-', line })),
    ...b.slice(s, b.length - e).map((line) => ({ t: '+', line })),
    ...a.slice(a.length - e).map((line) => ({ t: ' ', line })),
  ];
}

export function splitLines(text) {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function diffLines(a, b) {
  return myers(a, b) ?? coarse(a, b);
}

export function diffStats(a, b) {
  let add = 0;
  let del = 0;
  for (const op of diffLines(a, b)) {
    if (op.t === '+') add++;
    else if (op.t === '-') del++;
  }
  return { add, del };
}

export function unifiedDiff(a, b, { context = 3, from = 'a', to = 'b' } = {}) {
  const ops = diffLines(a, b);
  const out = [];
  const keep = new Array(ops.length).fill(false);
  ops.forEach((op, i) => {
    if (op.t === ' ') return;
    for (let j = Math.max(0, i - context); j <= Math.min(ops.length - 1, i + context); j++) keep[j] = true;
  });
  if (!keep.some(Boolean)) return '';
  out.push(`--- ${from}`, `+++ ${to}`);
  let aLine = 1;
  let bLine = 1;
  let i = 0;
  while (i < ops.length) {
    if (!keep[i]) {
      if (ops[i].t !== '+') aLine++;
      if (ops[i].t !== '-') bLine++;
      i++;
      continue;
    }
    let j = i;
    let aCount = 0;
    let bCount = 0;
    const body = [];
    while (j < ops.length && keep[j]) {
      body.push(`${ops[j].t}${ops[j].line}`);
      if (ops[j].t !== '+') aCount++;
      if (ops[j].t !== '-') bCount++;
      j++;
    }
    out.push(`@@ -${aCount ? aLine : aLine - 1},${aCount} +${bCount ? bLine : bLine - 1},${bCount} @@`, ...body);
    aLine += aCount;
    bLine += bCount;
    i = j;
  }
  return out.join('\n');
}
