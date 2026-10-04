import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, exists, makeEnv, write } from './helpers.js';

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'dressrun.js');
const hasPython = spawnSync('python3', ['--version']).status === 0;

// Drives the real prompt through a pseudo-terminal: send each answer after the previous prompt settles.
const DRIVER = `
import os, pty, select, sys, time
bin_, cmd, *answers = sys.argv[1:]
pid, fd = pty.fork()
if pid == 0:
    os.execvp('node', ['node', bin_, '-c', cmd])
out = b''
def pump(t):
    global out
    end = time.time() + t
    while time.time() < end:
        r, _, _ = select.select([fd], [], [], 0.05)
        if r:
            try: d = os.read(fd, 4096)
            except OSError: return
            if not d: return
            out += d
pump(1.2)
for a in answers:
    try: os.write(fd, (a + '\\n').encode())
    except OSError: break
    pump(1.2)
sys.stdout.write(out.decode(errors='replace'))
`;

function drive(env, cmd, answers) {
  const r = spawnSync('python3', ['-c', DRIVER, BIN, cmd, ...answers], {
    cwd: env.proj,
    encoding: 'utf8',
    env: { ...process.env, HOME: env.home, DRESSRUN_DIR: env.sessions, TMPDIR: env.base },
  });
  return r.stdout;
}

test('interactive: diff, then apply', { skip: !hasPython }, () => {
  const env = makeEnv();
  try {
    write(env.proj, 'a.txt', 'old\n');
    const out = drive(env, 'echo new > b.txt; rm a.txt', ['d', 'a']);
    assert.match(out, /new file: b\.txt/);
    assert.match(out, /applied.*2 files/);
    assert.ok(exists(env.proj, 'b.txt'));
    assert.ok(!exists(env.proj, 'a.txt'));
  } finally {
    cleanup(env);
  }
});

test('interactive: select applies only chosen entries; Enter discards', { skip: !hasPython }, () => {
  const env = makeEnv();
  try {
    write(env.proj, 'a.txt', 'old\n');
    drive(env, 'echo 1 > x.txt; echo 2 > y.txt', ['1']);
    assert.ok(!exists(env.proj, 'x.txt'), 'plain "1" is not a command; the prompt re-asks');
    drive(env, 'echo 1 > x.txt; echo 2 > y.txt', ['s', '2']);
    assert.ok(!exists(env.proj, 'x.txt'));
    assert.ok(exists(env.proj, 'y.txt'));
    drive(env, 'echo 3 > z.txt', ['']);
    assert.ok(!exists(env.proj, 'z.txt'));
  } finally {
    cleanup(env);
  }
});
