import test from 'node:test';
import assert from 'node:assert/strict';
import { groupChanges } from '../src/group.js';

const ch = (path, kind, extra = {}) => ({ path, kind, type: 'file', flags: [], size: 1, ...extra });

test('collapses large new and removed directories and .git', () => {
  const baseline = new Map([['old', { type: 'dir' }], ['keep', { type: 'dir' }]]);
  const current = new Map([['keep', { type: 'dir' }], ['fresh', { type: 'dir' }]]);
  const changes = [
    ...[1, 2, 3, 4].map((i) => ch(`fresh/${i}`, 'added')),
    ...[1, 2, 3, 4, 5].map((i) => ch(`old/${i}`, 'deleted')),
    ch('keep/a', 'added'),
    ch('keep/b', 'added'),
    ch('.git/HEAD', 'modified'),
    ch('.git/index', 'modified'),
  ];
  const entries = groupChanges(changes, { baseline, current });
  assert.deepEqual(
    entries.map((e) => [e.label, e.files]),
    [['fresh/', 4], ['keep/a', 1], ['keep/b', 1], ['old/', 5], ['.git/ (git metadata)', 2]],
  );
  assert.deepEqual(entries.map((e) => e.id), [1, 2, 3, 4, 5]);
});

test('small new directories stay as individual files', () => {
  const entries = groupChanges([ch('d/a', 'added'), ch('d/b', 'added')], {
    baseline: new Map(),
    current: new Map([['d', { type: 'dir' }]]),
  });
  assert.equal(entries.length, 2);
});
