#!/usr/bin/env bash
# Run the suite with a Docker daemon behind it, and say that a skip is a
# failure rather than a green nobody earned.
#
# Without this, `bun test` skips every case that reads a real image and reports
# exactly what a run that exercised them reports. Today that is the build
# context: what a developer's checkout sent to the builder and what the image
# was therefore allowed to keep. The rest of the container-gated cases arrive
# with the task groups that own them — the production install and both entry
# points with group 2, the compose project with group 3, the schedule with
# group 6 — and each is gated by this script the moment it is written, so this
# list is what has been implemented rather than what is planned.
#
# Thinner than `scripts/test-db.sh`, which starts a container and takes it away
# again: what these cases need is a daemon, and `checks/docker.fixture.ts`
# builds and reuses the one image between them.
#
# Arguments are handed to `bun test` unchanged, so a single file can be run:
#   bun run test:docker ./checks/container-image-context.test.ts
# The leading `./` is load-bearing: bun matches a bare argument as a substring
# of every path.
set -uo pipefail

die() {
	echo "test:docker: $1" >&2
	exit 2
}

# The daemon, not merely the client: `docker --version` answers on a machine
# whose daemon is stopped, and every gated case here runs a container.
command -v docker >/dev/null 2>&1 || die "docker is not on PATH"
docker info >/dev/null 2>&1 || die "the docker daemon is not running"

# The whole suite rather than the gated files by name, which is
# `scripts/test-db.sh`'s reasoning unchanged: a named list drifts silently,
# because a file added to it later would skip here and report the same green
# as one that ran.
#
# `DOCKER_REQUIRED` is the sentence a reachable daemon cannot say — that a case
# skipping under it is a failure. `checks/docker.fixture.ts` reads it.
DOCKER_REQUIRED=1 bun test "$@"
