# Task 1 — Harden bun against supply-chain attacks

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

## Steps

### 1. Check bun version

Run `bun --version`. Require >= 1.3. If older, stop and tell the user to
upgrade first — `minimumReleaseAge` support is missing in older versions.

### 2. Create `bunfig.toml` in the repo root

```toml
[install]
# Pin exact versions in package.json (no ^ ranges) — malicious releases
# ship as patch/minor bumps that carets would auto-adopt.
exact = true

# Only install versions published at least 3 days ago, so poisoned
# releases get caught and unpublished before they can reach us.
minimumReleaseAge = 259200 # seconds = 3 days

# Packages exempt from the age gate. Keep empty; add entries only with
# an explicit user decision.
minimumReleaseAgeExcludes = []
```

If `bunfig.toml` already exists, merge these keys into its `[install]`
section instead of overwriting the file.

### 3. Verify Claude Code permissions

Read `.claude/settings.json` and `.claude/settings.local.json` (if present).
Confirm that no `allow` entry auto-approves `Bash(bun add:*)`,
`Bash(bun install:*)`, `Bash(bunx:*)`, or their npm/npx equivalents. If any
exists, remove it and report which. Package installs must always require
manual user approval.

### 4. Add a "Dependency safety" subsection to CLAUDE.md

Place it under "Code style". Content:

```markdown
### Dependency safety

- Never install a package from memory. Before proposing any dependency,
  verify it on the registry (`npm view <pkg>`): exact name, repository
  link, weekly downloads, first-publish date. A young, low-download, or
  name-adjacent package (0auth vs oauth, extra -hf/-js suffixes) is
  presumed squatting — stop and tell the user.
- Never run `bunx`/`npx` with a package that hasn't passed the check
  above — `bunx` bypasses the release-age gate.
- Never pipe remote content into a shell (`curl … | bash`). Show the user
  the URL and what it does instead.
- Never add URL or git dependencies to package.json.
- If a package needs its install scripts, do not add it to
  `trustedDependencies` yourself — surface `bun pm untrusted` output and
  let the user decide.
- CI and hooks install with `bun install --frozen-lockfile`, never plain
  `bun install`.
```

### 5. Document the routine for humans

Append a short "Dependency hygiene" section to README.md:

- Installs happen via `bun add <pkg>` (exact version gets written).
- After install, check `bun pm untrusted`; trust a package only if its
  build genuinely requires scripts (`bun pm trust <pkg>`).
- `bun audit` runs in CI; run it locally before pushing dependency changes.
- Note the two known gaps: the age gate does not re-check versions already
  in `bun.lock`, and `bunx` ignores it entirely.

## Constraints

- Do NOT install, update, or remove any packages in this task.
- Do NOT create `trustedDependencies` or add entries to
  `minimumReleaseAgeExcludes`.
- Do NOT touch CI workflows in this task (audit step lands together with
  the CI pipeline later).
- Keep every file change minimal — no extra config keys beyond the ones
  specified.

## Acceptance criteria

- [ ] `bunfig.toml` exists at repo root with `exact`, `minimumReleaseAge`
      (259200), and empty `minimumReleaseAgeExcludes` under `[install]`.
- [ ] No auto-approve permissions for bun/bunx/npm/npx install commands in
      `.claude/settings*.json`.
- [ ] CLAUDE.md contains the "Dependency safety" subsection verbatim in
      intent (wording may be tightened, rules may not be weakened).
- [ ] README.md contains the "Dependency hygiene" routine.
- [ ] `bun install` (on the empty project) exits cleanly with the new
      config in place.
- [ ] No packages were installed and no trust lists were created.
