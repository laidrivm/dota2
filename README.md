# d2ass

## Knowledge ownership map

| File | Owns | Read |
|------|------|------|
| `CLAUDE.md` | agent rules, fix & capture loop; indexes `docs/` | every session |
| `docs/code-style.md` | the ponytail ladder, dependency safety, accessibility | before adding code or a dependency |
| `docs/api-design.md` | endpoint response contract | when an endpoint changes |
| `docs/testing.md` | what tests assert, how a test cites the criterion it closes, e2e rules | when tests change |
| `docs/feature-workflow.md` | the four OpenSpec stages and their gates | on any feature, new tooling, or gate change |
| `docs/git-and-prs.md` | branch and commit shape, PR description, and the git mechanics that protect the history | before branching, committing or opening a PR |
| `docs/review-toolkit.md` | which review skill to run, the pre-PR sequence, and the commit each shared-repo gate was verified against | before every PR |
| `docs/verification.md` | what counts as evidence for a claim | before a claim or a decision rests on one |
| `docs/rulebook-growth.md` | what a fired maintenance trigger asks for: how a rule leaves a sublist, how a section leaves an always-on file | when a rule or a section is added, promoted or deleted |
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
| `scripts/file-size.ts` | how long a file of each type may be, and which types are capped at all | when a file grows past its cap |
| `scripts/spec-coverage.ts` | how many acceptance criteria no test cites, and why that floor last moved | when a criterion or the test citing it changes |
| `scripts/spec-criteria.ts` | what an acceptance criterion is and how its identifier is derived | when a scenario heading is renamed |
| `scripts/mutation-floor.ts` | how many mutants survive in `src/model.ts`, and why that floor last moved | when the model's arithmetic or its tests change |
| `.coderabbit.yaml` | how CodeRabbit reviews this repo | when the bot reviews the wrong things |
| `.claude/skills/` — symlinks into the [skills repo](https://github.com/laidrivm/skills) | the review skills' own text, which is untracked here | on skill invocation |

One fact lives in exactly one file; everything else links to it.

## Where each kind of file lives

| Directory | Holds |
|-----------|-------|
| `src/app/` | the client: components, their stylesheets, and the state they read |
| `src/fixtures/` | the snapshot the client is served until the pipeline publishes one |
| `src/job/` | the nightly job's shared edge — the database connection and the schema it applies |
| `src/job/ingest/` | the pulls, the transport that paces them, and the staging write |
| `src/job/build/` | turning staging into a snapshot: the arithmetic, and the lifecycle around it |
| `src/job/export/` | rendering that snapshot as the bundle the client fetches, and publishing it |
| `src/server/` | the HTTP server, its two route modules, and what they serve |
| `checks/` | assertions about this repository's own artefacts — the rules, the permission policy, the commit gates |
| `scripts/` | executable gates and the dev entry point, each with its tests beside it |
| `e2e/` | the Playwright specs, which Bun's runner is configured to skip |

The tree is cut by what a file is *for*, not by what it is written in, because
the questions that get asked of it are "what does the served container need"
and "what does the cron job need" — and a tree sorted by language answers
neither. One `src/` rather than three top-level directories, because the
client, the model and the job already shared it and splitting them would
rewrite the import rule `biome.json` enforces to buy nothing but a shorter
`COPY` line.

Three things the table cannot state. The prediction model — `src/model.ts` and
`src/types.ts` with their tests — sits directly in `src/`, being neither
client nor job but read by both. `src/job/main.ts` will be the job's entry
point: a row asserts a tracked file *under* a path, which cannot express a
path that is itself the file. And `icons/` and `snapshot/` are where the job
writes at runtime — the mirrored hero images, and the bundle the export
publishes; both are gitignored, so no clone has either until a run fills it.

The table covers the directories that hold code, and leaves out four that
hold something else: `docs/`, `openspec/` and `tasks/`, whose contents the
knowledge ownership map above assigns, and `spec-inbox/`, whose contents are
gitignored. `.github/` and `.claude/` are configuration read from where the
tools expect it. The client's own internal layout — `src/app/board/`,
`src/app/picker/`, the stylesheets and their tokens — is left out too: the
`src/app/` row is the answer for all of it.

Both of those lists are checked rather than merely written down.
`checks/readme-layout.test.ts` refuses a tracked file whose directory neither
appears in the table nor is exempted with a reason, so a new `src/worker/`
fails until somebody decides which it is. Every tracked file left at the
repository root is named in `scripts/repo-layout.ts` the same way. Both are
scoped by what they exempt rather than by what they cover, because a list of
what is covered passes in silence on the first thing nobody thought of.

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
- `bun run test:db` — the same suite against a throwaway Postgres in Docker,
  started from the image CI pins and taken away afterwards. Without it the
  database-backed cases skip: every patch detection, every reference upsert,
  every schema constraint, the whole staging write, and the snapshot build
  from its statistics rows to the status it settles at. Arguments pass through,
  so `bun run test:db ./src/job/ingest/ingest.test.ts` runs one file — the `./`
  matters, since a bare argument is matched as a substring of every path.
- `bun run test:docker` — the same suite with a Docker daemon behind it and a
  skip treated as a failure. Without it the container-gated cases skip, which
  today means the build context: what a developer's checkout sent to the
  builder, and what the image was therefore allowed to keep. It builds one
  image from a context it fabricates — every file the working tree holds that
  `.gitignore` does not cover, plus a planted `.git`, a `.env` carrying a
  sentinel, a marked `node_modules` and a stale `dist/` — and every gated case
  reads that one image. Arguments pass through as `test:db`'s do.
- `bun run test:coverage` — the same suite with Bun's built-in coverage
  reporter. The number is visibility, not a gate: no threshold is configured
  and none should be added without a decision made against real numbers.

The snapshot is `src/fixtures/snapshot.json` until the Phase 3 pipeline
exists; the client only ever knows the URL `/snapshot.json`
(`src/app/snapshot.ts`).

## Deploying it

A push to `main` runs `.github/workflows/deploy.yml`: it calls the lint, test
and e2e workflows against that commit, and only then builds the image and
pushes it to Docker Hub under two tags — `latest`, which names the newest
build for a reader, and the commit's SHA, which is what the host actually
runs.

To roll back, set `D2ASS_IMAGE` on the host to a previous commit's SHA tag —
`laidrivm/d2ass:<sha>`, which no later deploy overwrites — then
`docker compose pull && docker compose up -d`. That is the whole of it.

### The nightly job

The job is not a service — it is a process that exits — so the host's cron is
what starts it, and the schedule lives outside the compose project so that
either can change without restarting the other. One entry, installed with
`crontab -e` as the user that owns the project directory:

```sh
17 4 * * * { date -Iseconds; flock -n -E 99 /var/lock/d2ass-job.lock docker compose --progress quiet -f /root/d2ass/docker-compose.yml run --rm job; echo "exit $?"; } >> /var/log/d2ass-job.log 2>&1
```

On one line, because a crontab has no continuation — a line broken over two is
two entries, the second of which is not a schedule. And with no `%` anywhere
in it, which crontab turns into a newline instead of passing on.

- **04:17, host time.** Off the hour, so the run does not queue behind
  everything else on the box that fires on one.
- **`flock -n` refuses a second run rather than queueing it.** The case it
  exists for is a run still going when the next invocation arrives: two builds
  in flight validate against the same older snapshot, and the smaller then
  publishes over the larger. `-E 99` is the status a refusal ends with, and it
  is not a small number by accident — the job itself exits `0` or `1` and
  nothing else, so a refusal carrying either would be one the record cannot
  tell from a run. The lock is a descriptor held by the run's processes and
  released by the kernel however they ended, so a run killed outright does not
  wedge the schedule — clearing one by hand means killing the run, not the
  shell that started it, since the descriptor is inherited downwards.
- **`/var/log/d2ass-job.log` is the whole of the reporting.** The instant the
  run began, whatever it wrote, and the status it ended with — the three
  answer *did it run*, *why did it break* and *did it break at all*, and none
  of them substitutes for another. Nothing reads the file: this deployment
  ships no alert, and giving the record a reader belongs to the change that
  adds error tracking. It grows by a few lines a day and wants `logrotate`
  only if that ever stops being true.
- **`--progress quiet` keeps compose's own progress out of it**, so a run that
  succeeds leaves two lines and a run that fails leaves the report between
  them.

`checks/snapshot-schedule.test.ts` and its exclusion half read that line out of
this file and run it, so the block above is the entry rather than a picture of
one.

## E2E smoke suite

`bunx playwright test` — Chromium only. The runner starts `bun run dev`
itself and, outside CI, reuses an instance already listening on the dev
server's port (`BUN_PORT`/`PORT`, else 3000 — the same precedence `Bun.serve`
uses, so both sides agree).
`--repeat-each=3` is the flake gate a change has to clear before CI sees it.

