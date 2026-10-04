// Renders docs/assets/*.svg from REAL dressrun output (no mocked report text).
// Cosmetic substitutions only: the temp project path is shown as ~/code/acme-cli.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dressrun-demo-')));
process.env.HOME = path.join(tmp, 'home');
process.env.DRESSRUN_DIR = path.join(tmp, 'sessions');
process.env.TMPDIR = tmp;
fs.mkdirSync(process.env.HOME, { recursive: true });
fs.writeFileSync(path.join(process.env.HOME, '.zshrc'), 'export EDITOR=vim\nalias gs="git status"\n');

const { rehearse } = await import('../src/session.js');
const { renderReport } = await import('../src/render.js');
const { makeColors } = await import('../src/color.js');
const { choicesLine } = await import('../src/cli.js');

const PALETTE = { 31: '#ff7b72', 32: '#7ee787', 33: '#e3b341', 36: '#79c0ff' };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function segments(line) {
  const out = [];
  let state = { bold: false, dim: false, fg: null };
  let last = 0;
  // eslint-disable-next-line no-control-regex
  for (const m of line.matchAll(/\x1b\[(\d+)m/g)) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), ...state });
    last = m.index + m[0].length;
    const n = Number(m[1]);
    if (n === 1) state = { ...state, bold: true };
    else if (n === 2) state = { ...state, dim: true };
    else if (n === 22) state = { ...state, bold: false, dim: false };
    else if (n === 39) state = { ...state, fg: null };
    else if (PALETTE[n]) state = { ...state, fg: PALETTE[n] };
  }
  if (last < line.length) out.push({ text: line.slice(last), ...state });
  return out;
}

function toSvg(lines, title) {
  const cw = 9;
  const lh = 20;
  // eslint-disable-next-line no-control-regex
  const cols = Math.max(...lines.map((l) => l.replace(/\x1b\[\d+m/g, '').length));
  const width = Math.ceil(cols * cw + 56);
  const height = lines.length * lh + 76;
  const rows = lines
    .map((line, i) => {
      const spans = segments(line)
        .map((s) => {
          const fill = s.fg || (s.dim ? '#8b949e' : '#e6edf3');
          const weight = s.bold ? ' font-weight="700"' : '';
          return `<tspan fill="${fill}"${weight}>${esc(s.text)}</tspan>`;
        })
        .join('');
      return `<text x="28" y="${64 + i * lh}" xml:space="preserve">${spans}</text>`;
    })
    .join('\n    ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">
  <title>${esc(title)}</title>
  <rect width="${width}" height="${height}" rx="10" fill="#0d1117"/>
  <rect width="${width}" height="36" rx="10" fill="#161b22"/>
  <rect y="26" width="${width}" height="10" fill="#161b22"/>
  <circle cx="22" cy="18" r="6" fill="#ff5f56"/><circle cx="42" cy="18" r="6" fill="#ffbd2e"/><circle cx="62" cy="18" r="6" fill="#27c93f"/>
  <g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, 'DejaVu Sans Mono', monospace" font-size="14">
    ${rows}
  </g>
</svg>
`;
}

function scenario(name, script, title) {
  const proj = path.join(tmp, name);
  fs.cpSync(path.join(ROOT, 'examples/demo-project'), proj, { recursive: true });
  const git = (...a) => execFileSync('git', ['-c', 'user.name=demo', '-c', 'user.email=demo@example.com', ...a], { cwd: proj });
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('commit', '-qm', 'init');
  const { report } = rehearse({
    root: proj,
    cwd: proj,
    argv: ['sh', script],
    display: `sh ./${script}`,
    exclude: [],
    maxSizeMB: 100,
    homeMode: 'fake',
    seed: ['.zshrc'],
    childStdio: 'ignore',
  });
  const c = makeColors(true);
  const hasHome = report.home.entries.length > 0;
  const text = [
    `${c.dim('$')} dressrun -c ${JSON.stringify(`sh ./${script}`)}`,
    '',
    renderReport(report, c, { showIds: true }),
    '',
    c.dim(choicesLine(hasHome)),
    '> ',
  ]
    .join('\n')
    .split(proj)
    .join('~/code/acme-cli');
  const out = path.join(ROOT, 'docs/assets', `${name}.svg`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, toSvg(text.split('\n'), title));
  console.log(`wrote ${path.relative(ROOT, out)}`);
}

scenario('demo-install', 'install-acme.sh', 'dressrun rehearsing a third-party installer');
scenario('demo-cleanup', 'cleanup.sh', 'dressrun rehearsing a cleanup script that deletes too much');
fs.rmSync(tmp, { recursive: true, force: true });
