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

The spelling is not exotic, and nobody has to think of it. A branch created
from `origin/main` takes it as its upstream, and the first `git push` on such a
branch fails with git's own suggestion: "To push to the upstream branch on the
remote, use `git push origin HEAD:main`". That happened on this change's own
branch while this proposal was being written. The one form the guard misses is
the one the tool recommends.

## What Changes

- `scripts/command-guard.ts` decides a push by its destination as well as its
  flags, and allows one only when every destination it names is a concrete ref
  other than `main`. Blocked are a refspec resolving to `main`, a push naming
  no refspec while `HEAD` is on `main`, `--all` / `--branches` / `--mirror`,
  and any destination the guard cannot bound — the matching refspec `:`, a
  wildcard, an empty destination.
- A refspec's leading `+` forces the update exactly as `--force` does, and the
  flag pattern does not see it because it is not a flag. The parse this change
  adds closes that with one condition, so it closes it here.
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
- **Following git's repository selectors past `-C`.** `--git-dir`,
  `--work-tree`, `GIT_DIR` and `GIT_WORK_TREE` each move the repository a
  command acts on, and the guard reads none of them; the spec declares that a
  limitation rather than leaving it implied. It predates this change and is
  not what this change is for.
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
