# Deploy pipeline — design

## Context

The target is an existing Hetzner VPS already carrying eleven containers — a
blog, mellon and its CouchDB, Synapse and its PostgreSQL, Element, a Stalwart
mail server, and an nginx reverse proxy. Ubuntu 24.04, Docker 29.7.2, Compose
v5.5.0. Everything below was read off that machine rather than assumed, and
three of the readings overturned what `tasks/task-7.md` assumed when it was
written in the phase-2 era.

**nginx is a container, not a host package.** `nginx-proxy` (`nginx:alpine`)
holds `:80`, `:443` and `:5984`, mounts `/root/nginx/conf.d` and
`/etc/letsencrypt` read-only, and sits on an external Docker network called
`web-network`. Every application on the box is reached through it by container
name. There is no `nginx` binary on the host at all.

**Port 3000 on the host is taken** by the blog container, so an application
publishing it would not start.

**Certificates are issued by certbot on the host** (`/etc/cron.d/certbot`) and
DNS is Cloudflare, authoritative but not proxying — `laidrivm.com`,
`mellon.sh` and `matrix.laidrivm.com` all resolve straight to the machine.

Two independent things on that box are broken, and neither is this change's
to fix. Renewal itself fails: four of the five certificates are issued
`authenticator = standalone`, which binds port `80` that `nginx-proxy` holds,
so `certbot renew` reported `2 renew failure(s)` and `fizzbuzz.digital` and
`mellon.sh` expired on 2026-08-21. And delivery fails independently of that:
all three `/etc/letsencrypt/renewal-hooks/` directories are empty, so even a
certificate that did renew never reaches the container, which reads
`/etc/letsencrypt` only at start. Both become a `PLAN.md` entry; the first is
why this change issues its own certificate a different way.

The pattern source named by the task, `laidrivm/mellon`'s `ci.yml`, was read
as well. Its shape is adopted; five of its properties are deliberately not.

## Goals / Non-Goals

**Goals:**

- The application and its database run on the VPS, reachable at
  `https://d2ass.laidrivm.com`, and survive a reboot.
- A merge to `main` reaches the VPS without anyone touching it by hand, and a
  bad release is undone by naming a previous commit.
- The snapshot job runs nightly against that database and cannot overlap
  itself.
- Nothing under `src/` changes.

**Non-Goals:**

- Any alert, any error tracking, any uptime monitoring — Task 5.
- Database backups.
- Repairing the host's certificate renewal.
- Staging, orchestration, zero-downtime deployment.
- Serving anything but this application from the new compose project.

## Decisions

### One image, two entry points

The application and the job are the same repository on the same runtime and
differ by one argument. A second image would repeat the whole dependency
install to change a command, and would then have to be built, pushed, pinned
and rolled back in step with the first.

*Alternative rejected:* separate `Dockerfile.app` / `Dockerfile.job`. It buys
a smaller job image — the job needs no `dist/` — at the cost of two of
everything, for a bundle measured in kilobytes.

### The image carries source, not only the built bundle

`bun build` output alone is not enough to run either entry point. Both are
TypeScript executed by bun directly, and `src/server/static-routes.ts`
resolves three things from *source* paths rather than from `dist/`:
`src/app/styles/fonts/` for the font routes, `src/fixtures/snapshot.json` for
`/snapshot.json` before an export has published, and — for the job —
`src/job/schema.sql`, which `connect()` applies on every connection.

So the production stage carries `src/`, `dist/`, the production
`node_modules`, `package.json` and `tsconfig.json`. This is the failure that
would otherwise appear only at runtime, in a container, and in no build.

An earlier draft said the image would start, serve the page, and answer every
font request `404`. Measured on 2026-08-27 by building exactly that image, it
does not: `staticRoutes()` scans `src/app/styles/fonts/` when it builds the
route map, so a production stage without it throws `ENOENT` at
`static-routes.ts:249` before `Bun.serve` binds, and the container exits. The
correction runs the argument's way — the failure is louder than assumed, not
quieter — and the reason for carrying `src/` is unchanged. It is recorded
because the shape of a failure is what a reader plans around: a crash loop is
watched for differently from a page that renders wrong.

### The two runtime directories are mount points the image creates empty

