# Examples

`demo-project/` is a tiny project used by the README demo and by `npm run demo`.

- `install-acme.sh` is a **simulated** third-party installer. It only writes files, but they are exactly the kind
  of files real installers write: a PATH line in `~/.zshrc`, a LaunchAgent, a git hook, a `postinstall` script.
- `cleanup.sh` is a "free some space" script with a bug: it also deletes `src/generated`.

Try them yourself (nothing is applied unless you say so):

```bash
cp -R examples/demo-project /tmp/acme-cli && cd /tmp/acme-cli && git init -q && git add -A && git commit -qm init
dressrun -c "sh ./install-acme.sh"
dressrun -c "sh ./cleanup.sh"
```
