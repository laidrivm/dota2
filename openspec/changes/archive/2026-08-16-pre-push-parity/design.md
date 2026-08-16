# pre-push-parity — design

## Context

The pre-push hook is one line in `package.json`, run by `simple-git-hooks`:

```sh
bun run typecheck && bun test --pass-with-no-tests && { bash scripts/diff-budget.sh || true; }
```

Ten checks run on a pull request. Three are on that line: `typecheck`,
`coverage` (which is the suite plus a number), and `budget`. The seven left —
`biome`, `yaml-syntax`, `suppressions`, `actionlint`, `gitleaks`, `floor` and
`smoke` — arrive minutes after a push, on a branch that is already public.
`audit` is scheduled rather than per-pull-request and is out of scope here.

Measured on the author's machine, one run each, against the tree at
`713e634`:

| check | seconds |
|---|---|
| `tsc --noEmit` + `bun test` (the hook today) | 11.8 |
| `biome ci .` | 0.12 |
| `bun scripts/check-yaml.ts` | 0.07 |
| `bun scripts/no-suppressions.ts` | 0.05 |
| `stryker run` + `mutation-floor.ts` | 4.9 |
| `playwright test` (excluded) | 3.0 |

## Goals / Non-Goals

**Goals:**

- Every CI check that needs no browser fails on the developer's machine before
  the push rather than after it.
- One specification states what the hook runs.
- A clone without the optional binaries still pushes.

**Non-Goals:**

- Replacing CI. `--no-verify` exists and the hook is advisory by construction;
  CI stays the gate that decides a pull request.
- The browser suite and coverage on the push path — the proposal's non-goals
  give the reason for each.
- Speed work on the checks themselves. 17 s is the number; if it becomes a
  problem the answer is a faster check, not a shorter list.

## Decisions

### The hook lists the commands; it does not call one `verify` script

A single script both CI and the hook call would put the list in one place,
which is the shape this change otherwise argues for. It is rejected because
CI's jobs are the list: a failing job name is what says which gate broke, and
GitHub reports every job rather than stopping at the first. A serial script
would report one failure and hide the rest, and the workflow files would still
have to name it per job to keep the reporting.

So the list is restated in two places by design — the hook and the workflows —
and the specification is what binds them. That is the trade this change accepts
and the reason the `commit-gates` requirement includes a scenario refusing any
other specification the right to enumerate the same list.

### Optional binaries are skipped, not installed

`actionlint` and `gitleaks` are absent from this machine and from a fresh
clone. Three options were considered:

1. **Fail the push** when one is missing. Rejected: it makes a clone unable to
   push until the developer installs two binaries the project does not depend
   on, and the hook would be the only thing demanding them.
2. **Install them** from the hook. Rejected outright — a hook that installs
   software is a supply-chain root, and `bunfig.toml` exists because this
   repository takes that seriously.
3. **Run when present, skip silently when not.** Chosen. It is already the
   shape `commit-gates` sets for `gitleaks` before a commit, so the hook gains
   no new idea, and CI runs both from pinned versions where the verdict binds.

The cost is that a workflow edited on a machine without `actionlint` reaches CI
unlinted. That is the status quo, not a regression.

### The mutation gate runs the whole Stryker pass, not a cached report

`scripts/mutation-floor.ts` reads `reports/mutation/mutation.json` and fails if
it is absent. Running the check alone would read whatever report was left on
disk, and a stale report is exactly the failure the CI workflow prevents by
deleting the directory first. The hook does the same three steps the workflow
does, in the same order, for the same reason.

### Ordering against `file-size-cap`

Both changes carry a delta on `mutation-floor`'s first requirement, and
`MODIFIED` takes whole requirements: whichever archives second overwrites the
other. This change's delta therefore contains `file-size-cap`'s prefix command
in full, so archiving after it is safe. Archiving before it is not, and the
task list says so.

## Risks / Trade-offs

- **The hook grows to 17 s and someone starts reaching for `--no-verify`** →
  the three measured static checks are 0.24 s together; the mutation gate is
  the 4.9 s
  and it is the one that broke this month. If the pass becomes slow enough to
  route around, that is a signal to split the hook, not to shorten it quietly.
- **A developer's `bunx --no-install stryker` needs Node on `PATH`** — the
  workflow already documents that Stryker is the one tool here that needs it.
  On a machine without Node the hook fails on a tool problem rather than a code
  problem, which reads as a false alarm. Mitigation: the task list probes it and
  the hook reports the tool by name, so the message says which of the two it is.
- **Two places list the checks** → accepted above, with the specification
  binding them and a scenario refusing a third.

## Open Questions

None. The one fork — whether the browser suite joins the push path — was put to
the user and answered no.