`snapshot/` and `icons/` are written by the job and read by the server. The
job takes their paths from `BUNDLE_DIR` and `ICONS_DIR`; the server does not —
`static-routes.ts` resolves both relative to the repository root, with no
environment override. Mounting the volumes at `<WORKDIR>/snapshot` and
`<WORKDIR>/icons` therefore satisfies both, and no code changes.

The image must nonetheless create both directories, empty and owned by `bun`.
Docker creates a missing mount point itself and creates it owned by `root`, so
a named volume mounted where the image holds nothing leaves the non-root job
unable to write the bundle it has just built — a failure that appears on the
first real run, in a container, and in no build and no unit test. The first
draft of this design said the opposite; the `/zombies` pass over the proposal
is what caught it.

*Alternative rejected:* give the server its own environment variables. It is a
change to `src/`, a change to `snapshot-delivery`'s reasoning about where the
route reads, and it buys the freedom to mount somewhere else — which nothing
wants.

The server lists both directories per request rather than at start
(`static-routes.ts` says why), so a hero mirrored at 04:00 is served without a
restart. That is what makes a shared mount sufficient and a rebuild
unnecessary.

### Two networks: the shared one for the proxy, a private one for the database

The compose project attaches `d2ass-app` to `web-network` as an external
network and publishes nothing. `nginx-proxy` reaches it as
`http://d2ass-app:3000`, exactly as it reaches `mellon-app`. Publishing a port
would expose the application to the internet unencrypted beside the proxy
that exists to prevent that, and `:3000` is taken regardless.

The database does **not** join `web-network`. That network carries every other
application on the machine — the blog, mellon and its CouchDB, Synapse,
Element, Stalwart — and a PostgreSQL placed on it is reachable by all of them,
guarded by a password in an `.env` file and by nothing else. It joins a second
network private to this project, which the application and the job join as
well. A credential stops a caller who is authorised to try; the network is
what stops one that should never have reached the port.

`Bun.serve` honours `PORT` and falls back to 3000 — measured on bun 1.3.14,
`PORT=4321` producing 4321 and an unset variable producing 3000. The container
takes the default; nothing needs to set it.

### TLS terminates at nginx-proxy, and the certificate must exist first

A virtual host modelled on `/root/nginx/conf.d/mellon.sh.conf`: `listen 443
ssl`, the certificate pair, `include snippets/ssl-params.conf`, and a
`location /` proxying to the container with
`snippets/proxy-headers.conf`. It is documented as prose in the README rather
than committed as a file, because the file that is actually read lives on the
host and a copy in the repository would drift from it silently.

Ordering matters and is why the README states a bootstrap sequence: nginx
refuses to start with a configuration naming a certificate file that is not
there. The DNS record, then the certificate, then the virtual host, then the
reload.

**The challenge is DNS-01 through the Cloudflare plugin, not the default.**
`certbot certonly` defaults to the standalone authenticator, which binds port
`80` — and on this machine `nginx-proxy` holds it, so standalone cannot
complete at all. Webroot would work but needs an
`/.well-known/acme-challenge/` location in the proxy's configuration before
the certificate exists, which inverts the ordering above.

This is not a hypothetical, and the machine already answers it. Of its five
certificates, four are issued `authenticator = standalone` and one —
`laidrivm.com` — is `dns-cloudflare`. The four are exactly the ones that fail:
`certbot renew` reported `2 renew failure(s)` on 2026-08-27, `fizzbuzz.digital`
and `mellon.sh` having passed their renewal window and expired on 2026-08-21,
while the other two standalone certificates were merely skipped as not yet due
and will fail the same way when they are. The one that renews is the one that
never needs port `80`.

So: `dns-cloudflare`, with an API token scoped to the zone, which is the
pattern already working there. DNS is Cloudflare regardless — the record has
to be created by hand anyway — and DNS-01 is indifferent to which process owns
port `80`.

The Cloudflare record must be **DNS only**. Cloudflare defaults a new `A`
record to proxied, and a proxied record would put Cloudflare's own TLS in
front, send the HTTP-01 challenge through their edge, and require an origin
certificate — none of which is how the four neighbouring domains on this
machine work.

### Docker Hub, public

Chosen by the user. Public has a consequence worth naming: the host needs no
`docker login` at all, which removes a credential from the machine and a
class of expiry from the deploy. The image is world-readable, which is
acceptable because it contains this public repository's code and nothing else
— an assertion the `.dockerignore` criteria in `container-image` are what
enforce.

### The deploy is gated by the checks, expressed in the workflow

