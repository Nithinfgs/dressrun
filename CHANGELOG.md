# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-04

### Added
- `dressrun -- <command>` and `dressrun -c "<shell string>"`: run a command in a copy-on-write clone of the
  current directory with a fake `$HOME`, then report every file added, modified, deleted or chmod-ed.
- Interactive review: apply, view unified diffs, select entries, keep for later, or discard.
- Non-interactive flow for scripts and coding agents: `--apply`, `--discard`, `--json`, and the `ls`, `show`,
  `apply`, `discard` subcommands.
- Conflict detection on apply: files changed in the real tree since the rehearsal are skipped unless `--force`.
- Flags for paths that run code later or hold credentials (shell rc files, LaunchAgents, git hooks, CI
  workflows, `.env`, coding-agent config).
- Home changes can be applied with `apply --home`; the fake home path is rewritten to the real one in text files.
