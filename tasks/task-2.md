# Task 2 — Automated dependency monitoring: Dependabot + CI audit

> **Status: DONE — implemented with Dependabot, not Renovate.**
> Dependabot meets every requirement below (bun ecosystem, 3-day `cooldown`,
> security updates that bypass the cooldown, SHA-pinned actions) while
> keeping a hardening-focused repo free of a third-party GitHub App with
> write access. Trade-off: no Dependency Dashboard, no lockFileMaintenance
> (the nightly `bun audit` compensates for the latter). See `PLAN.md`
> "Accepted decisions". Live config: `.github/dependabot.yml` and
> `.github/workflows/audit.yml`.

## Context

Task 1 hardened installs at the moment they happen (exact versions,
3-day release-age gate, blocked install scripts). This task adds the
continuous side: an update bot to keep dependencies from rotting on old
vulnerable versions, and a CI audit so known advisories surface on every
dependency change and nightly — not only when someone remembers to run
`bun audit`.

Facts you must respect:

- Dependabot is first-party: it needs no third-party GitHub App with write
  access, but version updates, alerts and security updates are enabled in
  **repo settings** — a user action you cannot do.
- The 3-day cooldown must be consistent across the stack: `bunfig.toml`
  gates local installs, Dependabot's `cooldown` gates update PRs. Same
  value, same rationale. Exception: security updates bypass the cooldown —
  a public advisory changes the risk balance.
- The bun age gate does not re-check versions already in `bun.lock`
  (known limitation, see task 1). The nightly audit in this task is the
  compensating control for exactly that gap.
- Per CLAUDE.md workflow rules: never interpolate `github.event.*` values
  into `run:` blocks; pin third-party actions by commit SHA, not by tag.

## Steps

### 1. Create `.github/dependabot.yml`

Two ecosystems — `github-actions` and `bun` — both weekly, both with a
3-day `cooldown`, each grouped into a single PR. The live file is
`.github/dependabot.yml`; read it there rather than from a copy here.

Rationale to preserve if you adjust wording: `versioning-strategy: increase`
matches `exact = true` from task 1; the weekly schedule keeps PR noise low
for a solo project; grouping keeps one PR per ecosystem; security updates
(enabled in repo settings) bypass the cooldown so fixes arrive immediately.

### 2. Create `.github/workflows/audit.yml`

```yaml
name: Dependency audit

on:
  pull_request:
    paths:
      - package.json
      - bun.lock
      - bunfig.toml
  schedule:
    - cron: "0 4 * * *" # nightly

permissions:
  contents: read

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<PINNED_SHA> # v4/v5 — resolve, see step 3
      - uses: oven-sh/setup-bun@<PINNED_SHA> # v2 — resolve, see step 3
        with:
          bun-version: 1.3.14 # pinned, see PLAN.md "Accepted decisions"
      - run: bun install --frozen-lockfile
      - run: bun audit
```

Notes:
- The PR trigger is path-filtered: audits run when the dependency surface
  changes, not on every code PR.
- The nightly schedule catches advisories published for versions already
  in the lockfile.
- `--frozen-lockfile` is mandatory (CLAUDE.md rule) — CI must never
  resolve new versions.

### 3. Pin the action SHAs

Replace each `<PINNED_SHA>` with the full commit SHA of the latest stable
release of that action. Resolve them by fetching the action's releases
from the GitHub API (`repos/{owner}/{repo}/releases/latest`, then the tag's
commit SHA). Keep the human-readable version in the trailing comment.
Dependabot's `github-actions` ecosystem keeps these SHAs updated from now
on, rewriting both the digest and the version comment.

### 4. Verify against existing workflows

If `.github/workflows/` contains other workflow files, check them against
the same two rules (no `github.event.*` interpolation in `run:`, actions
pinned by SHA) and report violations. Fix only if the user confirms.

### 5. Tell the user what they must do by hand

End your run with exactly this checklist for the user:

1. Enable Dependabot **version updates** in repo settings — without it,
   `.github/dependabot.yml` is inert.
2. Enable Dependabot **alerts** and **security updates** (Settings →
   Advanced Security) — security PRs bypass the 3-day cooldown.
3. After the first run, check Insights → Dependency graph → Dependabot for
   config parse errors.

## Constraints

- Do NOT install any packages or modify package.json / bun.lock.
- Do NOT add a Renovate config (`renovate.json`) — one update bot only.
- Do NOT add automerge rules or notification integrations beyond the
  config above.
- Do NOT modify the triage workflow or other CI files except as reported
  in step 4 with user confirmation.

## Acceptance criteria

- [x] `.github/dependabot.yml` exists, valid YAML, 3-day `cooldown` on
      both ecosystems; security updates bypass it via repo settings.
- [x] `.github/workflows/audit.yml` exists with both triggers
      (path-filtered PR + nightly cron), `--frozen-lockfile`, and
      `bun audit`.
- [x] Both actions in audit.yml are pinned to full commit SHAs with a
      version comment.
- [x] No `github.event.*` interpolation inside any `run:` block you
      created.
- [x] The manual checklist (Dependabot settings) was shown to the user.
- [x] Dependabot version updates + alerts + security updates enabled in
      repo settings — confirmed by the merged grouped-actions update PR.
- [x] No packages installed, no other workflows modified without
      confirmation.