Every check in this repository triggers on `pull_request` only, so no check
has ever run against a commit on `main`: a squash merge creates an object none
of them saw. Four mechanisms were considered.

| | |
|---|---|
| `workflow_run` chain | Fires when **any** listed workflow completes, not when all do. Wrong shape for six workflows. |
| Branch protection | Not in the tree, not reviewed with the change, overridable by whoever merges. A reader of the workflow cannot see what gates it. |
| Re-run the commands in `deploy.yml` | Duplicates the gate list, which `commit-gates` owns. A second copy drifts. |
| **`workflow_call` + `needs:`** | Each check workflow gains a `workflow_call:` trigger; `deploy.yml` calls them as jobs and depends on them. **Chosen.** |

The gate is then readable in one file, runs against the exact commit, and
adds no copy of any command.

Which checks: the linter, the type check, the unit suite and the end-to-end
suite. Not `diff-budget` — it measures a pull request's shape and has no
meaning on `main`. Not `audit` — it asks whether an advisory exists today, not
whether this commit is sound, and it already runs nightly. Not `mutation` —
it is a floor on test strength, not a statement that the commit works, and it
is the slowest thing in the repository.

### The schedule refuses overlap with `flock`, and the record separates the outcomes

```sh
17 4 * * * { date -Iseconds; flock -n -E 99 /var/lock/d2ass-job.lock docker compose --progress quiet -f /root/d2ass/docker-compose.yml run --rm job; echo "exit $?"; } >> /var/log/d2ass-job.log 2>&1
```

The README holds the installable copy and the checks read it from there; this
one is here for the reasoning around it. Three things it settles that an
earlier draft of this section did not. It is **one line**: a crontab has no
continuation, so the wrapped rendering this replaced was two entries, the
second not a schedule. `date -Iseconds` rather than `-Is`, which is a GNU
shorthand — the spelling both GNU and BSD accept costs nothing and lets the
record's cases run wherever `flock` is. And `--progress quiet`, measured:
without it compose writes network and pull progress to stderr, which the
redirection puts in the record — so a run that succeeded left a dozen lines of
layer downloads rather than the two the requirement is about.

`flock` holds the lock for the lifetime of the process it starts, and the
kernel releases it however that process ends — so a run killed outright does
not wedge the schedule, which no application-level flag or lock file achieves
without a cleanup path of its own.

More exactly, and measured while writing the exclusion cases: the lock is a
descriptor, and a descriptor is *inherited*. `flock` passes it to the `docker
compose` it starts, so the lock is held until the last process of the run
exits, not until `flock` does. It still needs nothing to release it — killing
the whole run releases it, and so does the machine going down — but a kill
that reaches only part of the tree leaves the survivor holding it, and the
next invocation is refused rather than started. Worth knowing if a run is ever
cleared by hand: kill the run, not the shell.

`-E 99` is what makes the entry emit the status `snapshot-schedule` fixes for
a refusal; the reason that value is not `flock`'s own default is stated
there. The `date -Iseconds`
before and the `echo "exit $?"` after are what make the file answer *did it
run*, not only *why did it break* — `run.ts` prints nothing on success, so a
file of reports alone cannot distinguish a healthy schedule from a scheduler
that never fired.

*Alternative rejected:* `pg_advisory_xact_lock` or `SERIALIZABLE` inside
`buildSnapshot`. It covers manual invocations too, which `flock` on one
crontab path does not. It was rejected because the user has said the job will
run on the schedule only, and because it puts a concurrency model inside
`snapshot-build` that no criterion of that capability states — which is the
reasoning `tasks/task-7.md` itself records for parking this with the schedule.
If manual runs start happening, this decision is what should be revisited.

### PostgreSQL in its own container

Its own container, its own named volume, its own credentials, pinned by
digest like every other image here. Synapse's `postgres:15-alpine` on the same
box is untouched and unshared: sharing an instance would couple this
project's availability and its upgrade schedule to Synapse's for no gain.

`src/job/db.ts` applies `schema.sql` on every connect and it is idempotent, so
there is no migration step and nothing to run before the first job.

### What mellon's workflow does that this one will not

Adopted: the `production` environment, buildx, `cache-from/to: type=gha`, the
`latest` + SHA tag pair, `appleboy/ssh-action`.

Not adopted, each a hygiene rule `tasks/task-7.md` names:

