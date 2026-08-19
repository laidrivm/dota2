# commit-gates — delta spec

## ADDED Requirements

### Requirement: A turn that commits reports its gates before it ends

A `Stop` hook registered in the tracked `.claude/settings.json` SHALL refuse
to end a turn when all of the following hold: the turn produced at least one
commit, the branch's work has not reached its remote counterpart, a task group
in a change outside `openspec/changes/archive/` has at least one box and no
unticked one left, and the turn's final assistant message carries neither a
gate line nor `BLOCKED`. It SHALL block by exiting **2** with the reason on
stderr, which is the only code that prevents the turn ending, and the only
channel the model reads — stderr from a hook exiting 0 reaches the debug log
alone.

A branch with no remote counterpart at all satisfies the second condition
rather than exempting itself from it: nothing of it has been pushed, so the
sequence can still run first, which is the whole of what that condition asks.
A group with no boxes at all fails the third, because the absence of an
unticked box is not evidence that a box was ticked.

Whether the turn produced a commit SHALL be decided against a mark of `HEAD`
taken when control arrived, written by a `UserPromptSubmit` hook. The mark
SHALL live no longer than the turn that follows it: a record of what the
sequence has already reported would be a second source of truth about work the
repository already describes, and one that can disagree with it.

Where the mark is absent, the hook SHALL allow the turn to end. This is the
one place in this capability where an undecidable case does not block, and it
is a choice rather than an oversight: a hook that refuses whenever its partner
did not run makes a partial installation into a session that cannot end a
turn.

The refusal SHALL name both endings the rule already admits — running the
sequence, or writing `BLOCKED` with what only the user can settle — because
each is text the next message can carry. No repository state need change for a
blocked turn to end, so the hook SHALL NOT be able to refuse indefinitely, and
SHALL NOT depend on a loop-protection field to guarantee it.

This requirement SHALL NOT claim that the sequence ran. The hook reads the
final message for a gate line; a gate line written without running the gate
passes it. What it catches is the turn that ends silently, which is the
failure it was written for.

#### Scenario: A task group is completed and the turn ends silently

- **WHEN** a turn commits the last task of a group and its final message
  carries no gate line
- **THEN** the hook blocks the turn from ending, and the reason names running
  the sequence or writing `BLOCKED`

#### Scenario: The turn reports its gates

- **WHEN** the same turn's final message carries the sequence's gate line
- **THEN** the turn ends

#### Scenario: The turn names what only the user can settle

- **WHEN** the final message carries `BLOCKED` with what the user must decide
- **THEN** the turn ends, because that is an ending the rule already admits

#### Scenario: A turn that commits nothing

- **WHEN** a turn answers a question while a task group stands complete, and
  `HEAD` is where the mark left it
- **THEN** the turn ends, whatever the message says

#### Scenario: The branch has never been pushed

- **WHEN** a turn commits the last task of a group on a branch with no
  counterpart under `refs/remotes/origin/`
- **THEN** the hook blocks, because nothing of the branch has been pushed and
  the sequence can still run first

#### Scenario: A group that carries no boxes

- **WHEN** the only group whose text holds no `- [ ]` also holds no `- [x]`
- **THEN** the turn ends, because the absence of an unticked box is not
  evidence that a box was ticked

#### Scenario: The work has been pushed

- **WHEN** a turn commits and the branch carries nothing its remote
  counterpart lacks
- **THEN** the turn ends, because the point past which the sequence could
  have run first has passed

#### Scenario: Every group still has work in it

- **WHEN** a turn commits while every task group in every active change still
  has an unticked box
- **THEN** the turn ends, because no group has been completed

#### Scenario: The completed group belongs to an archived change

- **WHEN** the only fully ticked group is in a change under
  `openspec/changes/archive/`
- **THEN** the turn ends, because archiving is what retires the obligation

#### Scenario: The mark was never written

- **WHEN** `Stop` finds no record of `HEAD` from the start of the turn
- **THEN** the turn ends, because a partial installation must not make the
  session unusable
