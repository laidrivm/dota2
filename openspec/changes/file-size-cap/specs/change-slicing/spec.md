# change-slicing — delta spec

## ADDED Requirements

### Requirement: No source file exceeds its per-file cap

A tracked `.ts` or `.tsx` file SHALL NOT exceed 300 lines, and a tracked `.css`
file SHALL NOT exceed 200. The check SHALL ship as a test, so that CI's
existing `bun test` run and the pre-push hook both carry it without a new
workflow.

Test files SHALL be counted like any other. `docs/testing.md` records that test
code is where agent-written slop hides, and the diff budget in this capability
already refuses to exempt tests for that reason; the cap holds the same line on
the other axis.

The cap SHALL carry no exemption list. It is adopted in the same change that
brings every file under it, so the check is green from its first commit — a cap
that grandfathers the violations standing when it lands enforces nothing until
someone clears a list nobody is scheduled to clear.

This cap and the diff budget measure different things and both SHALL stand: the
budget bounds what one change asks a reviewer to read, the cap bounds what one
file asks them to hold at once. Nine files reached between 1.1× and 4.7× their
cap without any single change exceeding the budget, which is what makes the
second gate more than a duplicate of the first.

#### Scenario: A file over the cap

- **WHEN** a tracked `.ts` file of 301 lines is committed
- **THEN** the check fails, naming the file, its line count and its cap

#### Scenario: A stylesheet over the cap

- **WHEN** a tracked `.css` file of 201 lines is committed
- **THEN** the check fails, naming the file, its line count and its cap

#### Scenario: A test file is not exempt

- **WHEN** the file over the cap is `*.test.ts`
- **THEN** the check fails exactly as it would for any other file

#### Scenario: The tree as it stands

- **WHEN** the check runs over the tree at the commit that introduces it
- **THEN** it passes, with no file exempted and no allowance recorded

#### Scenario: An untracked file over the cap

- **WHEN** an untracked file of 400 lines sits in the working tree
- **THEN** the check passes — a clone does not carry it, so it is not part of
  what anyone reviews
