# Task 2 — Automated dependency monitoring: Renovate + CI audit

## Context

Task 1 hardened installs at the moment they happen (exact versions,
3-day release-age gate, blocked install scripts). This task adds the
continuous side: Renovate to keep dependencies from rotting on old
vulnerable versions, and a CI audit so known advisories surface on every
dependency change and nightly — not only when someone remembers to run
`bun audit`.

Facts you must respect:

- Renovate runs as the Mend Renovate GitHub App. Installing the app on the
  repository is a **user action** — you cannot do it. Your job is to
  prepare the config so the first run behaves correctly.
- The 3-day cooldown must be consistent across the stack: `bunfig.toml`
  gates local installs, Renovate's `minimumReleaseAge` gates update PRs.
  Same value, same rationale. Exception: PRs fixing a known vulnerability
  may bypass the cooldown — a public advisory changes the risk balance.
- The bun age gate does not re-check versions already in `bun.lock`
  (known limitation, see task 1). The nightly audit in this task is the
  compensating control for exactly that gap.
- Per CLAUDE.md workflow rules: never interpolate `github.event.*` values
  into `run:` blocks; pin third-party actions by commit SHA, not by tag.

## Steps

### 1. Create `renovate.json` in the repo root

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:best-practices",
    ":dependencyDashboard"
  ],
  "minimumReleaseAge": "3 days",
  "rangeStrategy": "pin",
  "osvVulnerabilityAlerts": true,
  "vulnerabilityAlerts": {
    "minimumReleaseAge": null,
    "labels": ["security"]
  },
  "schedule": ["before 6am on monday"],
  "packageRules": [
    {
      "matchUpdateTypes": ["minor", "patch"],
      "matchCurrentVersion": "!/^0/",
      "groupName": "non-major dependencies"
    }
  ],
  "lockFileMaintenance": {
    "enabled": true,
    "schedule": ["before 6am on monday"]
  }
}
```

Rationale to preserve if you adjust wording: `config:best-practices` pins
GitHub Action digests and enables config migration; `rangeStrategy: pin`
matches `exact = true` from task 1; the weekly schedule keeps PR noise low
for a solo project; vulnerability PRs are exempt from both the cooldown and
the schedule so fixes arrive immediately.

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
          bun-version: latest
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
Renovate (`config:best-practices`) will keep these digests updated from
now on.

### 4. Verify against existing workflows

If `.github/workflows/` contains other workflow files, check them against
the same two rules (no `github.event.*` interpolation in `run:`, actions
pinned by SHA) and report violations. Fix only if the user confirms.

### 5. Tell the user what they must do by hand

End your run with exactly this checklist for the user:

1. Install the Mend Renovate GitHub App on this repository
   (github.com/apps/renovate) — without it, `renovate.json` is inert.
2. After the first Renovate run, open the Dependency Dashboard issue it
   creates and confirm the config was parsed without errors.
3. Optionally enable GitHub's own Dependabot *alerts* (Settings →
   Advanced Security) — alerts only, not Dependabot PRs; Renovate is the
   single source of update PRs.

## Constraints

- Do NOT install any packages or modify package.json / bun.lock.
- Do NOT create Dependabot config files (`.github/dependabot.yml`) — one
  update bot only.
- Do NOT add extra Renovate presets, automerge rules, or notification
  integrations beyond the config above.
- Do NOT modify the triage workflow or other CI files except as reported
  in step 4 with user confirmation.

## Acceptance criteria

- [ ] `renovate.json` exists at repo root, valid JSON, cooldown "3 days",
      vulnerability alerts exempt from cooldown and schedule.
- [ ] `.github/workflows/audit.yml` exists with both triggers
      (path-filtered PR + nightly cron), `--frozen-lockfile`, and
      `bun audit`.
- [ ] Both actions in audit.yml are pinned to full commit SHAs with a
      version comment.
- [ ] No `github.event.*` interpolation inside any `run:` block you
      created.
- [ ] The manual checklist (Renovate app install) was shown to the user.
- [ ] No packages installed, no other workflows modified without
      confirmation.
