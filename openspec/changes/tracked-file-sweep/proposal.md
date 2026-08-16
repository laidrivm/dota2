# tracked-file-sweep

## Why

Every check in this repository that reads the tree does it the same way: run
`git rev-parse --show-toplevel`, run `git ls-files -z` **at that root**, drop
the empty last field, and keep only entries `lstatSync` reports as regular
files. Each step exists because of a way the naive version passes wrongly — a
listing taken at `cwd` names paths relative to a subdirectory and silently
scopes the check to it, an untracked file is one a clone does not have, and a
tracked path may be a deleted file, a symlink or a submodule gitlink that reads
as a directory.

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

- A tracked-file sweep gains one home, exporting the listing and the root it
  was taken at, so a caller filters the result rather than re-deriving it.
- The five call sites switch to it. `scripts/file-size.test.ts` holds a sixth,
  inline inside a test that enumerates tracked extensions; it switches too or
  is named here as deliberately left, not overlooked.
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
  listing taken at the root, tracked entries only, regular files only, and the
  root resolved without trimming. Its own capability rather than a requirement
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
