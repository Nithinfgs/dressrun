import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { cleanup, exists, makeEnv, read, run, write } from './helpers.js';

function project(env) {
  write(env.proj, 'package.json', '{"name":"demo"}\n');
  write(env.proj, 'src/app.js', 'console.log("hi");\n');
  for (let i = 1; i <= 5; i++) write(env.proj, `build/f${i}.js`, `${i}\n`);
}

test('discard leaves the real project and home untouched', () => {
  const env = makeEnv();
  try {
    project(env);
    const r = run(env, ['--discard', '-c', 'rm -rf build; echo x > new.txt; echo y >> ~/.zshrc']);
    assert.equal(r.code, 0);
    assert.ok(exists(env.proj, 'build/f1.js'));
    assert.ok(!exists(env.proj, 'new.txt'));
    assert.ok(!exists(env.home, '.zshrc'));
    assert.match(r.stderr, /- build\/\s+5 files/);
    assert.match(r.stderr, /\+ new\.txt/);
    assert.match(r.stderr, /~\/\.zshrc.*shell startup file/);
  } finally {
    cleanup(env);
  }
});

test('--apply applies project changes but never home changes', () => {
  const env = makeEnv();
  try {
    project(env);
    const r = run(env, ['--apply', '-c', 'rm -rf build; echo "// edit" >> src/app.js; echo y > new.txt; echo z > ~/.profile']);
    assert.equal(r.code, 0);
    assert.ok(!exists(env.proj, 'build'));
    assert.match(read(env.proj, 'src/app.js'), /\/\/ edit/);
    assert.equal(read(env.proj, 'new.txt'), 'y\n');
    assert.ok(!exists(env.home, '.profile'));
  } finally {
    cleanup(env);
  }
});

test('--apply refuses to apply when the command fails', () => {
  const env = makeEnv();
  try {
    project(env);
    const r = run(env, ['--apply', '-c', 'echo partial > new.txt; exit 3']);
    assert.equal(r.code, 3);
    assert.ok(!exists(env.proj, 'new.txt'));
    assert.match(r.stderr, /not applying/);
    const kept = run(env, ['ls']);
    assert.match(kept.stderr, /exit 3|echo partial/);
  } finally {
    cleanup(env);
  }
});

test('non-interactive run keeps the session; apply --home rewrites the fake home path', () => {
  const env = makeEnv();
  try {
    project(env);
    const r = run(env, ['-c', 'echo "export PATH=$HOME/.acme/bin:$PATH" > ~/.acmerc; mkdir -p ~/.acme/bin; echo bin > ~/.acme/bin/acme']);
    assert.match(r.stderr, /kept: dressrun show/);
    const a = run(env, ['apply', '--home']);
    assert.equal(a.code, 0);
    const rc = read(env.home, '.acmerc');
    assert.ok(rc.includes(`${env.home}/.acme/bin`), rc);
    assert.ok(!rc.includes(env.sessions), 'fake home path must be rewritten');
    assert.equal(read(env.home, '.acme/bin/acme'), 'bin\n');
    assert.match(run(env, ['ls']).stderr, /no kept rehearsals/);
  } finally {
    cleanup(env);
  }
});

test('apply skips files that changed in the real tree and --force overwrites', () => {
  const env = makeEnv();
  try {
    project(env);
    run(env, ['-c', 'echo rehearsed > src/app.js']);
    write(env.proj, 'src/app.js', 'edited by a human meanwhile\n');
    const a = run(env, ['apply']);
    assert.equal(a.code, 3);
    assert.match(a.stderr, /skipped.*src\/app\.js.*changed in your real tree/);
    assert.equal(read(env.proj, 'src/app.js'), 'edited by a human meanwhile\n');
    const f = run(env, ['apply', '--force']);
    assert.equal(f.code, 0);
    assert.equal(read(env.proj, 'src/app.js'), 'rehearsed\n');
  } finally {
    cleanup(env);
  }
});

test('--only limits what is applied', () => {
  const env = makeEnv();
  try {
    project(env);
    run(env, ['-c', 'echo 1 > keep.txt; echo 2 > skip.txt']);
    assert.equal(run(env, ['apply', '--only', 'keep.txt']).code, 0);
    assert.ok(exists(env.proj, 'keep.txt'));
    assert.ok(!exists(env.proj, 'skip.txt'));
  } finally {
    cleanup(env);
  }
});

test('--json prints a report on stdout and sends command stdout to stderr', () => {
  const env = makeEnv();
  try {
    project(env);
    const r = run(env, ['--json', '--discard', '-c', 'echo hello-from-child; echo x > added.txt']);
    const report = JSON.parse(r.stdout);
    assert.equal(report.exitCode, 0);
    assert.equal(report.project.entries[0].label, 'added.txt');
    assert.match(r.stderr, /hello-from-child/);
  } finally {
    cleanup(env);
  }
});

