# Contributing

Thanks for helping. dressrun is small on purpose: zero runtime dependencies, macOS and Linux, Node 18+.

## Setup

```bash
git clone https://github.com/Nithinfgs/dressrun && cd dressrun
npm ci
npm run check        # eslint + tsc (checkJs) + node:test
```

Try your changes against the bundled demo project:

```bash
npm run demo                              # regenerates docs/assets/*.svg from real output
node bin/dressrun.js -c "echo hi > x.txt" # in any scratch directory
```

## Guidelines

- **Never touch the real home in tests.** `test/helpers.js` points `HOME` and `DRESSRUN_DIR` at a temp directory;
  use it.
- Add a test for every behaviour change. End-to-end tests drive the real CLI; the interactive prompt is tested
  through a pseudo-terminal (needs `python3`, skipped otherwise).
- Keep the safety properties intact: nothing is written outside the project root or real home, and `apply`
  never overwrites a file that changed after the rehearsal without `--force`.
- No runtime dependencies. Dev dependencies are fine when they earn their place.
- Match the surrounding style (ESM, JSDoc where types help, comments only where the *why* is not obvious).

## Good first contributions

- Windows support (needs a different clone/home strategy; see `docs/architecture.md`).
- More sensitive-path rules in `src/sensitive.js`.
- `--ignore-from .gitignore` style exclusion.
- Optional network blocking on platforms that offer it (`sandbox-exec`, `unshare -n`).

## Pull requests

Describe what changed and why, note the tests you added, and make sure `npm run check` passes.
