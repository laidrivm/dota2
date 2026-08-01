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

- Allow a push only when every destination it names is a concrete ref other
  than `main`.
- Leave every other push untouched, including one whose *source* is `main`.
- Add no dependency and no second git invocation on the common path.

**Non-Goals:**

- Reading `remote.<name>.push` or `push.default` (see the decision below).
- A configurable list of protected branch names.
- Touching the commit path, which is correct and covered.

## Decisions

### The check is scoped by what it exempts

The first shape of this design listed the spellings that mean `main` — a
refspec whose `<dst>` is `main`, a push with no refspec, `--all`. Review found
three more inside git's own grammar: `git push origin :` pushes every branch
that already exists on the remote, a wildcard refspec pushes whatever it
matches, and `git push origin HEAD` names its destination only through the
current branch. The list was narrower than the space it claimed to cover, which
is the failure `CLAUDE.md`'s *Scope a scan by what it exempts* names.

So the check allows a push only when every destination it names is a concrete
ref other than `main`, and blocks everything else — including a destination it
cannot bound. A form nobody anticipated is refused rather than admitted, and
the cost of being wrong is a blocked push the user can run.

### The parse follows git's documented grammar

`git push --help`: the format of a refspec is "an optional plus `+`, followed
by the source object `<src>`, followed by a colon `:`, followed by the
destination ref `<dst>`", and "missing `:<dst>` means to update the same ref as
the `<src>`". So the destination is the text after the last colon when there is
one and the whole argument when there is not — the **last** colon, because
`<src>` can be any SHA-1 expression and some of those carry one.

Comparison is on the whole token, which is what keeps `HEAD:mainline` allowed —
the same equality the commit path already uses for the branch name.

`HEAD` and `@` as a destination resolve through the current branch, which is
never `main` wherever this scan runs, so they need no case of their own.

### Every push from `main` is blocked, so no operand has to be identified

The first shape of this decision read git's grammar literally: the first
non-option argument is the repository, the rest are refspecs. Review found what
that rests on. `git push --help` gives push one option whose value is a
separate word — `-o <string>`, with `--receive-pack`, `--exec` and `--repo`
accepting the space form as well — so `git push -o ci.skip origin` with `HEAD`
on `main` reads `ci.skip` as the repository and `origin` as the only refspec.
`origin` is not `main`, and the push goes to `main` anyway.

The fix is not a longer list of value-taking options: it is not needing the
answer. While `HEAD` is on `main`, every push is blocked, whatever the command
names. The case the operand split existed to serve — a push with no refspec,
which git sends to the upstream branch of the same name — is exactly the case
where `HEAD` is on `main`, and the agent has nothing else to push from there
because it cannot commit there.

From any other branch the operands are scanned as refspecs without deciding
which is the repository, since reading a remote as a destination can only block
a push that would have been allowed. The value words of `-o`, `--push-option`,
`--receive-pack`, `--exec` and `--repo` are skipped for the opposite reason:
`-o main` would otherwise refuse a legitimate push, and a false positive that
common is a guard people work around.

### The flags that act on refs they do not name block outright

`--all` is documented as "Push all branches (i.e. refs under `refs/heads/`)",
`--branches` is its alias, and `--mirror` covers "all refs under `refs/`". Each
pushes `main` without naming it. `--prune` belongs with them from the other
direction: it removes "remote branches that don't have a local counterpart", so
in a tree with no local `main` it deletes the remote one, and the destination
scan sees nothing because there is nothing written down to see.

`--tags` and `--follow-tags` stay out: they act on `refs/tags/`, which holds no
branch. Four names in a set, matched by prefix rather than
exactly — `--mir`, `--pru`, `--al` and `--bra` were each run against git and
reach the option they abbreviate, where `--a` is rejected as ambiguous. The
check comes before anything reads a branch, so `--all` with a detached `HEAD`
blocks on the flag rather than on an unreadable head.

The option-value list is matched exactly for the opposite reason: a prefix
there could swallow the word after an abbreviated option and hide an operand,
where leaving an abbreviation unskipped reads its value as an operand and at
worst refuses a push. Every uncertainty in this parse resolves towards
blocking.

### A `+` refspec prefix is a force-push

`git push --help` gives `+` the same meaning as `--force` for the ref it
prefixes. The existing force check matches flags, and `+feat/x:feat/x` is not a
flag, so a force-push written that way passes the guard today. The parse this
change adds is what makes the fix one condition, so it lands here rather than
becoming a change of its own.

### Configuration is out of the guard and stays in the prose

A refspec can come from `remote.<name>.push`; `push.default` set to `matching`
pushes every same-named branch, and set to `upstream` or `tracking` pushes to a
branch that need not share its name; `remote.<name>.mirror` makes `--mirror`
the default. The guard could read these with `git config`, and does not, for the reason the existing requirement gives for reading the
command rather than the payload: the hook decides on what it was handed. Adding
configuration would also widen the fail-closed fallback — an unreadable config
would have to block every push, where today an unreadable branch blocks only a
commit.

What this leaves is a residue the prose keeps, and the residue is narrower than
what the prose covers today, which is everything.

### Two reason strings, not one and not four

Blocking messages are what the agent reads and acts on. A push that names a
destination is refused with that destination in the message; a push that names
none — `--all`, `--mirror`, the matching refspec — is refused for pushing every
branch, because there is no single destination to name and claiming one would
be false. Both end in the same remedy, push the branch and open a pull request,
so they are two messages and not four.

## Risks / Trade-offs

- **A blocked push the user wanted.** The agent cannot push to `main` at all,
  including the legitimate first push of a new repository → that push is the
  user's, exactly as the commit on `main` already is.
- **An unbounded destination blocks a legitimate push.** A wildcard refspec
  that provably avoids `main` is refused with the rest → the agent has no use
  for one, and the user can run it.
- **A refspec built by expansion.** `git push origin "$BRANCH:main"` is caught
  because quoting is removed before the words are read, but
  `git push origin "$REF"` is not → the same variable-expansion ceiling the
  guard already records for `git -C "$SOME_VAR" commit`.
- **`push.default` changed to `matching`.** A push with no refspec from a
  feature branch would then also update `main` → outside the guard by the
  decision above; the prose keeps it.
- **A value-taking option nobody listed.** A future git option whose value is a
  separate word could read as an operand and refuse a legitimate push → a false
  positive, and the branch-wide refusal is what keeps it from ever being a
  false negative.

## Migration plan

One task group, one pull request: the parse, its tests, then the prose rule
narrowed in the same change because the requirement *A mechanised prohibition
leaves its prose home* is what makes the two one unit.

`mechanised-prohibitions` is archived first, so the requirement this change
modifies is in `openspec/specs/agent-permissions/spec.md` when the delta is
applied to it.
