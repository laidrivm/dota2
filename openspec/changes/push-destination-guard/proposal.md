# Push destination guard

## Why

The command guard reads a push's flags and never its destination, so every
spelling of a push to `main` reaches the remote unblocked. The prohibition is
prose alone, which is the split `mechanised-prohibitions` exists to close —
and the prose failed under review in that change's own last pull request: the
rule was written naming `git push origin HEAD:main` as the spelling the guard
misses, and the review asked for the refspec to come out because a rule that
publishes its own bypass is worse than one that does not. Removing the example
left the rule true and the hole open. Closing the hole is what makes the
sentence unnecessary.

## What Changes

- `scripts/command-guard.ts` decides a push by its destination as well as its
  flags, in the three forms git's own documentation defines: an explicit
  refspec whose `<dst>` is `main`, a push with no refspec while `HEAD` is on
  `main`, and `--all` / `--branches` / `--mirror`, which name no ref and push
  `main` among the rest.
- The `CLAUDE.md` rule *Never push to `main`* narrows to what the guard cannot
  read — a destination that comes from configuration rather than from the
  command — under `agent-rulebook`'s existing requirement that a mechanised
  prohibition leaves its prose home.
- `scripts/command-guard.test.ts` gains the destination cases and the
  allowed-push cases that keep the guard from blocking ordinary work.

## Non-goals

- **Reading git configuration.** `remote.<name>.push` and
  `push.default = matching` can send a push to `main` with nothing in the
  command saying so. Following them means the guard decides on repository
  state rather than on the command it was handed, and the same fallback that
  makes an unreadable state fail closed would then block a push whenever
  configuration cannot be read. The prose keeps this half.
- **Protecting any name but `main`.** This repository's default branch is
  `main` and the rule names it; a configurable list is one setting nobody
  sets.
- **Blocking a push that deletes `main`** (`git push origin :main`) as a
  separate case. Its `<dst>` is `main`, so it falls out of the same check —
  it is named here only because the refspec has an empty `<src>` and reads
  like a different form.
- **Deleting the prose rule.** The guard is one mechanism against one agent's
  commands; a human with a shell is outside it, and so is the configuration
  half above.

## Capabilities

### Modified Capabilities

- `agent-permissions`: the hook requirement covers two git prohibitions today
  — a commit on `main` and a force-push — and gains a third, a push whose
  destination is `main`. The requirement's own sentence counting them changes
  with it.

## Impact

- **Code**: `scripts/command-guard.ts`, `scripts/command-guard.test.ts`.
- **Rules**: `CLAUDE.md` (the Git & PRs push rule), `PLAN.md` (the decision
  and the queue entry).
- **Precondition**: `mechanised-prohibitions` is archived first, so the
  requirement this change modifies lives in `openspec/specs/agent-permissions/`
  rather than in an unarchived delta.
- **Behaviour change for the agent**: a push to `main` becomes impossible
  through the tool rather than merely forbidden, including the forms nobody
  has spelled here yet.
