# d2ass

## Knowledge ownership map

| File | Owns | Read |
|------|------|------|
| `CLAUDE.md` | agent rules, code style, fix & capture loop; indexes `docs/` | every session |
| `docs/api-design.md` | endpoint response contract | when an endpoint changes |
| `docs/testing.md` | what tests assert, e2e rules | when tests change |
| `docs/feature-workflow.md` | the four OpenSpec stages and their gates | on any feature, new tooling, or gate change |
| `PLAN.md` | implementation queue, statuses, accepted decisions | every session |
| `tasks/*.md` | infra task specs — scope, steps, acceptance criteria | when a task starts |
| `spec-inbox/` | raw product specs not yet in the repo — contents gitignored, its README tracked | when a task cites one |
| `openspec/specs/*/spec.md` | what each shipped capability must do (EARS) | when changing behaviour it covers |
| `openspec/config.yaml` → `context:` | architecture choices (SSE, BFF, cache, N+1) | on artifact generation |
| `openspec/config.yaml` → `rules:` | artifact shape requirements (referencing CLAUDE.md) | on artifact generation |
| skills repo (private, symlinked into `.claude/skills/`) | how reviews are run (triage/zombies/warm) | on skill invocation |

One fact lives in exactly one file; everything else links to it.

## Running it

- `bun run dev` — `server.ts` under `--hot` on http://localhost:3000. It
  bundles `index.html` on request and serves the two things the bundler
  cannot: `/fonts/*` and `/snapshot.json`.
- `bun run build` — bundles into `dist/`, then copies the fonts and the
  snapshot in. `dist/` is fully static: `cd dist && python3 -m http.server`
  serves a working app. `server.ts` is the other way to run in production —
  it bundles from source instead of serving `dist/`, so the two are
  alternatives, not a pipeline.
- `bun test` — the whole suite. It shells out to `bun run build` once, so a
  broken copy step or a bundler upgrade that starts inlining the fonts fails
  here rather than in the browser.

The snapshot is `src/fixtures/snapshot.json` until the Phase 4 pipeline
exists; the client only ever knows the URL `/snapshot.json`
(`src/app/snapshot.ts`).

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
- **pre-push** — `tsc --noEmit` then `bun test --pass-with-no-tests`. The
  flag is now vestigial (the suite is non-empty); removing it changes a gate,
  so it goes through the OpenSpec cycle rather than a drive-by edit.
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
