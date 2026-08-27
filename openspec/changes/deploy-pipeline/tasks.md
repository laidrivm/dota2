# Deploy pipeline — tasks

Test tasks are derived from the proposal-stage `/zombies` run and are written
before the code they cover (`docs/testing.md` — TDD for edge cases).

Two kinds of test appear here. Ones that read a file — the `Dockerfile`, the
compose file, a workflow — run under `bun test` like any other. Ones that need
a container run to mean anything are gated on Docker being present and skip
without it, following `scripts/test-db.sh` and `bun run test:db`; a suite that
skips in the job that owns it is a suite that failed, so the CI job supplies
Docker and asserts the cases ran.

Bullets marked **(e2e)** belong to the Playwright suite.

Two findings of the `/zombies` pass are recorded as dispositioned rather than
carried: an empty icon directory answering `404`, and an image built without
`dist/`. The first is what `static-routes.test.ts` already asserts of the
route and a container adds nothing to it; the second cannot be reached,
because the build stage failing to produce `dist/` fails the image build.

## 1. The image: pinning, build context, and something that runs

- [ ] 1.1 Write `checks/container-image.test.ts`: a `FROM` line carrying no
      `@sha256:` fails; a digest-pinned `Dockerfile` with no `docker`
      ecosystem entry covering its directory fails; this repository passes.
      (Req: container-image — Every base image is pinned by digest, and a
      named updater raises it)
- [ ] 1.2 Write the build-context cases: the built image holds no `.git`, no
      `.env` when one is present in the context, and a `node_modules` that is
      the production install rather than the host's copy. Docker-gated.
      (Req: container-image — The build context carries nothing the image
      must not hold)
- [ ] 1.3 Add the multistage `Dockerfile` with its base pinned by digest, and
      `.dockerignore` written as what it excludes.
- [ ] 1.4 Add the `docker` ecosystem entry to `.github/dependabot.yml`, on the
      schedule, cooldown and grouping the existing entries carry.
- [ ] 1.5 Add `Dockerfile`, `.dockerignore` and `docker-compose.yml` to
      `scripts/repo-layout.ts`'s exemption list, each with the reason it sits
      at the root, and reconcile the README layout section.
      (Req: repo-layout — The repository root holds only what is exempted by
      name)
- [ ] 1.6 Add `scripts/test-docker.sh` and a `test:docker` script, plus the CI
      job that runs it and fails when the cases skipped.

## 2. The image: the production install and both entry points

- [ ] 2.1 Write the install cases: the container's effective uid is not `0`; a
      package listed only under `devDependencies` is absent from the image; a
      `package.json` naming a version the lockfile lacks fails the build
      rather than resolving afresh. Docker-gated.
      (Req: container-image — The production stage installs only what a run
      needs)
- [ ] 2.2 Write the entry-point cases: the image run with no command serves
      the application; a font the build copied is answered from the image
      rather than `404`; `/snapshot.json` answers with the committed fixture
      against an empty publication directory; the job entry point run without
      `BUNDLE_DIR` exits non-zero naming that variable. Docker-gated.
      (Req: container-image — One image carries both entry points and
      everything each reads)
- [ ] 2.3 Write the mount-point cases: a named volume mounted at the
      publication path is written by the non-root job; an image holding any
      file under `snapshot/` or `icons/` fails the check.
      (Req: container-image — One image carries both entry points and
      everything each reads)
- [ ] 2.4 Make the production stage install with `--frozen-lockfile
      --production --ignore-scripts` and run as the non-root `bun` user.
- [ ] 2.5 Carry `src/`, `dist/`, `package.json` and `tsconfig.json` into the
      production stage, and create `snapshot/` and `icons/` empty and owned by
      `bun`.

## 3. The compose project

- [ ] 3.1 Write `checks/deployment-topology.test.ts` over the compose file: no
      service binds a host port; the database attaches to the project's
      private network and not to the shared proxy network; the application and
      the job attach to both and mount both named volumes at the paths the
      server resolves.
      (Req: deployment-topology — The application is reachable only through
      the proxy / The database is reachable only from this project)
- [ ] 3.2 Write the shared-files cases: a bundle the job publishes is served
      by the application process that was already running, and an image the
      ingest mirrors is served without a restart. Docker-gated.
      (Req: deployment-topology — The bundle and the icon mirror are one set
      of files, shared)
- [ ] 3.3 Write the case that bringing the project up starts no job container.
      Docker-gated.
      (Req: snapshot-schedule — The job runs on a schedule outside the
      application)
