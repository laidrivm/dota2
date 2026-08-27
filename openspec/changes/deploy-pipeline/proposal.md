# Deploy pipeline

## Why

The application, the snapshot job and the database all exist and none of them
runs anywhere but a developer's machine. Phase 3 finished the job that fills
the bundle; until something schedules it against a database that survives a
reboot, the served snapshot is whatever fixture the build copied in. Task 5 —
error tracking — states a deployed product as its precondition, so this is
what unblocks it.

The schedule is not incidental to the deployment. `buildSnapshot` reads the
newest published snapshot's hero count *before* the transaction that settles
its own status, so two runs in flight together validate against the same older
count and the smaller can publish last, leaving the newest published snapshot
below one already published. Every reader takes the newest published snapshot,
so what they read afterwards is the smaller one. `publishBundle` names the same
hole from the other side and hands it to whatever owns the schedule. This
change is where the schedule arrives, so this is where the refusal lands.

## What Changes

- A multistage `Dockerfile` and `.dockerignore`. One image serves both
  entry points — `src/server/server.ts` and `src/job/run.ts` — because they are
  the same repository on the same runtime and a second image would duplicate
  the whole install to change one command.
- A `docker-compose.yml` for the VPS: the app, its own PostgreSQL, and the job
  as a service run on demand rather than kept up. Two named volumes, both
  written by the job and read by the app.
- A `docker` ecosystem entry in `.github/dependabot.yml`, so a base image
  pinned by digest keeps being updated.
- `.github/workflows/deploy.yml`: build, push to a public Docker Hub
  repository, and bring the VPS up on the new image — gated on the existing
  checks and on a `production` GitHub environment.
- A crontab entry on the VPS that runs the job nightly under `flock`, so a
  second run cannot start while one is in flight.
- README operations: how a deploy happens, how to roll back, the nginx virtual
  host to add, and the manual bootstrap the first deploy needs.
- The automated form of `ui-foundation` **(e2e)** 1.5, which Task 4 deferred to
  this task.
- `PLAN.md` corrections this change's own findings force, all three written at
  the propose stage where the decisions were taken: the failure alert moves
  from the Task 7 entry to Task 5; the VPS's expired certificates and empty
  certbot renewal hooks become a queue entry of their own; and so does
  workflow hygiene, which all six workflows practise and which no rule and no
  criterion states.

## Non-goals

- **No failure alert.** `tasks/task-7.md` lists none among its steps or its
  acceptance criteria, and Task 5 is error tracking with "the product is
  deployed" as its precondition. The crontab entry redirects the job's output
  to a file so the report `run.ts` composes survives; giving it a reader is
  Task 5's. The accepted consequence is that a failed run degrades quietly —
  the export runs last, so the previously published bundle keeps serving.
- **No database backups.** Named as a separate concern by the user.
- **No repair of the host's TLS renewal.** Two certificates on the VPS expired
  on 2026-08-21 and `/etc/letsencrypt/renewal-hooks/` is empty in all three
  phases, so a renewed certificate never reaches the nginx container. Both are
  real and neither is this change's; they become a queue entry.
- No staging environment, no orchestrator, no blue-green, no zero-downtime
  guarantee beyond pulling the image before the container is replaced.
- No change to how the application or the job behaves. The server resolves both
  runtime directories relative to the repository root, so mounting the volumes
  at those paths is what keeps this change out of `src/`.

## Capabilities

### New Capabilities

- `container-image`: what the image contains and what it must not — the
  digest-pinned base, the production install, the non-root user, the build
  context exclusions, and the two entry points one image carries.
- `deployment-topology`: what the compose project exposes and to what — that
  no host port is published, that the database is reachable only from this
  project rather than from every other application on the shared proxy
  network, and that the bundle and the icon mirror are one set of files the
  application and the job share.
- `deploy-workflow`: how a merge to `main` reaches the VPS — what gates the
  deploy, what the image is tagged with, which values are secrets and which are
  not, and how a bad deploy is rolled back.
- `snapshot-schedule`: when the job runs, and the refusal that keeps a second
  run from starting while one is in flight — proven by attempting one, not
  argued from the interval.

### Modified Capabilities

None. `repo-layout` already admits a root file added later — "a container
manifest, a compose file" — by adding its name and its reason to the exemption
list, so new root files are a decision recorded there rather than a requirement
change. `snapshot-export` says "the publication directory" and never names one,
so mounting it is within what it already allows. `app-shell`'s static-build
requirement stays true of `dist/` and is what **(e2e)** 1.5 verifies; that the
deployment serves through `src/server/server.ts` instead does not falsify it,
because the server exists for the headers and for state the job writes at
runtime, neither of which the built bundle depends on.

## Impact

- **New root files**: `Dockerfile`, `.dockerignore`, `docker-compose.yml` —
  each needing an exemption entry with its reason, and the README layout
  section reconciled.
- **New workflow**: `.github/workflows/deploy.yml`, under the same hygiene the
  existing six are held to — actions pinned by full commit SHA with a version
  comment, minimal `permissions:`, a concurrency group, no
  `github.event.*` interpolation in `run:`.
- **New dependency on a third-party action**: `appleboy/ssh-action`, which is
  vetted like a dependency before it is pinned.
- **New pinned artefact**: the base image digest, whose updater is the
  Dependabot entry this change adds — the Safety rule about naming what updates
  a pin is satisfied by that entry rather than by a comment.
- **Secrets**: five, all in the `production` environment — the Docker Hub
  token, the SSH private key, and the SSH host, port and user. The last three
  are secrets because this repository is public and the host does not listen
  for SSH on the default port. The registry, image name and container names
  are not secrets and are written in the open.
- **Host state outside the repository**: the nginx virtual host, the crontab
  entry, the `.env` file and the TLS certificate. Each is documented in the
  README as a bootstrap step rather than applied by the workflow.
- **No change under `src/`.**
