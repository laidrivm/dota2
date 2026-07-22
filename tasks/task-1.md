# Task 1 — Harden bun against supply-chain attacks

> **Status: DONE.** Live config: `bunfig.toml` (`exact`,
> `minimumReleaseAge`, empty `minimumReleaseAgeExcludes`),
> `.claude/settings.json` (install commands ask), CLAUDE.md "Dependency
> safety", README "Dependency hygiene".

## Context

This project uses bun as its package manager. We are applying the defenses
from a supply-chain security talk (install-script abuse, malicious fresh
releases, typo/slopsquatting, lockfile drift) before any dependencies exist,
so every future install goes through these gates.

Facts you must respect while working (do not "fix" or work around them):

- bun blocks dependency lifecycle scripts (postinstall etc.) **by default**.
  Allowing them is opt-in per package via `trustedDependencies` in
  package.json. Do NOT pre-populate that list — it stays empty until a real
  package needs it.
- `minimumReleaseAge` is configured in **seconds** and works only in the
  **project-local** `bunfig.toml` (the global `~/.bunfig.toml` is ignored
  for this setting).
- The age gate is enforced at dependency resolution (`bun add`) only.
  Versions already pinned in `bun.lock` bypass it, and `bunx` does not
  enforce it at all. These are known bun limitations — document them, don't
  attempt to patch around them.

## Constraints

- Do NOT install, update, or remove any packages in this task.
- Do NOT create `trustedDependencies` or add entries to
  `minimumReleaseAgeExcludes`.
- Do NOT touch CI workflows in this task (audit step lands together with
  the CI pipeline later).
- Keep every file change minimal — no extra config keys beyond the ones
  specified.

## Acceptance criteria

- [x] `bunfig.toml` exists at repo root with `exact`, `minimumReleaseAge`
      (259200), and empty `minimumReleaseAgeExcludes` under `[install]`.
- [x] No auto-approve permissions for bun/bunx/npm/npx install commands in
      `.claude/settings*.json`.
- [x] CLAUDE.md contains the "Dependency safety" subsection verbatim in
      intent (wording may be tightened, rules may not be weakened).
- [x] README.md contains the "Dependency hygiene" routine.
- [x] `bun install` (on the empty project) exits cleanly with the new
      config in place.
- [x] No packages were installed and no trust lists were created.
