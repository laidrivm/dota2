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

- [x] 1.1 Write `checks/container-image.test.ts`: a `FROM` line carrying no
      `@sha256:` fails; a `docker` ecosystem entry that is absent, that names
      a directory the `Dockerfile` does not sit in, or whose schedule,
      cooldown or grouping differs from the entries already in the file each
      fail; this repository passes.
      (Req: container-image — Every base image is pinned by digest, and a
      named updater raises it)
- [x] 1.2 Write the build-context cases, one per category the requirement
      names: the built image holds no `.git`; no `.env` when one is present in
      the context, and no `.env.example`, which is tracked and therefore in
      every context; a `node_modules` that is the production install rather than
      the host's copy; no `.claude/` and no `openspec/`; and none of
      `test-results/`, `playwright-report/`, `reports/` or `.stryker-tmp/`.
      Docker-gated.
      (Req: container-image — The build context carries nothing the image
      must not hold)
- [x] 1.3 Add the multistage `Dockerfile` with its base pinned by digest, and
      `.dockerignore` written as what it excludes.
      (Req: container-image — Every base image is pinned by digest, and a
      named updater raises it / The build context carries nothing the image
      must not hold)
- [x] 1.4 Add the `docker` ecosystem entry to `.github/dependabot.yml`, on the
      schedule, cooldown and grouping the existing entries carry.
      (Req: container-image — Every base image is pinned by digest, and a
      named updater raises it)
- [x] 1.5 Add `Dockerfile` and `.dockerignore` to `scripts/repo-layout.ts`'s
      exemption list, each with the reason it sits at the root, and reconcile
      the README layout section. `docker-compose.yml` is Task 3.4's, not this
      one's: `stray()` reports an entry naming a file the repository does not
      track, so exempting it before the file exists fails the check this
      bullet is written to satisfy.
      (Req: repo-layout — The repository root holds only what is exempted by
      name)
- [x] 1.6 Add `scripts/test-docker.sh` and a `test:docker` script, plus the CI
      job that runs it and fails when the cases skipped.
      (Req: none — the harness the Docker-gated cases above run under. A
      suite that skips in the job that owns it is a suite that failed.)

## 2. The image: the production install and both entry points

- [x] 2.1 Write the install cases: the production stage's install command
      carries `--frozen-lockfile`, `--production` and `--ignore-scripts`, read
      from the `Dockerfile` because the last of the three has no consequence
      the rest of this bullet reaches; the container's effective uid is not
      `0`; a package listed only under `devDependencies` is absent from the
      image; a `package.json` naming a version the lockfile lacks fails the
      build rather than resolving afresh. Docker-gated but for the first.
      (Req: container-image — The production stage installs only what a run
      needs)
- [x] 2.2 Write the entry-point cases: the image run with no command serves
      the application; a font the build copied is answered from the image
      rather than `404`; `/snapshot.json` answers with the committed fixture
      against an empty publication directory; the job entry point run without
      `BUNDLE_DIR` exits non-zero naming that variable. Docker-gated.
      (Req: container-image — One image carries both entry points and
      everything each reads)
- [x] 2.3 Write the mount-point cases: a named volume mounted at the
      publication path is written by the non-root job; an image holding any
      file under `snapshot/` or `icons/` fails the check.
      (Req: container-image — One image carries both entry points and
      everything each reads)
- [ ] 2.4 Make the production stage install with `--frozen-lockfile
      --production --ignore-scripts` and run as the non-root `bun` user.
      (Req: container-image — The production stage installs only what a run
      needs)
- [ ] 2.5 Carry `src/`, `dist/`, `package.json` and `tsconfig.json` into the
      production stage, and create `snapshot/` and `icons/` empty and owned by
      `bun`.
      (Req: container-image — One image carries both entry points and
      everything each reads)

## 3. The compose project

- [ ] 3.1 Write `checks/deployment-topology.test.ts` over the compose file: no
      service binds a host port; the database attaches to the project's
      private network and not to the shared proxy network; the application and
      the job attach to both and mount both named volumes at the paths the
      server resolves; and the application service declares a fixed
      `container_name`, which is what the README's virtual host resolves it
      by.
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
      that stay up and none on the job. Add it to `scripts/repo-layout.ts`'s
      exemption list here, which is where Task 1.5 left it — the entry and the
      file it names arrive together or the check fails.
      (Req: deployment-topology — The application is reachable only through
      the proxy / The database is reachable only from this project / The
      bundle and the icon mirror are one set of files, shared)
- [ ] 3.5 Add the deployment's variables to `.env.example` if the compose file
      introduces any the four already there do not cover.
      (Req: none — `.env.example` documents what a run reads, and the four
      variables already there are the whole of it unless compose adds one.)

## 4. Deploy: the gate and the tags

- [ ] 4.1 Write `checks/deploy-workflow.test.ts` for the gate: assert that
      every job that builds, pushes or reaches the host has all four of the
      linter, type-check, unit and end-to-end workflows in its `needs:` chain,
      so a failing check leaves none of the three able to run, and a chain
      missing one fails the case; each of those four workflows carries a
      `workflow_call:` trigger; the deploy workflow spells out no check's own
      command.
      (Req: deploy-workflow — A deploy runs only against a commit the checks
      have passed)