- Actions referenced by floating tag (`@v4`, `@v6`, `@v1.2.0`) — pinned here
  by full commit SHA with a version comment, as all six existing workflows
  already are.
- `bun-version: latest` — pinned.
- No `permissions:` block at all — minimal ones here.
- `DOCKER_REGISTRY`, `DOCKER_IMAGE` and `DOCKER_CONTAINER` held as secrets
  though they grant nothing.
- `key:` and `password:` both handed to the SSH action.
- `docker stop`/`rm` **before** `docker pull`, which puts the download inside
  the outage.
- And the defect the `deploy-workflow` capability exists to prevent: its
  deploy job triggers on push while its checks trigger on pull request, so
  nothing connects them.

## Risks / Trade-offs

- **A failed run degrades silently** → the export runs last, so the previously
  published bundle keeps serving and nothing visibly breaks while the data
  ages. Accepted: the log is the record, and Task 5 gives it a reader.
- **Memory is not roomy** — 3819 MB total, ~2567 MB available, eleven
  containers already → PostgreSQL plus the application adds roughly 300–400 MB.
  It fits; the first real ingest is worth watching, since it is the only step
  that pulls and writes in bulk.
- **The new certificate will expire in 90 days exactly as `mellon.sh`'s did**
  → the renewal-hook gap is real and outside this change; the README names it
  and the `PLAN.md` entry carries it, so it is not discovered by an outage.
- **`appleboy/ssh-action` is a third party with the deploy key** → vetted
  here rather than deferred, the design being where the dependency is chosen
  and the looking being cheap. Read on 2026-08-27: 6,179 stars, MIT, not
  archived, last pushed 2026-08-16, releases still cut on a regular cadence
  (`v1.2.5` 2026-01-28, `v1.2.4` 2025-11-28, `v1.2.3` 2025-11-08), 32 open
  issues, none of them a disclosed handling flaw in the credential path. The
  residual risk is structural rather than specific — the private key is handed
  to a third-party action, which is true of every action of this kind — and
  the `production` environment gate is what bounds who can trigger it. Task
  5.4 re-reads this at the moment the SHA is pinned, since the verdict ages
  and the pin is what makes it binding.
- **Host state lives outside the repository** — the virtual host, the crontab
  entry, `.env`, the certificate → a rebuilt VPS is a manual bootstrap. Making
  it reproducible is configuration management, which this deliberately is not.
- **The `workflow_call` trigger widens where the check workflows can be
  invoked from** → they run the same commands whoever calls them, and calling
  them is not a privilege the repository withholds today.

## Migration Plan

Nothing is migrated; there is no prior deployment. The host bootstrap, in
order, all of it manual and all of it in the README:

1. Cloudflare `A` record `d2ass.laidrivm.com` → the VPS, **DNS only**.
2. `certbot certonly --dns-cloudflare` for that name, with a zone-scoped
   API token — never the standalone authenticator, for the reason above.
3. `/root/nginx/conf.d/d2ass.conf`, then reload `nginx-proxy`.
4. `/root/d2ass/docker-compose.yml` and `/root/d2ass/.env`.
5. GitHub `production` environment with its secrets; first deploy.
6. The crontab entry.

Rollback is `docker compose pull` of a previous commit's SHA tag and `up -d`.

**It is safe while every schema change stays additive, and that is a
constraint rather than an observation.** `connect()` reapplies `schema.sql` on
every connection, and applying an *older* `schema.sql` to a newer database is
a no-op: all twenty-one of its statements are `CREATE TABLE IF NOT EXISTS`,
`ADD COLUMN IF NOT EXISTS` or `CREATE INDEX IF NOT EXISTS`, and it carries no
`DROP`, no `ALTER COLUMN`, no `RENAME` and no type change. So a rollback
leaves the newer shape in place and runs the older code against it, which
additive changes survive and nothing else does.

A release that drops a column, narrows a type, or changes what a stored value
means is therefore not rollback-safe, and saying so is this plan's job: the
alternative is discovering it during the rollback. Such a release either ships
its own backward step or is rolled forward instead.

## Open Questions

- The PostgreSQL major version to pin. Nothing in `schema.sql` or `db.ts`
  needs a recent one; the default is the current stable, independent of
  Synapse's 15.
- The hour of the nightly run. `04:17` is proposed for no reason beyond being
  off the hour and outside the working day; if STRATZ's quota window has an
  edge, that is a better reason and this should follow it.
