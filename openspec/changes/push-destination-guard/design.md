# Design — push destination guard

## Context

`scripts/command-guard.ts` resolves every Bash call to an invocation, and for
`git` it reads two things: the subcommand, and — for `push` — whether any
argument matches the force pattern (`scripts/command-guard.ts:224`). It never
looks at where the push goes. `git push origin HEAD:main` therefore passes the
guard, and `CLAUDE.md`'s *Never push to `main`* is the whole boundary.

The command line already reaches the script parsed: `commands()` yields words
with quoting removed, `invocation()` strips assignments and wrapper words, and
the loop over `VALUE_OPTIONS` walks past git's global options to the
subcommand. Everything this change needs is in `args`, the slice after the
subcommand — the work is reading it, not getting at it.

Facts below come from `git push --help` on the version this repository runs,
not from recollection.

## Goals / Non-Goals

**Goals:**

- Block every push to `main` whose destination is written in the command.
- Leave every other push untouched, including one whose *source* is `main`.
- Add no dependency and no second git invocation on the common path.

**Non-Goals:**

- Reading `remote.<name>.push` or `push.default` (see the decision below).
- A configurable list of protected branch names.
- Touching the commit or force-push paths, which are correct and covered.

## Decisions

### The destination is `<dst>`, and the parse follows git's grammar

`git push --help`: "The format of a `<refspec>` parameter is an optional plus
`+`, followed by the source object `<src>`, followed by a colon `:`, followed
by the destination ref `<dst>`", and "missing `:<dst>` means to update the same
ref as the `<src>`". So for each non-option argument after the remote, strip a
leading `+`, take the text after the last `:` if there is one and the whole
argument if there is not, and compare it to `main` and `refs/heads/main`.

Comparing the whole token is what keeps `HEAD:mainline` allowed, the same
equality the commit path already uses for the branch name. Taking the text
after the **last** colon rather than the first matters because `<src>` can be
any SHA-1 expression and colons appear in some of them.

The first non-option argument is the remote, not a refspec — but treating it as
a refspec too costs nothing: a remote named `main` is not a thing here, and a
false positive on one would be a blocked push, which fails safe. Skipping the
first argument to be precise would mean tracking whether it was given at all.
Alternative rejected: matching the raw command text against `main`, which
blocks `git push origin feat/main-menu` and reads a description as a
destination.

### A push with no refspec is decided by the current branch

`git push --help`: with no refspec and none of `--all`, `--mirror`, `--tags`,
git "honors `push.default` configuration", whose default value `simple` pushes
"the current branch … to the corresponding upstream branch". The guard already
knows the current branch — `currentBranch()` exists for the commit path — so a
push with no refspec on `main` blocks with no new machinery.

This is the one case that costs a `git symbolic-ref` on an otherwise clean
path. It is spent only when a push carries no refspec, which is the shorter
half of the commands the agent writes.

### `--all`, `--branches` and `--mirror` block outright

`--all` is documented as "Push all branches (i.e. refs under `refs/heads/`)",
`--branches` is its alias, and `--mirror` covers "all refs under `refs/`".
Each pushes `main` without naming it. Three strings in a set.

`--tags` is not among them: it pushes `refs/tags/`, which contains no branch.

### Configuration is out of the guard and stays in the prose

A refspec can come from `remote.<name>.push`, and `push.default = matching`
pushes every same-named branch. The guard could read both with `git config`,
and does not, for the reason the existing requirement gives for reading the
command rather than the payload: the hook decides on what it was handed. Adding
configuration would also widen the fail-closed fallback — an unreadable config
would have to block every push, where today an unreadable branch blocks only a
commit.

What this leaves is a residue the prose keeps, and the residue is narrower than
what the prose covers today, which is everything.

### One reason string, three triggers

Blocking messages are what the agent reads and acts on, so the destination
block says which spelling was refused and what to do instead — push the branch,
open a pull request — rather than repeating the rule. Three separate messages
for refspec, no-refspec and `--all` were considered and dropped: the remedy is
identical in all three.

## Risks / Trade-offs

- **A blocked push the user wanted.** The agent cannot push to `main` at all,
  including the legitimate first push of a new repository → that push is the
  user's, exactly as the commit on `main` already is.
- **The remote-as-refspec shortcut.** A remote literally named `main` would
  make every push through it block → a false positive that fails safe, and no
  such remote exists here.
- **A refspec built by expansion.** `git push origin "$BRANCH:main"` is caught
  because quoting is removed before the words are read, but
  `git push origin "$REF"` is not → the same variable-expansion ceiling the
  guard already records for `git -C "$SOME_VAR" commit`.
- **`push.default` changed to `matching`.** A push with no refspec from a
  feature branch would then also update `main` → outside the guard by the
  decision above; the prose keeps it.

## Migration plan

One task group, one pull request: the parse, its tests, then the prose rule
narrowed in the same change because the requirement *A mechanised prohibition
leaves its prose home* is what makes the two one unit.

`mechanised-prohibitions` is archived first, so the requirement this change
modifies is in `openspec/specs/agent-permissions/spec.md` when the delta is
applied to it.
