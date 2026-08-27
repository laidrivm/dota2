# One image, both entry points. The application and the job are the same
# repository on the same runtime and differ by one argument, so a second image
# would repeat the whole dependency install to change a command — and would
# then have to be built, pushed, pinned and rolled back in step with the first.
#
# The base is pinned by digest rather than by `1.3.14-alpine` alone: a tag is
# mutable, so a rebuild of an unchanged commit can otherwise produce a
# different image. The digest is the multi-platform index's rather than one
# platform's manifest, because the VPS is amd64 and a developer's machine may
# not be, and an index resolves for both. Nothing in this file raises it —
# `.github/dependabot.yml`'s `docker` entry is what does, and
# `checks/container-image.test.ts` fails if that entry stops covering this
# directory.
FROM oven/bun:1.3.14-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0 AS build
WORKDIR /app

# The tree, not a copy list. What the image must not hold is stated once, in
# `.dockerignore`, as what it excludes: a file type nobody excluded is a file
# type that ships, where a file type nobody copied is merely missing.
COPY . .

RUN bun install --frozen-lockfile --ignore-scripts
RUN bun run build

FROM oven/bun:1.3.14-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0 AS production
WORKDIR /app

COPY . .

# Each flag closes a distinct hole and none substitutes for another.
# `--frozen-lockfile` refuses to resolve afresh, so the image holds the
# versions the lockfile settled and a drifted manifest fails the build instead
# of shipping. `--production` leaves the development dependencies out, so a
# build-time tool cannot be reached from a running container. `--ignore-scripts`
# means a dependency's install script does not execute during the build, which
# is the position `bunfig.toml` already takes for a local install — and it is
# the one flag with no consequence a running container shows, so
# `checks/container-image-install.test.ts` reads it from this line.
RUN bun install --frozen-lockfile --production --ignore-scripts

# `dist/` is excluded from the context on purpose — a developer's own is stale
# — so the built bundle arrives from the stage that built it.
COPY --from=build /app/dist ./dist

# The two directories the job writes and the server reads, created here and
# left empty.
#
# Created, because Docker creates a missing mount point itself and creates it
# owned by `root`: a named volume mounted where the image holds nothing leaves
# the non-root job below unable to write the bundle it has just built — a
# failure that appears on the first real run and in no build.
#
# Empty, because the server answers both from a listing taken per request, so
# a file shipped at either path is a second source for what it serves, one no
# export can replace. `.dockerignore` is what keeps a developer's own out of
# the context; this line is what makes the directories exist regardless.
#
# `chown` covers the whole tree rather than these two alone: `COPY` above ran
# as root, so every file the image carries is root-owned, and the install
# directory has to be writable by the user that reads it.
RUN mkdir -p snapshot icons && chown -R bun:bun /app

# The base image provides `bun` and defaults to root all the same. Nothing here
# needs to write outside `/app`, and the deploy hands this image a database
# password and a STRATZ key.
USER bun

# The server, the job being the entry point that has to be asked for.
CMD ["bun", "src/server/server.ts"]