Three specs, covering the paths `bun test` cannot reach without a DOM.

`e2e/smoke.spec.ts` — the paths a user walks:

- Setup completed by keyboard alone — named radio groups, arrow keys within
  a group, a focus ring that only `:focus-visible` draws.
- Both choices collapse Setup into the board, and a reload restores them.
- The `R`/`D` and `1`–`5` document hotkeys with nothing focused.
- A cold-cache snapshot failure, and retry recovering without a navigation.
- An axe scan on every state above, asserting zero violations. A rule is
  never excluded without a user decision recorded at the exclusion site.

`e2e/board.spec.ts` — the board's own paths, and the three mechanisms the
move to CSS modules put under them: a removal control revealed by a custom
property, mirroring as a property of the grid, and the walk from a control
up to its row through `data-` markers rather than class names the bundler
now owns. It carries the suite's one fixture, a set-up session.

`e2e/static-build.spec.ts` — `dist/` on a plain static file host, which is
what `app-shell` claims of the production build. It builds into a directory
of its own and serves it with Python's `http.server`, so the dev server the
other two run against is neither used nor disturbed, and asserts that the
page reaches Setup having asked nothing of anywhere else.

New e2e tests arrive one way: a `/zombies` finding marked `(e2e candidate)`.
The backlog is the **(e2e)** bullets in the archived `draft-board` and
`hero-picker` task lists.

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
- **pre-push** — the CI gates that can refuse a push, about 20 seconds:
  `openspec/specs/commit-gates/` names them and is the one place that does,
  so this list is deliberately not repeated here. `actionlint` and
  `gitleaks` run only if they are on `PATH`; a clone without them still
  pushes. `bun test` keeps `--pass-with-no-tests`, now vestigial (the suite
  is non-empty); removing it changes a gate, so it goes through the OpenSpec
  cycle rather than a drive-by edit.
- Bypassing a hook is governed by `docs/git-and-prs.md`, not here. What this
  file adds is the consequence: CI re-runs everything when a PR is opened or
  updated, plus the browser suite and the coverage report, which the hook does
  not — so a bypass only delays the failure until then.

## Getting the review skills

`CLAUDE.md` requires a review pass before every PR, and the skills that run
it do not ship here: `.claude/skills/` is gitignored and holds symlinks into
[laidrivm/skills](https://github.com/laidrivm/skills), so a clone has
neither. Clone that repo and run, from its root:

```sh
./link.sh all <path-to-d2ass>
```

That supplies every slash command the pre-PR sequence names — `/zombies`,
`/warm`, `/triage`, `/coderabbit-local`; its first step is `bun run
diff-budget`, a script in this repository. `/ponytail-review` comes from the
ponytail plugin instead, and is available rather than a gate.

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
