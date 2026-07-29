#!/usr/bin/env bash
# The review budget for one pull request: how many lines a reviewer must
# actually read between <base> and HEAD. Prints one gate line and exits
# non-zero when the diff is over budget or cannot be measured.
set -uo pipefail

WARN_AT=500
FAIL_AT=800

base="${1:-}"
if [ -z "$base" ]; then
	# Not `rev-parse --abbrev-ref origin/HEAD`: with no origin/HEAD it echoes
	# the argument back, which strips to the literal `HEAD` — and `HEAD...HEAD`
	# is an empty diff, so every branch would read PASS at 0 lines.
	base=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)
	base="${base#origin/}"
	base="${base:-main}"
fi

# An unmeasured diff must never read as a passing one, so every way of
# failing to measure exits non-zero with the reason.
if ! git rev-parse --verify --quiet "${base}^{commit}" >/dev/null; then
	echo "DIFF gate: ERROR — cannot resolve base ref '${base}'" >&2
	exit 2
fi
if ! git merge-base "$base" HEAD >/dev/null 2>&1; then
	echo "DIFF gate: ERROR — no merge base between '${base}' and HEAD" >&2
	exit 2
fi

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

test_lines=$(count "${TESTS[@]}")
source_lines=$(count . "${TESTS[@]/#/:(exclude)}")
total=$((source_lines + test_lines))

if [ "$total" -ge "$FAIL_AT" ]; then
	verdict="FAIL"
	tail=" — over ${FAIL_AT}"
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
