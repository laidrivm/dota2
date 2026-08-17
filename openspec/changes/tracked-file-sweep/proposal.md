# tracked-file-sweep

## Why

Every check in this repository that reads the tree starts the same way: run
`git rev-parse --show-toplevel`, run `git ls-files -z` **at that root**, and
drop the empty last field. Each step exists because of a way the naive version
passes wrongly — a listing taken at `cwd` names paths relative to a
subdirectory and silently scopes the check to it, and an untracked file is one
a clone does not have.

A check that then *opens* what it listed adds a fourth step, keeping only
entries `lstatSync` reports as regular files, because a tracked path may be a
deleted file, a symlink or a submodule gitlink that reads as a directory. Five
of the six sites do that — `scripts/spec-coverage.ts` among them, filtering in
`check()` rather than in the listing beside it. The sixth rules on paths
without opening them: the extension enumeration inside
`scripts/file-size.test.ts`, where a deleted-but-tracked path still carries an
extension somebody has to rule on, so the filter would be wrong there rather
than merely unnecessary.

`PLAN.md` has carried this as a rule-of-two candidate since `file-size-cap`
step 3, recording three copies. The count is now **five**, and two of them have
already drifted:

| site | root trimmed with | subdirectory case tested | absent-file case tested |
| --- | --- | --- | --- |
| `scripts/no-suppressions.ts` | `replace(/\n$/, "")` | yes | yes |
| `scripts/spec-coverage.ts` | `replace(/\n$/, "")` | yes | yes |
| `scripts/file-size.ts` | `replace(/\n$/, "")` | yes | no |
| `src/app/module-classes.test.ts` | `trim()` | no | no |
| `src/app/styles/styles.test.ts` | `trim()` | no | no |

The three script copies carry a comment explaining why `trim()` is wrong —
"a repository whose path ends in a space is unusual and not this check's to
corrupt" — and the two test copies use `trim()` anyway. That is the drift a
sixth copy would repeat, and the reason the two missing tests are worth writing
once rather than three times.

## What Changes

- A tracked-file sweep gains one home, exporting the root and two views over
  one listing — git's paths, and the regular files among them — so a caller
  picks a view and applies its own filter rather than re-deriving either.
- All six call sites switch to it, the inline one in
  `scripts/file-size.test.ts` included. That one enumerates the extensions
  tracked paths carry and must not drop a deleted-but-tracked path, so it takes
  the unfiltered view rather than an exemption — needing the raw listing is
  what the second view is for.
- A check fails the suite when any tracked source file other than
  `scripts/tracked.ts` and `scripts/tracked.test.ts` enumerates the tree
  itself, so the count cannot climb back. The sweep's own test is the one
  exemption, because fabricating a repository is what it does.
- The two cases only `no-suppressions` and `spec-coverage` have today — run
  from a subdirectory, and a tracked file absent from the work tree — are
  written once against the lifted sweep.
- `src/app/module-classes.test.ts` and `src/app/styles/styles.test.ts` stop
  trimming a repository path's trailing space.

## Non-goals

- **The rule of two itself.** `scan-lift` writes that rule into `CLAUDE.md`'s
  Code list. This change is one of its candidates and does not restate it.
- **Changing what any check scans.** Each caller keeps its own filter —
  extensions, prose exemptions, self-exclusion. Only the listing is shared.
- **A filesystem walk.** `git ls-files` is the source precisely because a glob
  walks `node_modules` and admits whatever is untracked.
- **Caching the listing across callers.** Each check spawns its own `git`
  today; making that one spawn is a performance change nobody has measured a
  need for.

## Capabilities

### New Capabilities

- `tracked-file-sweep`: how a check obtains the repository's files — one shared
  listing taken at the root, tracked entries only, the root resolved without
  trimming, and the regular files among the paths offered as the view a caller
  that opens them takes. Its own capability rather than a requirement
  inside `commit-gates`, whose Purpose is scoped to two named prohibitions, and
  because three capabilities depend on the sweep — the same reasoning
  `pre-push-parity` used to give the hook's list one home.

### Modified Capabilities

None. Each spec that depends on this sweep states only the part it owns —
`commit-gates` requires the suppression scan to read tracked files, and
`change-slicing` requires the same of the cap — and neither states the
mechanics this capability now owns.

## Impact

- A new module for the sweep, and its tests.
- `scripts/no-suppressions.ts`, `scripts/spec-coverage.ts`,
  `scripts/file-size.ts` — the listing replaced by a call.
- `src/app/module-classes.test.ts`, `src/app/styles/styles.test.ts` — the same,
  plus the `trim()` fix that comes with it.
- `scripts/file-size.test.ts` — the inline sixth copy.
- Every one of these is a gate. A regression in the sweep is a gate that scans
  nothing and passes, which is why the two cases move with it.
