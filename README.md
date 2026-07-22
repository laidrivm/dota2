# dota2

## Knowledge ownership map

| File | Owns | Read |
|------|------|------|
| `CLAUDE.md` | agent rules, code style, API contract, fix & capture loop | every session |
| `PLAN.md` | implementation queue, statuses, accepted decisions | every session |
| `tasks/*.md` | infra task specs — scope, steps, acceptance criteria | when a task starts |
| `spec-inbox/` (gitignored) | raw product specs not yet in the repo | when a task cites one |
| `openspec/config.yaml` → `context:` | architecture choices (SSE, BFF, cache, N+1) | on artifact generation |
| `openspec/config.yaml` → `rules:` | artifact shape requirements (referencing CLAUDE.md) | on artifact generation |
| skills repo (private, symlinked into `.claude/skills/`) | how reviews are run (triage/zombies/warm) | on skill invocation |

One fact lives in exactly one file; everything else links to it.

## Tooling

- `bun run lint` — Biome check (format + lint, CI mode)
- `bun run lint:fix` — Biome with autofix
- `bun run lint:yaml` — YAML syntax check via `Bun.YAML` (no deps)
- `bun run typecheck` — `tsc --noEmit`, strict
- actionlint validates `.github/workflows/*` in CI (pinned Docker image);
  locally: `brew install actionlint` if you want the same check.

## Git hooks

Installed automatically by `bun install` (the `prepare` script runs
`simple-git-hooks`); config lives in `package.json`.

- **pre-commit** — `biome check --staged`: blocks the commit if any staged
  file has format/lint problems. It does **not** autofix (simple-git-hooks
  can't re-stage) — run `bun run lint:fix`, re-stage, commit again.
- **pre-push** — `tsc --noEmit` then `bun test`. `--pass-with-no-tests`
  lets the push through while the repo has zero test files; drop that flag
  once phase-1 tests land if you want an empty suite to block a push.
- `--no-verify` bypasses a hook — an emergency exit, not a workflow. CI
  (`lint.yml`) re-runs the whole-repo checks when a PR is opened or updated,
  so a bypassed hook only delays the failure until then.

## Dependency hygiene

- Install via `bun add <pkg>` — the exact version gets written
  (`exact = true` in `bunfig.toml`), and only versions at least 3 days
  old resolve (`minimumReleaseAge`).
- After an install, check `bun pm untrusted`; trust a package
  (`bun pm trust <pkg>`) only if its build genuinely requires
  lifecycle scripts.
- `bun audit` runs in CI; run it locally before pushing dependency
  changes.
- Known gaps: the age gate does not re-check versions already pinned in
  `bun.lock`, and `bunx` ignores it entirely — vet anything you `bunx`.
