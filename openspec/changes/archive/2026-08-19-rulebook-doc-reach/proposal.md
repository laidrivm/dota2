# rulebook-doc-reach

## Why

`CLAUDE.md`'s growth protocol moves a whole section into `docs/` when the
always-on set outgrows its budget, and the Git & PRs section has now made that
move. One live requirement did not follow it: the rule that a mechanised
prohibition loses its prose names `CLAUDE.md` as the place the prose is
deleted from. The prose it was written to reach now sits in
`docs/git-and-prs.md`, so a prohibition mechanised tomorrow could be left
stated there beside the mechanism that supersedes it — the exact drift the
requirement exists to prevent.

## What Changes

- The requirement's reach becomes `CLAUDE.md` **and the docs it indexes**,
  which is what the growth protocol already promises when it says an extracted
  doc inherits the constitution.

## Non-goals

- Restating the growth protocol in the specification. `CLAUDE.md` owns it; the
  requirement only has to reach where the protocol puts things.
- Any change to which prohibitions are mechanised, or to the three
  dispositions a prohibition can take.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-rulebook`: *A mechanised prohibition leaves its prose home* — its
  reach widens from `CLAUDE.md` alone to the docs indexed from it.

## Impact

- `openspec/specs/agent-rulebook/spec.md` on sync.
- `CLAUDE.md` and any doc indexed from it whose prose the widened requirement
  now reaches — task 1.2 sweeps them against the command guard and the two
  hooks, and how much it deletes is not known until it runs.
- `scripts/spec-coverage.ts`: the two scenarios the widened requirement adds
  are uncited, so the floor moves by two on a line carrying that reason.
- No tests, no configuration: `rulebook.test.ts` parses the rules sublists,
  which this does not touch.
