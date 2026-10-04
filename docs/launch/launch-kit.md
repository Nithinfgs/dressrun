# Launch kit (drafts, nothing here is posted automatically)

Repository: https://github.com/Nithinfgs/dressrun
Tagline: Run any command on a throwaway copy of your project and a fake $HOME. See what it changed, then apply or discard.

Be upfront about the limits in every post: it is a preview tool, not a security sandbox.

---

## Hacker News

**Title:** Show HN: Dressrun, rehearse any command in a clone and a fake $HOME, then apply or discard

**Body:**

I kept wanting a "show me what this would do" step for commands that have no --dry-run: curl|sh installers,
codemods, cleanup scripts with a greedy glob, and commands a coding agent proposes.

dressrun runs the command for real, but in a copy-on-write clone of the current directory with HOME (and XDG_*, TMPDIR)
pointed at a fake home. Afterwards it lists every file added/modified/deleted/chmod-ed in the project and in ~, flags the
risky ones (shell rc files, LaunchAgents, git hooks, CI workflows, .env), shows diffs, and lets you apply all, apply a
selection, or discard. Apply refuses to overwrite a file you edited after the rehearsal started.

Zero runtime dependencies, Node 18+, macOS and Linux. Try it without installing: `npx github:Nithinfgs/dressrun -- <cmd>`.

Limits I would like criticism on: it is not a sandbox (network and absolute paths outside the project/fake home are
real), the clone is a full copy on filesystems without reflinks, and tools with warm caches in the real home start cold.
I'm especially interested in commands where the report misses something, and whether per-hunk apply or network
blocking matters more.

https://github.com/Nithinfgs/dressrun

---

## Reddit

Suggested places (read each sub's self-promotion rules first): r/commandline, r/node, r/devtools, and r/ClaudeAI or
r/ChatGPTCoding for the coding-agent angle. Post once, answer questions, do not cross-post the same day.

**Title:** I built a tool that runs any command in a clone + fake $HOME and shows what it changed before you apply it

**Body:**

The problem: plenty of commands I'd like to preview have no `--dry-run`: install scripts that edit ~/.zshrc, codemods,
cleanup scripts, release scripts, and whatever an AI coding agent wants to run.

How it works: dressrun clones the working directory (copy-on-write on APFS/btrfs/XFS), points HOME at a fake one
seeded with your shell rc files, runs the command there, and then reports file changes in both places with diffs.
You can apply the project changes, optionally apply home changes (the fake path inside files is rewritten to your real
home), pick specific entries, or throw everything away. `--json`/`--keep`/`apply` make it scriptable.

It is a preview tool, not a security sandbox: the command still has your network and can write to absolute paths.

What I'd like feedback on: commands where the report is wrong or incomplete, and which of these is most useful next:
per-hunk apply, optional network blocking, Windows.

Repo: https://github.com/Nithinfgs/dressrun

---

## X / Twitter

**Short:**
Rehearse any command before you run it for real.

dressrun runs it in a clone of your project with a fake $HOME, shows every file it changed (including ~/.zshrc and LaunchAgents), then you apply or discard.

Zero deps. macOS/Linux.
https://github.com/Nithinfgs/dressrun

**Technical:**
dressrun: `dressrun -c "curl -fsSL … | sh"` clones cwd via clonefile/reflink, sets HOME/XDG_*/TMPDIR to a seeded fake home, runs the command, diffs stat baselines (content only when stat changed), then offers conflict-checked apply. Not a sandbox, network is real. Node, no runtime deps.
https://github.com/Nithinfgs/dressrun

**Thread:**
1/ `--dry-run` only exists if the tool's author wrote it. I wanted a preview step for any command, so I built dressrun.
2/ It runs the command for real, but in a copy-on-write clone of your directory with HOME pointed at a fake one.
3/ Then you get a report: files added/modified/deleted in the project AND in ~, with warnings for shell rc files, LaunchAgents, git hooks, CI workflows, .env.
4/ Choose: apply, view diffs, select entries, keep for later, or discard. Apply skips files you edited after the rehearsal started.
5/ It also works for scripts and coding agents: `--json`, `--keep`, `dressrun apply --only 'src/**'`.
6/ Honest limits: it's a preview tool, not a sandbox. Network and absolute paths outside the project/fake home are real. Feedback welcome: https://github.com/Nithinfgs/dressrun

---

## LinkedIn

I wanted a "what will this actually do?" step for commands that have no --dry-run: install scripts that edit shell config,
cleanup scripts, codemods, and commands proposed by coding agents.

So I built dressrun, a small open-source CLI. It runs a command for real in a copy-on-write clone of your project with a
fake $HOME, then reports every file it added, changed or deleted, including things like ~/.zshrc, LaunchAgents and git
hooks. You can apply everything, apply a selection, or discard. Apply refuses to overwrite files you changed in the
meantime.

It is deliberately not a security sandbox (network and absolute paths are real), has zero runtime dependencies, and runs
on Node 18+ on macOS and Linux. I'd value feedback from anyone who reviews scripts or agent output for a living:
which commands does the report miss?

https://github.com/Nithinfgs/dressrun

---

## GitHub

**Description:** Run any command on a copy-on-write clone of your project and a fake $HOME. See exactly what it changed, then apply or discard.

**Topics:** `cli`, `developer-tools`, `dry-run`, `sandbox`, `diff`, `preview`, `nodejs`, `shell`, `coding-agents`, `devtools`

**Release notes (v0.1.0):** see CHANGELOG.md.