- [ ] 3.4 Add `docker-compose.yml`: the application, its PostgreSQL pinned by
      digest, and the job as a service run on demand; two named volumes; the
      external proxy network and a private one; `restart: always` on the two
      that stay up and none on the job.
- [ ] 3.5 Add the deployment's variables to `.env.example` if the compose file
      introduces any the four already there do not cover.

## 4. Deploy: the gate and the tags

- [ ] 4.1 Write `checks/deploy-workflow.test.ts` for the gate: the deploy job
      depends on the linter, type-check, unit and end-to-end workflows, and a
      deploy job carrying no such dependency fails the check; each of those
      four workflows carries a `workflow_call:` trigger; the deploy workflow
      spells out no check's own command.
      (Req: deploy-workflow — A deploy runs only against a commit the checks
      have passed)
- [ ] 4.2 Write the tag cases: both `latest` and the commit SHA appear as push
      tags, and the README names the rollback.
      (Req: deploy-workflow — Every deployed image is named by the commit it
      was built from)
- [ ] 4.3 Add `workflow_call:` to `lint.yml`, `test.yml`, `e2e.yml` and the
      type-check's workflow, changing nothing else in them.
- [ ] 4.4 Add `.github/workflows/deploy.yml` with those four as `needs:`,
      buildx, `cache-from/to: type=gha`, and both tags pushed to the public
      Docker Hub repository.

## 5. Deploy: replacement order, secrets, and the workflow's own hygiene

- [ ] 5.1 Write the ordering case: the pull step precedes every step that
      stops or replaces the running container.
      (Req: deploy-workflow — The running container is replaced only once its
      replacement is on the host)
- [ ] 5.2 Write the secrets cases: the registry, image repository and
      container names are read from `env:` and never from `secrets`; the
      deploy job declares `environment: production`.
      (Req: deploy-workflow — A value is a secret only when disclosing it
      would grant something)
- [ ] 5.3 Write the hygiene cases: an action named by tag fails; a SHA with no
      version comment beside it fails; the workflow declares `permissions:`;
      the workflow declares a concurrency group; a `run:` block interpolating
      a `github.event.*` value fails.
      (Req: deploy-workflow — The deploy workflow is held to the hygiene the
      others already practise)
- [ ] 5.4 Vet `appleboy/ssh-action` as a dependency before pinning it — repo
      activity, usage, open issues about the credential path — and record the
      vetting in the pull request.
- [ ] 5.5 Add the host steps to `deploy.yml`: pull first, then bring the
      project up on the new image.

## 6. The schedule

- [ ] 6.1 Write the record cases: a run that completes leaves the start
      instant and a zero status with nothing between them; a run that fails
      leaves the report naming the step and a non-zero status. Docker-gated.
      (Req: snapshot-schedule — Every invocation leaves a record of when it
      ran and how it ended)
- [ ] 6.2 Write the exclusion cases, each against a run that is actually in
      flight rather than against the interval: a second invocation starts no
      second job container and leaves the first untouched; its status differs
      from the status a failing run produces; an invocation after the run has
      ended starts normally; a run killed outright leaves the next invocation
      able to start. Docker-gated.
      (Req: snapshot-schedule — A second run cannot start while one is in
      flight)
- [ ] 6.3 Write the case that one invocation runs a job container to
      completion and removes it. Docker-gated.
      (Req: snapshot-schedule — The job runs on a schedule outside the
      application)
- [ ] 6.4 Settle the entry: the lock path, the log path, the conflict status,
      and the hour, and record them in the README as the line to install.

## 7. Documentation, the deferred smoke case, and the plan

- [ ] 7.1 Verify `dist/` served by a plain static file server loads and
      reaches Setup with no other process running — `ui-foundation`
      **(e2e)** 1.5, deferred to this task by Task 4.
      (Req: app-shell — Static production build / Build output is
      self-contained)
- [ ] 7.2 Write the README operations section: how a deploy happens, how to
      roll back by a previous commit's tag, where the secrets live, and the
      nginx virtual host as prose — including that the Cloudflare record must
      be DNS only and that the certificate has to exist before the proxy is
      reloaded.
- [ ] 7.3 Write the README bootstrap sequence in the order the design fixes,
      and name the host's empty certbot renewal hooks as a thing this
      deployment inherits.
- [ ] 7.4 Tick this change's steps in `PLAN.md` as they merge, and collapse
      its queue entry when the last one does. The three entries the proposal
      stage owed — the alert moving to Task 5, the VPS's renewal hooks, and
      workflow hygiene being stated nowhere — were written when the decisions
      were taken and are not this step's.

This step closes no acceptance criterion of its own beyond 7.1's, which
belongs to `app-shell` and is verified rather than added here.
