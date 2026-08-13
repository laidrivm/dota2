# spec-test-traceability — tasks

Two steps, two pull requests, in this order. The split is by what ships
working: step 1 is a check that validates citations and is useful on its own;
step 2 adds the count and the floor on top of it. Splitting instead by
"parser" and "gate" would leave a module no shipped code path calls, which
`change-slicing` forbids.

Criteria are cited by their scenario heading; all fifteen belong to the
`spec-test-traceability` capability. Numbers in brackets are `/zombies` items.

## 1. Identifiers and citations

- [x] 1.1 Write the criterion parser's tests first, all failing: a heading
      derives its slug (*An identifier is derived from a heading*), the real
      `draft-model` heading `Insufficient hero picked (model-spec §7.5)` leaves
      exactly `draft-model/insufficient-hero-picked-model-spec-7-5` rather than
      a shape a parser dropping `§7.5` would also satisfy [12], a spec with no
      scenario heading yields zero criteria rather than throwing [1], and a
      `#### Scenario:` line inside a fenced code block is not a criterion [24]
- [x] 1.2 Implement the parser over `openspec/specs/*/spec.md`, keeping each
      criterion's requirement heading for the ambiguity message
- [x] 1.3 Write the citation scanner's tests first: one citation above a
      `test(` marks one criterion (*A test cites one criterion*), two
      identifiers on one line both count (*One act closes several criteria*)
      [5], identifiers on consecutive comment lines all count [6], five tests
      citing one criterion reduce the uncited count by one (*One criterion
      needs several tests*) [7], two blank lines between comment and test still
      count [13], a non-blank non-comment line between them fails
      (*A citation floating in a file*) [14], and a citation above a
      `test.each(` call counts, since `docs/testing.md` treats a row as a test
- [x] 1.4 Add the scanner's negative tests: `// spec:` inside a string literal
      or a block comment is not a citation [25], a `// spec:` comment naming no
      identifier fails [21], and an identifier without its `/` or carrying
      uppercase or spaces fails rather than silently matching nothing [22]
- [x] 1.5 Implement the scanner over every tracked test file outside
      `node_modules`, whichever runner owns it; break each assertion above
      before it passes
- [x] 1.6 Write the validation-set tests first: a citation matching no
      criterion fails, naming citation, file and line (*A criterion renamed
      under its test*) [16] [18]; a citation to a criterion living only in an
      active change's delta spec is valid (*A criterion still in flight*); and
      an absent or empty `openspec/changes/` leaves the validation set equal to
      the counted set [3]
- [x] 1.7 Implement the two sets — counted from `openspec/specs/`, validated
      against those plus `openspec/changes/*/specs/*/spec.md`
- [x] 1.8 Write the ambiguity tests first: a cited slug matching two criteria
      in one capability fails and names both requirement headings
      (*An ambiguous identifier is cited*) [19]; the same slug uncited passes
      (*An ambiguous identifier nobody cites*) [20]; the same heading text in
      two different capabilities yields two distinct identifiers [8]
- [x] 1.9 Implement ambiguity detection, and confirm it against the three real
      duplicates — `draft-session / Board is not an active context`,
      `local-review-loop / A skipped Minor`,
      `review-bot-config / An archived change`
- [x] 1.10 Add the environment tests: run from a subdirectory the check reads
      the whole repository [26], outside a git repository it throws rather than
      passing [27], and a tracked file deleted from the work tree is skipped
      [28]
- [x] 1.11 Add the guard on the sweep itself — the run found more than zero
      criteria and more than zero test files, so an empty scan cannot pass
      every assertion [15]
- [x] 1.12 Cite this change's own criteria from the tests written above, which
      is what 1.6 makes valid, and confirm `bun test` passes with them

## 2. The floor

- [x] 2.1 Write the floor's tests first: a count equal to the floor passes
      [9], a count one above it fails (*A criterion added without a test*)
      [10], a count one below it fails and names the value to write
      (*A criterion newly covered*) [11], and the failure reports both count
      and floor rather than only failing [17]
- [x] 2.2 Write the reason-line tests first: the floor's line without a trailing
      comment fails, and so does one whose comment text is empty or whitespace —
      `const FLOOR = 380; //` is not a reason (*The floor changed with no reason
      given*) [23]
- [x] 2.3 Implement the floor constant and the three comparisons in
      `scripts/spec-coverage.test.ts`; break each before it passes
- [x] 2.4 Measure the count over the tree and write it as the floor with its
      reason on the line (*The repository as it stands*) [29]; a tree with no
      citations at all counts every criterion as uncited [2]
- [ ] 2.5 Add the archive test: a change archived with every new criterion
      cited leaves the count unchanged, so no floor edit is needed (*A change
      is archived with its tests already written*, *A criterion admitted as
      untestable* for the raised-with-reason path) [30]
- [ ] 2.6 Add the citation convention to `docs/testing.md` — the `// spec:`
      comment, its placement, and that the floor is lowered by a visible line
- [ ] 2.7 Grep the four sites that restate a claim like this one before calling
      the change done: this change's sibling artefacts, `openspec/specs/**`,
      `PLAN.md` and the README ownership map — searching the wording being
      replaced, not the wording replacing it
