# spec-test-traceability

## Why

`openspec/config.yaml` requires every acceptance criterion to be cited by a
task. A ticked task is not an assertion, so a criterion can reach the archive
with nothing executing it, and nothing in the repository can currently tell
those two states apart.

Measured over the tree as it stands: 380 criteria across 17 capabilities, 312
test names, and not one citation joining them. Recovering the correspondence
by matching names scores roughly a coin flip — of eleven candidate matches
inspected by hand, five were confidently wrong while reading as plausible
(`review-bot-config / The setting is explicit` matched a `draft-board` test).
A traceability claim assembled that way would certify coverage that does not
exist, which is worse than the empty state.

## What Changes

- A new check, shipped as `scripts/spec-coverage.test.ts`, that reads every
  `openspec/specs/*/spec.md` and every tracked `*.test.ts` and `*.spec.ts`
  file outside `node_modules`, and compares the criteria it finds against the
  citations.
- A criterion is identified by `<capability>/<slug of its scenario heading>`,
  derived rather than stored — no identifier is written into any spec.
- A test cites a criterion in a `// spec:` comment above it; one comment may
  carry several citations, and several tests may cite one criterion.
- The count of uncited criteria is pinned by a floor constant in the check
  itself. The check fails when the count rises above the floor. The floor may
  be lowered freely; raising it requires a reason written on that line, so a
  criterion nothing can assert is admitted as a sentence a reviewer reads
  rather than as a silent increment.
- The check also fails on a citation matching no criterion, which is what
  catches a criterion renamed or deleted out from under its test.
- `docs/testing.md` gains the citation convention.

## Capabilities

### New Capabilities

- `spec-test-traceability`: how a test cites the criterion it closes, what
  identifies a criterion, and what the coverage floor forbids.

### Modified Capabilities

None. The rule this extends lives in `openspec/config.yaml`, which no
capability owns, and it is left as written — it governs tasks, not tests.

## Non-goals

- **Closing the backlog.** The ~380 uncited criteria stay uncited. The floor
  exists so the number cannot grow; driving it down is not this change.
- **An exemption ledger.** 86 criteria are discharged by a person rather than
  a runtime ("the change is rejected at review"), concentrated in
  `agent-permissions` (63 of 93) and `local-review-loop` (12 of 21).
  Distinguishing "cannot be tested" from "not tested yet" only matters to
  someone driving the floor to zero, so both simply sit under the floor, and
  the reason a new one is admitted is written on the floor line instead of in
  a register of its own.
- **Renaming the three duplicated scenario headings.** Three headings repeat
  under different requirements within one capability, making their slugs
  ambiguous. Rather than rename them now, an ambiguous citation is an error,
  so the rename is paid for by whoever first needs to cite one.
- **One test per criterion.** `docs/testing.md` requires a test to arrange and
  act once, so a criterion expands into several tests by construction; the
  relation stays many-to-many.
- **A prose rule restating the check.** Per `agent-rulebook`, a mechanised
  prohibition does not also live as prose.
- **A new CI job.** CI already runs `bun test`, so a check shipped as a test
  is blocking without touching a workflow.

## Impact

- New file: `scripts/spec-coverage.test.ts`. No new dependency, no change to
  `.github/workflows/`, no change to `package.json` scripts.
- Every future test that closes a criterion carries a `// spec:` comment;
  existing tests are untouched.
- Criteria are counted from `openspec/specs/**` only, so one enters the count
  when its change is archived rather than while it is in flight. Citations are
  validated against those plus active changes' delta specs, which is what lets
  a test written during apply cite the criterion it is being written for.