- [ ] 4.2 Write the tag cases: both `latest` and the commit SHA appear as push
      tags; the reference handed to the compose project on the host is the SHA
      and never `latest`; and the README names the rollback.
      (Req: deploy-workflow — Every deployed image is named by the commit it
      was built from)
- [ ] 4.3 Add `workflow_call:` to `lint.yml`, `test.yml`, `e2e.yml` and the
      type-check's workflow, changing nothing else in them.
      (Req: deploy-workflow — A deploy runs only against a commit the checks
      have passed)
- [ ] 4.4 Add `.github/workflows/deploy.yml`, triggered on push to `main`,
      with those four as `needs:`, buildx, `cache-from/to: type=gha`, and both
      tags pushed to the public Docker Hub repository. Assert the trigger in
      4.1's file: a workflow that runs on nothing deploys nothing, and one
      that runs on a wider trigger deploys more than a merge.
      (Req: deploy-workflow — A deploy runs only against a commit the checks
      have passed / Every deployed image is named by the commit it was built
      from)

## 5. Deploy: replacement order, secrets, and the workflow's own hygiene

- [ ] 5.1 Write the ordering cases: the pull step precedes every step that
      stops or replaces the running container, and a pull that cannot succeed
      ends the host script before any of them runs, leaving the container that
      was serving still up.
      (Req: deploy-workflow — The running container is replaced only once its
      replacement is on the host)
- [ ] 5.2 Write the secrets cases in both directions: the registry, image
      repository and container names are read from `env:` and never from
      `secrets`; the Docker Hub token, the SSH private key and the SSH host,
      port and user are each read from `secrets` and never written in the
      open; the deploy job declares `environment: production`.
      (Req: deploy-workflow — A value is a secret only when disclosing it
      would grant something)
- [ ] 5.3 Write the hygiene cases: an action named by tag fails; a SHA with no
      version comment beside it fails; the workflow's `permissions:` grants
      exactly the scopes it uses, so a block widened to `write-all` fails
      while the declared set passes; the workflow declares a concurrency
      group; a `run:` block interpolating a `github.event.*` value fails.
      (Req: deploy-workflow — The deploy workflow is held to the hygiene the
      others already practise)
- [ ] 5.4 Vet `appleboy/ssh-action` as a dependency before pinning it — repo
      activity, usage, open issues about the credential path — and record the
      vetting in the pull request.
      (Req: deploy-workflow — The deploy workflow is held to the hygiene the
      others already practise)
- [ ] 5.5 Add the host steps to `deploy.yml`: pull first, then bring the
      project up — both on the commit's SHA, passed in so the compose file
      resolves it rather than a mutable tag.
      (Req: deploy-workflow — The running container is replaced only once its
      replacement is on the host / Every deployed image is named by the
      commit it was built from)

## 6. The schedule

- [ ] 6.1 Write the record cases: a run that completes leaves the start
      instant and a zero status with nothing between them; a run that fails
      leaves the report naming the step and a non-zero status. Docker-gated.
      (Req: snapshot-schedule — Every invocation leaves a record of when it
      ran and how it ended)
- [ ] 6.2 Write the exclusion cases, each against a run that is actually in
      flight rather than against the interval: a second invocation starts no
      second job container and leaves the first untouched; its status is `99`,
      which the job itself never emits; an invocation after the run has
      ended starts normally; a run killed outright leaves the next invocation
      able to start. Docker-gated.
      (Req: snapshot-schedule — A second run cannot start while one is in
      flight)
- [ ] 6.3 Write the case that one invocation runs a job container to
      completion and removes it. Docker-gated.
      (Req: snapshot-schedule — The job runs on a schedule outside the
      application)
- [ ] 6.4 Settle what the entry still leaves open — the lock path, the log
      path and the hour — and record the whole line in the README as the one
      to install. The conflict status is not among them: `snapshot-schedule`
      fixes it at `99`, and the entry cites that rather than choosing again.
      (Req: snapshot-schedule — The job runs on a schedule outside the
      application / Every invocation leaves a record of when it ran and how
      it ended / A second run cannot start while one is in flight)

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
      (Req: deploy-workflow — Every deployed image is named by the commit it
      was built from)
- [ ] 7.3 Write the README bootstrap sequence in the order the design fixes,
      and name the host's empty certbot renewal hooks as a thing this
      deployment inherits.
      (Req: none — the host bootstrap is state outside the repository, which
      no criterion of this change reaches.)
- [ ] 7.4 Tick this change's steps in `PLAN.md` as they merge, and collapse
      its queue entry when the last one does. The three entries the proposal
      stage owed — the alert moving to Task 5, the VPS's renewal hooks, and
      workflow hygiene being stated nowhere — were written when the decisions
      were taken and are not this step's.
      (Req: none — queue bookkeeping, which `CLAUDE.md` requires and no
      capability states.)

This step closes no acceptance criterion of its own beyond 7.1's, which
belongs to `app-shell` and is verified rather than added here.
