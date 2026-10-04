import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'dressrun.js');

/** An isolated sandbox: project dir, fake "real" HOME, and session store, all under one temp dir. */
export function makeEnv() {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dressrun-test-')));
  const env = {
    base,
    proj: path.join(base, 'proj'),
    home: path.join(base, 'home'),
    sessions: path.join(base, 'sessions'),
  };
  fs.mkdirSync(env.proj, { recursive: true });
  fs.mkdirSync(env.home, { recursive: true });
  return env;
}

export function write(root, rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

export function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

export function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

/** @param {{cwd?: string, input?: string}} [opts] */
export function run(env, args, opts = {}) {
  const { cwd = env.proj, input = undefined } = opts;
  const r = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    env: { ...process.env, HOME: env.home, DRESSRUN_DIR: env.sessions, NO_COLOR: '1', TMPDIR: env.base },
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

export function cleanup(env) {
  fs.rmSync(env.base, { recursive: true, force: true });
}
