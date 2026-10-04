First release.

**dressrun** runs any command on a copy-on-write clone of your project with a fake `$HOME`, shows exactly what it changed, and lets you apply, select, keep, or discard.

### Highlights
- Works on any command (`dressrun -- cmd` / `dressrun -c "pipe | line"`), no tool support needed.
- Reports changes in the project and the fake home, with unified diffs and warnings for shell rc files, LaunchAgents, git hooks, CI workflows, `.env` and coding-agent config.
- Conflict-checked apply; home changes only on request, with fake-path rewriting.
- Scriptable: `--json`, `--apply`, `--discard`, `ls | show | apply | discard`.
- Zero runtime dependencies. Node 18.17+, macOS and Linux.

### Limits
Not a security sandbox: network access and absolute paths outside the project and fake home are real. Clone is a full copy on filesystems without reflinks. No Windows support yet.

Try it: `npx github:Nithinfgs/dressrun -- <command>`
