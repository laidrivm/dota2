#!/usr/bin/env bash
# Run the database-backed suites against a Postgres that exists to be thrown
# away, and take it down again afterwards.
#
# Without this, `bun test` skips every case that needs a database — every
# patch detection, every reference upsert, every schema constraint, the whole
# staging write, and the snapshot build from its statistics rows to the status
# it settles at — and reports the same green as a run that exercised
# them. CI catches that with a service container and `DATABASE_REQUIRED`; this
# is the same evidence before the push rather than after it.
#
# Arguments are handed to `bun test` unchanged, so a single file can be run:
#   bun run test:db ./src/job/ingest/ingest.test.ts
# The leading `./` is load-bearing: bun matches a bare argument as a substring
# of every path, so `test-db` alone would also run `scripts/test-db.test.ts`.
set -uo pipefail

die() {
	echo "test:db: $1" >&2
	exit 2
}

command -v docker >/dev/null 2>&1 || die "docker is not on PATH"
docker info >/dev/null 2>&1 || die "the docker daemon is not running"

root=$(git rev-parse --show-toplevel) || die "not inside a git repository"

# The image CI runs, read from the workflow rather than written again here: a
# second copy of a digest is a second thing to update, and nothing updates
# either — Dependabot's `github-actions` ecosystem moves only `owner/repo@ref`
# and its `docker` ecosystem reads Dockerfiles, which neither of these is.
image=$(sed -n 's/.*image: \(postgres:[^ ]*\).*/\1/p' \
	"${root}/.github/workflows/test.yml" | head -1)
# Pinned by digest or not at all. A tag such as `postgres:18-alpine` names
# whatever it points at today, which is the whole thing a digest prevents — and
# the workflow losing its own is not a reason for this script to start pulling
# a mutable one.
PINNED='^postgres:[A-Za-z0-9._-]+@sha256:[0-9a-f]{64}$'
[[ $image =~ $PINNED ]] ||
	die "no digest-pinned postgres image in .github/workflows/test.yml: '${image}'"

# Named by this shell's pid, so two runs at once do not collide, and `--rm` so
# a container that outlives a kill takes itself away.
name="d2ass-test-db-$$"

# Emptied until `docker run` hands back an id, and cleanup keyed on the id
# rather than the name. Pids are reused, so a run whose predecessor was killed
# outright can meet that predecessor's container under the name it wants — and
# a cleanup keyed on the name would then stop a container this run never
# started, on its way out of failing to start one.
id=""

cleanup() {
	[ -n "$id" ] && docker stop "$id" >/dev/null 2>&1
	return 0
}
trap cleanup EXIT
# Separately from EXIT, because a trap that does not exit resumes where it
# interrupted: a Ctrl-C inside the readiness loop below would stop the
# container and then go on waiting for it. 128 plus the signal number is what
# a shell killed by one reports.
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

# Bound to the loopback and to a port the kernel picks: the password below is
# a throwaway, and a throwaway password on 0.0.0.0 is an invitation. The port
# is read back rather than fixed, so a Postgres already on 5432 is no clash.
id=$(docker run -d --rm --name "$name" \
	-e POSTGRES_PASSWORD=postgres -p 127.0.0.1::5432 "$image") ||
	die "could not start ${image}"

port=$(docker port "$name" 5432 | head -1 | sed 's/.*://')
[ -n "$port" ] || die "the container published no port"

# Over TCP, not over the socket. The image's entrypoint runs initdb against a
# temporary server started with `listen_addresses=''` — reachable on the unix
# socket and on nothing else — then stops it and starts the real one. A socket
# probe therefore reports ready during that phase, and a connection opened on
# the strength of it is closed a moment later when the temporary server goes
# away. Measured: socket ready at 778 ms, TCP at 842 ms, and every suite opens
# its connection inside that window.
ready=""
for _ in $(seq 1 60); do
	if docker exec "$name" pg_isready -h 127.0.0.1 -q 2>/dev/null; then
		ready=1
		break
	fi
	sleep 0.5
done
[ -n "$ready" ] || die "the database never became ready"

# All three, and each says something the others cannot. The URL says where;
# `DATABASE_DISPOSABLE` says the database may be emptied, which these suites
# do; `DATABASE_REQUIRED` says a skip here is a failure, which is what makes
# the run evidence rather than a green nobody earned.
DATABASE_URL="postgres://postgres:postgres@127.0.0.1:${port}/postgres" \
	DATABASE_DISPOSABLE=1 \
	DATABASE_REQUIRED=1 \
	bun test "$@"
