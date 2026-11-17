# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub's
[private vulnerability reporting](https://github.com/JoshuaDuq/planumatlas/security/advisories/new)
for this repository, not in a public issue, pull request or discussion. Include what is affected, the steps
to reproduce it and what an attacker could do with it.

## Scope

- The viewer as published at [planumatlas.com](https://planumatlas.com/), including its service worker.
- The feedback Worker at `feedback.planumatlas.com` (`workers/feedback/`).
- The build and deploy workflows in `.github/workflows/`.

Only the current `main` branch and the live site are supported; there are no maintained releases.

Planum is a teaching atlas, not a clinical tool. A wrong label or a misplaced region is a correctness
problem, not a security one: report it as an ordinary issue or through the site's feedback form.