test('flags executable, mode changes and hooks', () => {
  const env = makeEnv();
  try {
    project(env);
    fs.mkdirSync(path.join(env.proj, '.git/hooks'), { recursive: true });
    const r = run(env, ['--discard', '-c', 'printf "#!/bin/sh\\n" > .git/hooks/pre-commit; chmod +x package.json; echo K=1 > .env']);
    assert.match(r.stderr, /env\/secrets file/);
    assert.match(r.stderr, /x package\.json\s+permissions/);
    assert.match(r.stderr, /git hook/);
  } finally {
    cleanup(env);
  }
});

test('--exclude hides a path from the rehearsal and from apply', () => {
  const env = makeEnv();
  try {
    project(env);
    run(env, ['--exclude', 'build', '-c', 'ls build 2>/dev/null; echo x > added.txt']);
    run(env, ['apply']);
    assert.ok(exists(env.proj, 'build/f1.js'), 'excluded dir must not be deleted');
    assert.ok(exists(env.proj, 'added.txt'));
  } finally {
    cleanup(env);
  }
});

test('--home real uses the real home and reports no home section changes', () => {
  const env = makeEnv();
  try {
    project(env);
    const r = run(env, ['--home', 'real', '--discard', '-c', 'echo hi > ~/real-home-write']);
    assert.ok(exists(env.home, 'real-home-write'));
    assert.match(r.stderr, /real home was used/);
  } finally {
    cleanup(env);
  }
});

test('seeded .gitconfig is visible in the fake home and unchanged files are not reported', () => {
  const env = makeEnv();
  try {
    project(env);
    write(env.home, '.gitconfig', '[user]\n name = T\n');
    const r = run(env, ['--discard', '-c', 'cat ~/.gitconfig > seen.txt']);
    assert.doesNotMatch(r.stderr, /[+~] ~\/\.gitconfig/);
    assert.match(r.stderr, /\+ seen\.txt/);
  } finally {
    cleanup(env);
  }
});

test('usage errors', () => {
  const env = makeEnv();
  try {
    assert.equal(run(env, ['ls', 'x']).code, 0);
    const r1 = run(env, ['npm', 'install']);
    assert.equal(r1.code, 64);
    assert.match(r1.stderr, /put -- before it/);
    assert.equal(run(env, ['--', 'definitely-not-a-command-xyz']).code, 64);
    assert.equal(run(env, ['show']).code, 64);
    assert.equal(run(env, [], {}).code, 0);
  } finally {
    cleanup(env);
  }
});

test('refuses to clone the home directory or a huge tree', () => {
  const env = makeEnv();
  try {
    const r = run(env, ['--discard', '-c', 'true'], { cwd: env.home });
    assert.equal(r.code, 64);
    assert.match(r.stderr, /refusing to clone/);
    write(env.proj, 'big.bin', 'x'.repeat(2 * 1024 * 1024));
    const big = run(env, ['--max-size', '1', '--discard', '-c', 'true']);
    assert.equal(big.code, 64);
    assert.match(big.stderr, /--exclude/);
  } finally {
    cleanup(env);
  }
});

test('a commit made inside a rehearsal only reaches the real repo when applied', () => {
  const env = makeEnv();
  try {
    project(env);
    const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: env.proj, encoding: 'utf8' });
    git('init', '-q', '-b', 'main');
    git('add', '-A');
    git('commit', '-qm', 'init');
    const cmd = 'echo more >> src/app.js && git -c user.name=t -c user.email=t@t commit -qam rehearsed';
    assert.equal(run(env, ['--discard', '-c', cmd]).code, 0);
    assert.equal(git('log', '--oneline').trim().split('\n').length, 1);
    assert.equal(run(env, ['--apply', '-c', cmd]).code, 0);
    assert.equal(git('log', '--oneline').trim().split('\n').length, 2);
    assert.equal(git('status', '--porcelain').trim(), '');
    git('fsck', '--strict');
  } finally {
    cleanup(env);
  }
});

test('appending to a seeded shell rc shows as a modification and applies with --home', () => {
  const env = makeEnv();
  try {
    project(env);
    write(env.home, '.zshrc', 'export A=1\n');
    const r = run(env, ['--diff', '-c', 'echo "export PATH=$HOME/.acme/bin" >> ~/.zshrc']);
    assert.match(r.stderr, /~ ~\/\.zshrc\s+\+1 -0\s+! shell startup file/);
    assert.match(r.stderr, / export A=1/);
    assert.equal(run(env, ['apply', '--home']).code, 0);
    const rc = read(env.home, '.zshrc');
    assert.ok(rc.startsWith('export A=1\n'));
    assert.ok(rc.includes(`${env.home}/.acme/bin`));
  } finally {
    cleanup(env);
  }
});

test('apply --home refuses to clobber a shell rc edited since the rehearsal', () => {
  const env = makeEnv();
  try {
    project(env);
    write(env.home, '.zshrc', 'export A=1\n');
    run(env, ['-c', 'echo export B=2 >> ~/.zshrc']);
    write(env.home, '.zshrc', 'export A=1\nexport C=3\n');
    const a = run(env, ['apply', '--home']);
    assert.equal(a.code, 3);
    assert.match(a.stderr, /changed in your real home/);
    assert.equal(read(env.home, '.zshrc'), 'export A=1\nexport C=3\n');
  } finally {
    cleanup(env);
  }
});
