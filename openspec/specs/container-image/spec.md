# container-image Specification

## Purpose
TBD - created by archiving change deploy-pipeline. Update Purpose after archive.
## Requirements
### Requirement: Every base image is pinned by digest, and a named updater raises it

The `Dockerfile` SHALL reference each base image by digest
(`oven/bun:<version>-alpine@sha256:…`), never by tag alone: a tag is mutable,
so a rebuild of an unchanged commit can produce a different image, and
`commit-gates` already fixes that reasoning for the container images CI runs.

`.github/dependabot.yml` SHALL carry a `docker` ecosystem entry for the
directory the `Dockerfile` sits in, on the same schedule, cooldown and
grouping as the entries already there. Without it the digest is a pin nothing
raises, which is what `CLAUDE.md`'s Safety rule about an untracked pin
forbids — the entry is what satisfies that rule here, in place of a comment.

A check SHALL read both files and fail on either half: a `FROM` line carrying
no `@sha256:`, or a digest-pinned `Dockerfile` that no `docker` ecosystem
entry covers. Review is not the mechanism, because the second half is an
absence and absences are what review misses.

#### Scenario: A base image referenced by tag

- **WHEN** a `FROM` line in the `Dockerfile` names an image without an
  `@sha256:` digest
- **THEN** the check SHALL fail, naming that line

#### Scenario: A digest with no updater

- **IF** the `Dockerfile` pins by digest and `.github/dependabot.yml` carries
  no `docker` ecosystem entry for its directory
- **THEN** the check SHALL fail — the pin would otherwise be raised by
  nobody, and a stale digest reads exactly like a fresh one

#### Scenario: An entry naming another directory

- **IF** the `docker` ecosystem entry names a directory the `Dockerfile` does
  not sit in
- **THEN** the check SHALL fail — an entry that covers nothing raises nothing,
  and it reads from the file exactly like one that does

#### Scenario: An entry on terms of its own

- **IF** the `docker` entry's schedule, cooldown or grouping differs from what
  the entries already in the file carry
- **THEN** the check SHALL fail — the cooldown in particular is what lets a
  poisoned release be unpublished before an update adopts it, and an entry
  that opts out of it is a supply-chain hole with an updater's name on it

#### Scenario: The repository as it stands

- **WHEN** the check runs over this repository after the change
- **THEN** it SHALL report nothing

### Requirement: The production stage installs only what a run needs

The production stage SHALL install with `--frozen-lockfile --production
--ignore-scripts` and the container's process SHALL run as the non-root `bun`
user the base image provides.

Each flag closes a distinct hole and none substitutes for another:
`--frozen-lockfile` refuses to resolve afresh, so the image holds the versions
the lockfile settled and a drifted manifest fails the build instead of
shipping; `--production` leaves the development dependencies out, so a
build-time tool cannot be reached from a running container; `--ignore-scripts`
means a dependency's install script does not execute during the image build,
which is the supply-chain position `bunfig.toml` already takes for a local
install.

Running as that user SHALL grant it no more of the image than a run writes.
Only the two runtime directories SHALL be owned by it; everything the copy and
the install left SHALL stay root-owned, which is readable by any user and
writable by none but root. Reading is the whole of what either entry point
does with its own source, so the wider grant buys nothing and costs the one
thing a non-root user was for — a container that can rewrite the code it is
about to run is a container whose user boundary ends at the first process that
reaches it.

#### Scenario: The install command the production stage runs

- **WHEN** the production stage's install command is read from the
  `Dockerfile`
- **THEN** it SHALL carry `--frozen-lockfile`, `--production` and
  `--ignore-scripts`
- **AND** this SHALL be checked directly rather than through a consequence,
  because `--ignore-scripts` has none that the scenarios below reach: an
  install script that ran during the build leaves every other assertion here
  true

#### Scenario: The running process is not root

- **WHEN** the image's default command is run and the container's user is
  read
- **THEN** it SHALL not be `root`, and the effective uid SHALL not be `0`

#### Scenario: What the container's user may write

- **WHEN** the container writes to a path under the application root that is
  neither of the two runtime directories
- **THEN** it SHALL be refused — the grant is those two, and an image that
  handed its user the whole tree would satisfy every other scenario here

#### Scenario: A development dependency in the image

- **WHEN** the production image is inspected for a package listed only under
  `devDependencies`
- **THEN** that package SHALL be absent

#### Scenario: A manifest the lockfile does not match

- **IF** `package.json` names a version the lockfile does not carry
- **THEN** the image build SHALL fail rather than resolve the dependency
  afresh

### Requirement: The build context carries nothing the image must not hold

