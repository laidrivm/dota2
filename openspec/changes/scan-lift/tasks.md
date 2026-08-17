# scan-lift — tasks

One group, so this change ships whole on `feat/scan-lift`. It closes two
acceptance criteria: `mutation-floor`'s *A directive below a regex literal* and
`spec-test-traceability`'s *A citation below an escaped quote*.

## 1. One scan, two views

- [x] 1.1 Add the two failing cases first, against the implementations as they
      stand, and record that each fails. `scripts/mutation-floor.test.ts`: a
      source holding `` const re = /[`]/; `` and a `// Stryker disable
      next-line all` comment below it, asserting `exemptions()` reports the
      comment. `scripts/spec-coverage.test.ts`: a test file holding `const s =
      "he said \"/*\"";` and a `// spec:` citation below it, asserting the
      citation is found. A case that passes before the switch pins nothing —
      the control is the same source without the regex literal and without the
      escaped quote, which both implementations already handle (*A directive below a regex literal*, *A citation below an escaped quote*)
      — measured: both new cases fail, both controls pass.
- [x] 1.2 Parameterise `scripts/scan.ts`'s walk by what it collects and export
      `comments(source, language)` returning `{ text, line, block }[]`, the
      shape `mutation-floor.ts` already defines. One internal scan, so a fix to
      the state machine reaches both exports. `blank`'s signature and behaviour
      do not change (*A directive below a regex literal*, *A citation below an escaped quote*)
      — `line` is counted from the offsets the walk records rather than tracked
      inside it, so a branch that jumps the cursor cannot drift out of step
      with it.
- [x] 1.3 Cover the new export in `scripts/scan.test.ts` on the shapes the walk
      exists for and `blank`'s cases cannot reach, because they are about what
      is returned rather than what survives: a block comment's opening line
      when its text spans lines, a `//` inside a block comment and a `/*`
      inside a line comment, a comment inside a template interpolation, and a
      CSS file where `//` is not a comment. `blank`'s own cases have gaps that
      matter more once every scan routes through this module — a regex literal
      containing `/*`, an escaped backtick, an unterminated template, CRLF —
      so close the ones the new export makes reachable and name the rest here
      (*A directive below a regex literal*, *A citation below an escaped quote*)
      — all four turned out reachable through the new export and are closed;
      none is left named.
- [x] 1.4 Switch `scripts/mutation-floor.ts` to the new export and delete its
      private `comments()`. 1.1's case now passes. Run `bunx --no-install
      stryker run && bun scripts/mutation-floor.ts` and record the surviving
      count: `src/model.ts` holds no regex literal, so the prediction is that
      it does not move. If it does, move `FLOOR` with the reason on its line as
      `mutation-floor` requires, and name here the directive that became
      visible (*A directive below a regex literal*)
      — measured: 267 mutants, 200 killed, 67 surviving against a floor of 67.
      It did not move, and no directive became visible; `src/model.ts` carries
      no disable comment at all. The switch also broke
      `mutation-floor-cli.test.ts`, which stands a copy of the check beside a
      tree of its own: the copy now needs `scan.ts` beside it, and the fixture
      exports it.
- [x] 1.5 Switch `scripts/spec-coverage.ts` to the new export: derive which
      lines sit inside a block comment from the comment list — a block opening
      on line *n* whose text spans *k* newlines encloses *n* through *n + k* —
      and delete the per-line strip with the `ponytail:` comment standing over
      it. 1.1's case now passes. Keep two cases the derivation must not lose: a
      citation inside a commented-out block still does not count, and one below
      a block that has closed still does (*A citation below an escaped quote*)
      — the derivation took a second half this task did not name: a citation
      line is one the scan reports a `//` comment on. Without it the escaped
      quote closes and a `// spec:` marker quoted in a multi-line template
      stays a citation, so 1.6's second prediction could not have come true.
      A block's opening line is deliberately left un-enclosed, which is what
      the per-line strip did too: code may precede the `/*` on it, and
      enclosing it would let a statement between a citation and its call pass
      as a separator.
- [x] 1.6 Record the *set* of cited identifiers before and after 1.5, not only
      the count, and set `FLOOR` to whatever the new count reads with the
      reason on its line. The count moves in either direction and neither is a
      defect on its own: a citation the old scanner dropped becomes visible and
      lowers it, and a false one it accepted disappears and raises it —
      `CITATION` matches a line-leading `// spec:` inside a multi-line template
      literal today, measured, because the per-line strip only removes quoted
      spans that open and close on one line. Read the set difference and say
      which citations moved and why; a count compared alone cannot tell the two
      apart (*A citation below an escaped quote*)
      — measured: the set is identical across the switch, 37 identifiers both
      sides, 384 uncited both sides, so `FLOOR` stays at 384 and its reason
      stands. Nothing moved in either direction: no test file in the tree holds
      a citation below an escaped quote, and none holds a line-leading
      `// spec:` inside a multi-line template. The template case was live in
      the implementation rather than in the tree, and the new case in
      `spec-coverage.test.ts` is what pins it now that it cannot recur.
- [x] 1.7 Empty `scripts/mutation-floor-exemptions.test.ts`, redistributing its
      cases by what they exercise: scanning to `scripts/scan.test.ts`, and the
      rest across the seam between what a directive must *say* and which
      comments the check *reads*. Drop a case only where `scan.test.ts` already
      covers it, and name each dropped case here beside the case that covers it
      — a lift shrinks the count on purpose, and an unnamed drop is
      indistinguishable from a case lost by accident
      (*A directive below a regex literal*, *A citation below an escaped quote*)
      — measured before doing it: the grammar cases are ~164 lines and
      `mutation-floor.test.ts` is 237 against a cap of 300, so the design's
      "the grammar cases have room" does not hold and the file cannot receive
      them. Split at the seam instead, which is also the seam the lift creates:
      `mutation-floor-directives.test.ts` (renamed from the exemptions file,
      134 lines) holds the `DISABLE`/`ADMITTED` grammar, and a new
      `mutation-floor-comments.test.ts` (79) holds which comments
      `exemptions()` reaches — the half that is about the lifted scan.
      `mutation-floor.test.ts` keeps the arithmetic and the floor and gives
      1.1's case to the comments file. Eight cases dropped, each beside the
      `scan.test.ts` case that covers it:
      - *a `/*` inside a line comment opens no block* → the case of that name
      - *a quote that opens no string does not silence the file* → *a quote
        inside a regex literal opens no string*
      - *an escaped newline still counts as a line* → *an escaped newline
        inside a template still ends a line*
      - *one behind an escaped quote is still inside the string* → *an escaped
        quote does not end its string early*
      - *one inside a block comment is not one* → *a `//` inside a block
        comment opens no line comment*
      - *one inside a multi-line template literal is not one* → *a comment
        marker in template text is text*
      - *one inside a string literal is not one* → *a comment marker inside a
        string is not one*
      - *one on a line whose block comment opened earlier is not one* → *a
        plain comment opener in a string opens no block either*
- [x] 1.8 Compare the full set of describe paths across
      `scripts/scan.test.ts`, `scripts/mutation-floor.test.ts` and
      `scripts/spec-coverage.test.ts` before and after 1.7, per `CLAUDE.md`.
      The set changes by exactly the cases named in 1.7 and by 1.1's two
      additions (*A directive below a regex literal*, *A citation below an escaped quote*)
      — measured with `bun test --reporter=junit`, whose `classname` is the
      describe path; the default reporter names passing tests nowhere. Baseline
      over `mutation-floor.test.ts`, `mutation-floor-exemptions.test.ts` and
      `scan.test.ts`; result over `mutation-floor.test.ts`,
      `mutation-floor-directives.test.ts`, `mutation-floor-comments.test.ts`
      and `scan.test.ts` — the emptied file on one side and both destinations
      on the other. `spec-coverage.test.ts` is in this task's list and is
      deliberately in neither: 1.7 moved no case into or out of it, so
      including it would add its 1.1 and 1.5 cases to a diff that is 1.7's.
      94 paths before, 86 after, and the difference is exactly the eight drops named
      there plus two cases that changed describe rather than leaving: *a
      directive spanning a block comment's first line is found* moved to *a
      directive Stryker honours outside a line comment*, and *a well-formed one
      still fails, because the spelling is not the form* became *the accepted
      spelling > a well-formed block-comment directive still fails*. The
      baseline was taken after 1.1 and 1.3 rather than on the base commit, so
      their additions sit on both sides and this diff is 1.7's alone.
- [x] 1.9 Measure every capped file this change touched and record the numbers,
      whether or not any is over. The cap covers `.ts`, `.tsx` and `.css`, so
      `CLAUDE.md` is not in this list — the always-on budget in its own
      §*Structure & growth of this file* is what governs it, and 1.10 is where
      that is checked. Capped: `scripts/scan.ts`,
      `scripts/scan.test.ts`, `scripts/mutation-floor.ts`,
      `scripts/mutation-floor.test.ts`, `scripts/spec-coverage.ts`,
      `scripts/spec-coverage.test.ts`. `file-size-cap` step 7.5 left
      `mutation-floor.test.ts` at 219 against 300 and asked for this (*change-slicing/No source file exceeds its per-file cap*)
      — measured, all against 300 and none over: `scan.ts` 236,
      `scan.test.ts` 167, `mutation-floor.ts` 223, `mutation-floor.test.ts`
      221, `mutation-floor-directives.test.ts` 134,
      `mutation-floor-comments.test.ts` 79, `spec-coverage.ts` 248,
      `spec-coverage.test.ts` 252. Two more the task did not list, both touched
      because the CLI case now stands a copy of the check beside its import:
      `mutation-floor-cli.test.ts` 105 and `mutation-floor.fixture.ts` 63. The
      new file was staged before the gate ran, which reads tracked files only.
- [x] 1.10 Add the rule of two to `CLAUDE.md`'s Code list, in its own commit
      per the rule about a rules edit no artefact asks for. Tighten the
      neighbouring rule rather than appending a variant if it already covers
      the direction: the existing one is *Before inlining a single-caller
      helper, grep for the logic it duplicates elsewhere*, which is the
      opposite direction and stays. Check the always-on budget after adding it:
      `CLAUDE.md` plus `PLAN.md` against ~500 lines (*context-budget/The trigger is read
      against the sum* — this change's own two criteria are closed elsewhere,
      and citing one here would be false)
      — added as *Lift logic into one module at its second caller, never into a
      second copy*, above the inlining rule it pairs with; that rule covers the
      opposite direction and stands unchanged. Budget after: `CLAUDE.md` 263 +
      `PLAN.md` 197 = 460 against ~500, under the trigger.
- [x] 1.11 Confirm `src/app/module-classes.test.ts` is untouched by this change
      and passes — it is `blank`'s only production caller and therefore the
      control on the parameterisation in 1.2 (*A directive below a regex literal*, *A citation below an escaped quote*)
      — `git diff HEAD` over it and its subject is empty, and its 39 tests pass.
