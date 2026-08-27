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
RUN bun install --frozen-lockfile

# `dist/` is excluded from the context on purpose — a developer's own is stale
# — so the built bundle arrives from the stage that built it.
COPY --from=build /app/dist ./dist

# The server, the job being the entry point that has to be asked for.
CMD ["bun", "src/server/server.ts"]
