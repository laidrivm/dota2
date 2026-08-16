# d2ass

## Knowledge ownership map

| File | Owns | Read |
|------|------|------|
| `CLAUDE.md` | agent rules, fix & capture loop; indexes `docs/` | every session |
| `docs/code-style.md` | the ponytail ladder, dependency safety, accessibility | before adding code or a dependency |
| `docs/api-design.md` | endpoint response contract | when an endpoint changes |
| `docs/testing.md` | what tests assert, how a test cites the criterion it closes, e2e rules | when tests change |
| `docs/feature-workflow.md` | the four OpenSpec stages and their gates | on any feature, new tooling, or gate change |
| `docs/review-toolkit.md` | which review skill to run, the pre-PR sequence, and the commit each shared-repo gate was verified against | before every PR |
| `docs/verification.md` | what counts as evidence for a claim | before a claim or a decision rests on one |
| `PLAN.md` | the open queue, its sources, and the standing constraints | every session |
| `tasks/*.md` | infra task specs — scope, steps, acceptance criteria | when a task starts |
| `spec-inbox/` | raw product specs not yet in the repo — contents gitignored, its README tracked | when a task cites one |
| `openspec/specs/*/spec.md` | what each shipped capability must do (EARS) | when changing behaviour it covers |
| `openspec/config.yaml` → `context:` | architecture choices (SSE, BFF, cache, N+1) | on artifact generation |
| `openspec/config.yaml` → `rules:` | artifact shape requirements (referencing CLAUDE.md) | on artifact generation |
| `.claude/settings.json` | the agent's permission policy — what is denied, what prompts, what is pre-approved, which hooks run | before granting a tool call |
| `scripts/command-guard.ts` | the git and `gh` prohibitions no permission pattern can express | when a git or `gh` call is refused |
| `scripts/command-parse.ts` | what a shell line resolves to — which commands it runs, under which name | when a call the guard covers is not refused |
| `scripts/no-suppressions.ts` | which linter and type-checker suppressions are approved, and how many | when a suppression is unavoidable |
| `scripts/spec-coverage.test.ts` | how many acceptance criteria no test cites, and why that floor last moved | when a criterion or the test citing it changes |
| `scripts/mutation-floor.ts` | how many mutants survive in `src/model.ts`, and why that floor last moved | when the model's arithmetic or its tests change |
| `.coderabbit.yaml` | how CodeRabbit reviews this repo | when the bot reviews the wrong things |
| `.claude/skills/` — symlinks into the [skills repo](https://github.com/laidrivm/skills) | the review skills' own text, which is untracked here | on skill invocation |

One fact lives in exactly one file; everything else links to it.

## Running it

- `bun run dev` — `scripts/dev.ts` on http://localhost:3000: it clears `dist/`
  as `bun run build` does, bundles into it, rebuilds on a change under `src/`
  or to `index.html`, and starts `server.ts` over the result. Same entry point,
  same bundler, same serving; the one difference is that it does not minify. A
  build left in `dist/` does not survive starting it.
- `bun run build` — the same bundle minified, plus the fonts and the snapshot
  copied in. `dist/` is fully static: `cd dist && python3 -m http.server`
  serves a working app. `server.ts` serves `dist/` too, adding the two routes
  a static server cannot give their headers: `/fonts/*` and `/snapshot.json`.
- `bun test` — the whole unit suite. It shells out to `bun run build` once, so
  a broken copy step or a bundler upgrade that starts inlining the fonts fails
  here rather than in the browser. `e2e/` is excluded (`pathIgnorePatterns` in
  `bunfig.toml`) — those specs belong to Playwright's runner.
- `bun run test:coverage` — the same suite with Bun's built-in coverage
  reporter. The number is visibility, not a gate: no threshold is configured
  and none should be added without a decision made against real numbers.

The snapshot is `src/fixtures/snapshot.json` until the Phase 3 pipeline
exists; the client only ever knows the URL `/snapshot.json`
(`src/app/snapshot.ts`).

## E2E smoke suite

`bunx playwright test` — Chromium only. The runner starts `bun run dev`
itself and, outside CI, reuses an instance already listening on the dev
server's port (`BUN_PORT`/`PORT`, else 3000 — the same precedence `Bun.serve`
uses, so both sides agree).
`--repeat-each=3` is the flake gate a change has to clear before CI sees it.

One spec, `e2e/smoke.spec.ts`, covering the paths `bun test` cannot reach
without a DOM:

- Setup completed by keyboard alone — named radio groups, arrow keys within
  a group, a focus ring that only `:focus-visible` draws.
- Both choices collapse Setup into the board, and a reload restores them.
- The `R`/`D` and `1`–`5` document hotkeys with nothing focused.
- A cold-cache snapshot failure, and retry recovering without a navigation.
- An axe scan on every state above, asserting zero violations. A rule is
  never excluded without a user decision recorded at the exclusion site.

New e2e tests arrive one way: a `/zombies` finding marked `(e2e candidate)`.
The backlog is the **(e2e)** bullets in the archived `draft-board` and
`hero-picker` task lists; the second spec file is where fixtures earn their
existence, which is why this one has none.

e2e never runs in a git hook — it is `e2e.yml` on pull requests, nothing else.

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
- **pre-push** — every CI gate that needs no browser, about 20 seconds:
  `openspec/specs/commit-gates/` names them and is the one place that does,
  so this list is deliberately not repeated here. `actionlint` and
  `gitleaks` run only if they are on `PATH`; a clone without them still
  pushes. `bun test` keeps `--pass-with-no-tests`, now vestigial (the suite
  is non-empty); removing it changes a gate, so it goes through the OpenSpec
  cycle rather than a drive-by edit.
- `--no-verify` bypasses a hook — an emergency exit, not a workflow. CI
  re-runs everything when a PR is opened or updated, plus the browser suite
  and the coverage report, which the hook does not, so a bypassed hook only
  delays the failure until then.

## Getting the review skills

`CLAUDE.md` requires a review pass before every PR, and the skills that run
it do not ship here: `.claude/skills/` is gitignored and holds symlinks into
[laidrivm/skills](https://github.com/laidrivm/skills), so a clone has
neither. Clone that repo and run, from its root:

```sh
./link.sh all <path-to-d2ass>
```

That supplies four of the five commands — `/zombies`, `/warm`, `/triage`,
`/coderabbit-local`. The fifth, `/ponytail-review`, comes from the ponytail
plugin instead.

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
