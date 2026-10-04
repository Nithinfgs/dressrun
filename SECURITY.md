# Security policy

## What dressrun is and is not

dressrun is a **preview tool, not a sandbox**. It runs your command for real, with your user's permissions,
network access and environment variables. It only redirects `$HOME`, the `XDG_*` directories, `$TMPDIR` and the
working directory. A command that uses absolute paths (for example `/usr/local`, `/etc`, or `~root`), talks to a
daemon (Docker, a database) or calls a remote API will still affect the outside world. Do not use dressrun to
make running untrusted code safe.

Reports of bypasses of the *documented* guarantees are in scope:

- a change to the project directory or home directory that is not reported;
- `apply` writing outside the project root or the real home directory;
- `apply` overwriting a file that changed after the rehearsal started without `--force`.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting: **Security → Report a vulnerability** on this repository.
Do not open a public issue for a security problem. You can expect an initial response within a week.

## Supported versions

Only the latest released version receives fixes.