A `.dockerignore` SHALL exclude, and the built image SHALL contain none of:
`.git/`; every `.env` file, the committed `.env.example` included, since the
image needs no example either; the host's `node_modules/`; `.claude/` and
`openspec/`; and the run outputs `test-results/`, `playwright-report/`,
`reports/` and `.stryker-tmp/`.

They are named rather than described because a category name is not a
checkable exclusion: "the specification directories" is a phrase two readers
resolve differently, where `openspec/` is a path a test can look for inside an
image. A path added later is admitted by naming it here, which is the decision
being made rather than defaulted — `repo-layout`'s exemption list on the same
terms.

The exclusion is stated as what it removes rather than as a copy list,
because the `Dockerfile` copies the tree: a file type nobody excluded is a
file type that ships. `.env` is the case that matters most — a developer's
own file, holding a STRATZ key and a database password, sitting beside the
`Dockerfile` in the context that is sent to the builder.

#### Scenario: The version control directory

- **WHEN** the built image is inspected at the application root
- **THEN** it SHALL hold no `.git` directory

#### Scenario: A local environment file

- **WHEN** a `.env` file is present in the build context and the image is
  built
- **THEN** the image SHALL hold no `.env` file, and no value from it

#### Scenario: The committed example file

- **WHEN** the image is built from a context holding `.env.example`
- **THEN** the image SHALL hold no `.env.example` — it is tracked, so unlike a
  developer's `.env` it is in every context on every machine, and neither
  entry point reads it

#### Scenario: The host's installed modules

- **WHEN** `node_modules/` is present in the build context
- **THEN** the image's `node_modules` SHALL be the one the production install
  produced, never the host's copy

#### Scenario: The directories no run reads

- **WHEN** the built image is inspected for `.claude/`, `openspec/`,
  `test-results/`, `playwright-report/`, `reports/` and `.stryker-tmp/`
- **THEN** it SHALL hold none of them — neither entry point opens any, and an
  image is where the smallest thing that runs belongs

### Requirement: One image carries both entry points and everything each reads

The image SHALL run `src/server/server.ts` and `src/job/run.ts`, the default
command being the server. They are the same repository on the same runtime,
so a second image would repeat the whole install to change one command.

The image SHALL therefore carry, besides `dist/`, every path either entry
point resolves at runtime: `src/app/styles/fonts/`, which the font routes are
built from; `src/fixtures/snapshot.json`, which `/snapshot.json` answers with
until an export has published; and `src/job/schema.sql`, which the job applies
on connect. Each is resolved from a source path rather than from `dist/`, so
an image carrying only the built bundle does not serve at all: the route map
is built by scanning the font directory, so the server throws before it binds
and the container exits, and the job cannot open a database connection either
— a failure that appears only at runtime, in a container, and not in any
build.

The image SHALL hold `snapshot/` and `icons/` as empty directories owned by
the user the container runs as, and SHALL ship no file in either.

Both halves are load-bearing and for opposite reasons. The directories must
exist, because Docker creates a missing mount point itself and creates it
owned by `root`: a named volume mounted where the image holds nothing leaves
a non-root job unable to write the bundle it just built, which is a failure
no build and no unit test reaches. They must be empty, because the server
lists both per request and answers from the listing, so a file shipped at
either path is a second source for what it serves — one that survives every
export and that no publication can replace.

#### Scenario: The image run with no command of its own

- **WHEN** the image is run with no command given
- **THEN** it SHALL serve the application, the job being the entry point that
  has to be asked for

#### Scenario: A font request before anything has been exported

- **WHEN** the server runs in the container and a request names a font the
  build copied
- **THEN** it SHALL be answered from the image, not `404`

#### Scenario: The snapshot before an export has run

- **WHEN** the server runs in the container with an empty publication
  directory mounted and `/snapshot.json` is requested
- **THEN** the committed fixture SHALL be served, which is the behaviour
  `snapshot-export` already fixes for an absent bundle

#### Scenario: The job entry point in the same image

- **WHEN** the image is run with the job's entry point and no `BUNDLE_DIR`
- **THEN** it SHALL exit non-zero naming that variable, which is reachable
  only if the job and its runtime are in the image at all

#### Scenario: A volume mounted where the image holds no directory

- **WHEN** a named volume is mounted at the publication path and the job runs
  as the image's non-root user
- **THEN** the bundle SHALL be written — the mount point existing in the
  image, owned by that user, is what makes it writable

#### Scenario: A file shipped at a mount point

- **IF** the image holds any file under `snapshot/` or `icons/`
- **THEN** the check SHALL fail — the server answers from its listing of
  those directories, and a shipped file is a source no export can replace

