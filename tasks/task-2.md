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
- [x] Dependabot version updates enabled — proved by the merged
      grouped-actions update PR.
- [x] Dependabot alerts + security updates enabled; repo settings are
      not visible from the working tree.
- [x] No packages installed, no other workflows modified without
      confirmation.
