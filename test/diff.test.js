import test from 'node:test';
import assert from 'node:assert/strict';
import { diffStats, splitLines, unifiedDiff } from '../src/diff.js';

const L = (s) => splitLines(s);

test('identical input has no changes', () => {
  assert.deepEqual(diffStats(L('a\nb\n'), L('a\nb\n')), { add: 0, del: 0 });
  assert.equal(unifiedDiff(L('a\n'), L('a\n')), '');
});

test('counts additions and deletions', () => {
  assert.deepEqual(diffStats(L('a\nb\nc\n'), L('a\nx\nc\nd\n')), { add: 2, del: 1 });
});

test('from empty and to empty', () => {
  assert.deepEqual(diffStats([], L('a\nb\n')), { add: 2, del: 0 });
  assert.deepEqual(diffStats(L('a\nb\n'), []), { add: 0, del: 2 });
});

test('unified diff has correct hunk header and context', () => {
  const a = L('1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n');
  const b = L('1\n2\n3\n4\n5\n6\n7\n8\nnine\n10\n');
  const d = unifiedDiff(a, b, { context: 1, from: 'a/f', to: 'b/f' }).split('\n');
  assert.equal(d[0], '--- a/f');
  assert.equal(d[2], '@@ -8,3 +8,3 @@');
  assert.deepEqual(d.slice(3), [' 8', '-9', '+nine', ' 10']);
});

test('large unrelated edits fall back without throwing', () => {
  const a = Array.from({ length: 4000 }, (_, i) => `a${i}`);
  const b = Array.from({ length: 4000 }, (_, i) => `b${i}`);
  assert.deepEqual(diffStats(a, b), { add: 4000, del: 4000 });
});

test('splitLines ignores a single trailing newline', () => {
  assert.deepEqual(L('a\nb\n'), ['a', 'b']);
  assert.deepEqual(L(''), []);
});
