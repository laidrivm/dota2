#!/usr/bin/env bash
# The review budget for one pull request: how many lines a reviewer must
# actually read between <base> and HEAD. Prints one gate line and exits
# non-zero when the diff is over budget or cannot be measured.
set -uo pipefail

WARN_AT=500
FAIL_AT=800

# An unmeasured diff must never read as a passing one, so every way of
# failing to measure leaves through here.
die() {
	echo "DIFF gate: ERROR — $1" >&2
	exit 2
}

base="${1:-}"
if [ -z "$base" ]; then
	# The remote-tracking ref is kept whole: `origin/main` resolves wherever
	# `main` does and also where the local branch was never checked out.
	# Not `rev-parse --abbrev-ref origin/HEAD` — with no origin/HEAD it echoes
	# the argument back, and `HEAD...HEAD` is an empty diff, so every branch
	# would read PASS at 0 lines.
	base=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)
	base="${base:-main}"
fi

git rev-parse --verify --quiet "${base}^{commit}" >/dev/null ||
	die "cannot resolve base ref '${base}'"
git merge-base "$base" HEAD >/dev/null 2>&1 ||
	die "no merge base between '${base}' and HEAD"

# Artefacts nobody reads line by line. Everything else counts, `openspec/**`
# included — a proposal too large to read is the case this gate exists for.
EXCLUDE=(':(exclude)bun.lock' ':(exclude)*.woff2' ':(exclude)src/fixtures/snapshot.json')
# Classification is by pathspec, so `src/app/latest.ts` stays source.
TESTS=('*.test.ts' '*.test.tsx' 'e2e/**')

count() {
	git diff "${base}...HEAD" -- "$@" "${EXCLUDE[@]}" | awk '
		/^diff --git / { inhunk = 0; next }
		/^@@/          { inhunk = 1; next }
		!inhunk && /^\+\+\+ / {
			# A deleted file reads `+++ /dev/null`, which needs no fallback to
			# the `---` header: it contributes removed lines only, and a pair
			# needs one of each.
			path = substr($0, 5)
			sub(/^b\//, "", path)
			next
		}
		!inhunk { next }
		/^[+-]/ {
			sign = substr($0, 1, 1)
			text = substr($0, 2)
			# A task line differs from every other line in one way: ticking it
			# changes state, not content. Only that flip is free.
			if (text ~ /^[ \t]*- \[[ xX]\] /) {
				box = (text ~ /^[ \t]*- \[ \] /) ? " " : "x"
				norm = text
				sub(/- \[[ xX]\] /, "- [] ", norm)
				key = path SUBSEP norm
				seen[key] = 1
				if (sign == "+") add[key, box]++; else rem[key, box]++
				boxes++
				next
			}
			lines++
		}
		END {
			# A pair is one file, one text, opposite boxes: a tick or its
			# reverse. Anything else — a rewritten task, a task moved between
			# files, a task moved with its box unchanged — pairs with nothing
			# and is read like any other line.
			for (key in seen) {
				ticked   = (rem[key, " "] < add[key, "x"]) ? rem[key, " "] : add[key, "x"]
				unticked = (rem[key, "x"] < add[key, " "]) ? rem[key, "x"] : add[key, " "]
				paired += ticked + unticked
			}
			print lines + boxes - 2 * paired
		}
	'
}

# A pipeline that died partway still prints a number, so the exit status is
# what says the count is whole; the numeric test catches an empty half, which
# arithmetic would otherwise read as a zero.
test_lines=$(count "${TESTS[@]}") || die "could not count the tests"
source_lines=$(count . "${TESTS[@]/#/:(exclude)}") || die "could not count the source"
[[ "$test_lines$source_lines" =~ ^[0-9]+$ ]] || die "counted no lines at all"
total=$((source_lines + test_lines))

if [ "$total" -ge "$FAIL_AT" ]; then
	verdict="FAIL"
	tail=" — over ${FAIL_AT}"
	# The override lives in the pull request body, which the caller passes in
	# `PR_BODY`; a marker with nothing after it names no reason and clears
	# nothing. GitHub bodies arrive with CRLF line endings.
	marker=$(printf '%s\n' "${PR_BODY:-}" | tr -d '\r' | grep -Em1 '^[[:space:]]*oversize:' || true)
	if [ -n "$marker" ]; then
		reason=$(printf '%s' "$marker" | sed -E 's/^[[:space:]]*oversize:[[:space:]]*//; s/[[:space:]]+$//')
		if [ -n "$reason" ]; then
			verdict="OVERRIDE"
			tail=" — over ${FAIL_AT}, oversize: ${reason}"
		else
			tail=" — over ${FAIL_AT}, oversize: marker carries no reason"
		fi
	fi
elif [ "$total" -ge "$WARN_AT" ]; then
	verdict="WARN"
	tail=" — over ${WARN_AT}, fails at ${FAIL_AT}"
else
	verdict="PASS"
	tail=""
fi

echo "DIFF gate: ${verdict} — ${total} lines (${source_lines} source / ${test_lines} test)${tail}"
[ "$verdict" = "FAIL" ] && exit 1
exit 0
