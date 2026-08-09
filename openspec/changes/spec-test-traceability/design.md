# spec-test-traceability — design

## Context

`openspec/config.yaml` binds every acceptance criterion to a task. Tasks are
ticked by hand, so the binding proves intent and nothing else. The repository
holds 380 criteria in 17 capabilities and 312 test names, joined by nothing.

A spike measured whether the join could be recovered mechanically from names —
the correspondence exists in places, `#### Scenario: A suppression is added`
against `describe("a suppression is added")`, and it grew on its own. It does
not generalise: containment matching over normalised tokens put 33 criteria in
a strong bucket and 136 in a weak one, and eleven weak matches read by hand
came out as roughly three right, three arguable, five confidently wrong. The
wrong ones are the problem — `review-bot-config / The setting is explicit`
matched a `draft-board` test and looked reasonable doing it. A generated matrix
would assert coverage that is not there, and nobody re-reads 380 rows to catch
it.

The spike also showed the criteria are not one population. 86 of 380 end in an
outcome a person produces — "the change is rejected at review" — and they are
concentrated: 63 of `agent-permissions`' 93, 12 of `local-review-loop`'s 21,
against 0 of `draft-board`'s 34 and 0 of `hero-picker`'s 27.

## Goals / Non-Goals

**Goals:**

- A criterion added from now on cannot reach `openspec/specs/` uncited without
  someone writing down why.
- The join, where it is claimed, is exact — no fuzzy matching anywhere.
- Zero migration: no spec edits, no test edits, no backlog work.

**Non-Goals:**

Carried from `proposal.md`, not restated here.

## Decisions

### The identifier is derived from the heading, not stored in the spec

`<capability>/<slug of the scenario heading>`. The alternative — writing
`[DB-3]` into each heading — buys stability against rewording and costs 380
edits before the check does anything. It also needs an allocation scheme, which
is a second thing to get wrong.

Derivation makes rewording a heading break the citation. That is not a defect
to be engineered around: a criterion whose wording changed is a criterion whose
test deserves a second look, and the failure names the file to look at.

Slugs are not unique — three headings repeat under different requirements
(`draft-session / Board is not an active context`,
`local-review-loop / A skipped Minor`, `review-bot-config / An archived
change`). Rather than lengthen the identifier to three levels, which puts
`local-review-loop/minor-findings-are-reported-once-at-the-end/a-skipped-minor`
into a comment, ambiguity is an error **only when cited**. Nothing is renamed
today; the first author who needs one of those six criteria renames a heading
then.

### The citation is a comment, not part of the test name

`PLAN.md` recorded the identifier going into the test name. It cannot: a single
act may satisfy several criteria legitimately — `docs/testing.md` allows
"repeated assertions about one act" — and three identifiers do not fit in a
name that also has to read as a sentence. A comment takes as many as needed and
keeps `bun test` output legible.

The cost is that a comment can drift from the test beneath it and nothing
notices. Requiring it to sit directly above a `test`, `it` or `describe` call
buys back the degenerate case — a block of citations at the top of a file
claiming coverage nothing performs — for about five lines of scanning.

### Counting and validating read different sets

Counted from `openspec/specs/` only; validated against those plus active
changes' delta specs. The asymmetry is what lets a change dogfood the gate: its
tests cite criteria that are still in its own delta, which is valid but not yet
counted, and archiving moves criterion and citation into the count together.
Counting deltas too would fail every proposal, which ships on `spec/…` before
any test exists.

### The floor is a constant in the check, with a mandatory reason

One number, not a per-capability table and not a register of exempt criteria.
It absorbs both populations — "no test yet" and "no test possible" — because
telling them apart only matters to someone driving the number to zero, and the
proposal says nobody is.

Detecting *which direction* the floor moved needs the previous committed value,
so the check would have to read git history to demand a reason only on a rise.
Instead the line always carries a trailing comment and the check fails without
one. Same guarantee, no history, and the reason lands in the diff either way.

Failing when the count drops *below* the floor is deliberate. A floor that
silently outruns reality stops being a measurement; forcing the lower value
into the diff is how the gain gets recorded.

### The check ships as a test, not a CI job

`.github/workflows/test.yml` runs `bun run test:coverage` and `pre-push` runs
`bun test`, so a file named `scripts/spec-coverage.test.ts` is blocking in CI
and warning locally with no workflow edit — the same shape
`scripts/no-suppressions.test.ts` already has.

## Risks / Trade-offs

- **The floor is one aggregate number, so a new uncited criterion can be paid
  for by citing an unrelated old one.** → Accepted. Net traceability is
  unchanged either way, and per-capability floors are 17 numbers to maintain
  for a distinction nobody has asked for.
- **A citation comment can name a criterion the test below it does not
  actually assert.** → No mechanism can check this; it is the same trust a
  test name already carries. The citation is at least visible in the diff
  beside the assertions.
- **Rewording any scenario heading breaks every citation to it.** → Intended,
  and the failure names the citations. The cost is real for a typo fix in a
  heading.
- **The gate fires at archive, not at proposal.** → A change that wrote no
  tests discovers it when archiving rather than when applying. Earlier
  detection means counting delta specs, which breaks the proposal stage.
- **Existing tests stay uncited, so the number moves only when someone
  chooses to move it.** → That is the change being asked for; a backlog burn
  is a separate proposal.
