# Task 7 — Docker image + VPS deploy pipeline

## Context

Deployment target is Docker on a VPS (user decision). Pattern source:
mellon/laidrivm.com both build a multistage bun image in CI, push to a
registry, then `ssh` into the VM and `docker compose up -d`. Adopt the
shape, fix the hygiene gaps those repos have (unpinned action tags,
`bun-version: latest`, secrets interpolated into `run:`-adjacent scripts).

Facts you must respect:

- **Precondition**: there is an app to serve (phase-2 UI merged). If not,
  STOP — this task is premature.
- All workflow hygiene rules apply: actions pinned by full commit SHA with
  version comment, `permissions:` minimal, no `github.event.*`
  interpolation in `run:`, concurrency group. `appleboy/ssh-action` is
  third-party: vet it like a dependency before pinning (repo activity,
  usage, known issues) and report the vetting.
- Base images are pinned by digest (`oven/bun:1-alpine@sha256:…`), same
  rationale as action SHAs. Keeping them updated needs a `docker`
  ecosystem entry in `.github/dependabot.yml` — add it as part of this
  task, it does not exist yet.
- The production stage installs with
  `--frozen-lockfile --production --ignore-scripts` and runs as the
  non-root `bun` user (mellon pattern).
- Secrets (registry creds, SSH key) live in a GitHub environment, never in
  the repo; `.env.example` documents runtime variables without values.
- **The snapshot job must not be allowed to overlap itself.** `buildSnapshot`
  reads the newest published snapshot's hero count *before* the transaction
  that settles its own status, so two runs in flight together can both
  validate against the same older count: the larger publishes first, and the
  smaller then publishes against a count nothing holds any more, leaving the
  newest published snapshot below one already published. Every reader — the
  export, and the next patch's blend — takes the newest published snapshot,
  so what they read afterwards is the smaller one.
  The build cannot close this by itself. Postgres runs READ COMMITTED here,
  so moving the count read inside that transaction narrows the window without
  closing it; closing it needs `pg_advisory_xact_lock` or `SERIALIZABLE` with
  a retry, which is a concurrency model no criterion of `snapshot-build`
  states and which the build would then own instead of the schedule. It lands
  here because this task is where the schedule is: whatever runs the job — the
  crontab entry, a compose service, a systemd timer — has to refuse a second
  run while one is in flight, and the refusal has to be exercised rather than
  assumed. Raised by CodeRabbit on PR #183 and dismissed there on exactly this
  reasoning, so it exists in no other artefact.

## Decisions the user makes in this task (ask, don't default)

1. **Registry**: GHCR (`ghcr.io`, auth via `GITHUB_TOKEN`, no extra
   secrets — recommended) vs Docker Hub (what laidrivm.com uses).
2. **Host**: same VPS as mellon/blog or a separate one; affects compose
   network naming and the deploy user.

## Steps

### 1. Dockerfile + .dockerignore

- Multistage: build stage (full install, `bun run build`) → production
  stage (`oven/bun:1-alpine` by digest, prod-only install, `USER bun`,
  `EXPOSE`, CMD). Adapt what the app actually needs at phase 2 (static
  bundle + tiny server, per data-model.md §1).
- `.dockerignore`: node_modules, .git, .github, .env*, .claude, openspec,
  test artifacts (mellon's list, trimmed to what exists here).
- Local proof: `docker build` succeeds, container serves the app,
  `docker run` as non-root confirmed.

### 2. Compose file

- `docker-compose.yml` for the VPS: app service now; postgres joins in
  phase 4 (leave no placeholder service — add it when it exists).
- Named volume + network conventions from mellon; `restart: always`.

### 3. Deploy workflow

- `.github/workflows/deploy.yml` on push to main (after checks pass —
  `workflow_run` chain like laidrivm.com, or a needs-chain in one
  workflow; pick and justify in the PR).
- Jobs: buildx setup → registry login → build+push with
  `cache-from/to: type=gha`, tags `latest` + `${{ github.sha }}` →
  ssh deploy step: pull + `docker compose up -d`.
- GitHub environment `production` gates the deploy job.

### 4. Document

README operations section: how a deploy happens (merge → CI → image →
VPS), how to roll back (previous SHA tag), where secrets live.

## Constraints

- No k8s, no helm, no watchtower, no blue-green — compose up on one VM.
- No staging environment in this task — production only, single VPS.
- Do NOT store any secret value in the repo, including in compose files.
- Do NOT weaken image pinning to mutable tags.

## Acceptance criteria

- [ ] Multistage Dockerfile: digest-pinned base, frozen+production+
      ignore-scripts install, non-root user; local build and run proven.
- [ ] `.github/dependabot.yml` has a `docker` ecosystem entry matching the
      existing ones — weekly, 3-day `cooldown`, grouped — so pinned base
      digests keep getting updated.
- [ ] `.dockerignore` present; image contains no .git/.env/node_modules
      from context.
- [ ] `docker-compose.yml` with app service, named network/volume.
- [ ] deploy.yml: SHA-pinned actions, gha cache, sha+latest tags,
      environment-gated deploy, ssh-action vetted and pinned.
- [ ] Registry and host decisions made explicitly by the user.
- [ ] The snapshot job refuses to start while one of its own runs is in
      flight, and the refusal is proven by a second run attempted against a
      first that is still going — not by reading the schedule and concluding
      the two cannot meet.
- [ ] README documents deploy + rollback.
