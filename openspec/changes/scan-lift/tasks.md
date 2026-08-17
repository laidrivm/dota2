# scan-lift — tasks

One group, so this change ships whole on `feat/scan-lift`. It closes two
acceptance criteria: `mutation-floor`'s *A directive below a regex literal* and
`spec-test-traceability`'s *A citation below an escaped quote*.

## 1. One scan, two views

- [ ] 1.1 Add the two failing cases first, against the implementations as they
      stand, and record that each fails. `scripts/mutation-floor.test.ts`: a
      source holding `` const re = /[`]/; `` and a `// Stryker disable
      next-line all` comment below it, asserting `exemptions()` reports the
      comment. `scripts/spec-coverage.test.ts`: a test file holding `const s =
      "he said \"/*\"";` and a `// spec:` citation below it, asserting the
      citation is found. A case that passes before the switch pins nothing —
      the control is the same source without the regex literal and without the
      escaped quote, which both implementations already handle (*A directive below a regex literal*, *A citation below an escaped quote*)
- [ ] 1.2 Parameterise `scripts/scan.ts`'s walk by what it collects and export
      `comments(source, language)` returning `{ text, line, block }[]`, the
      shape `mutation-floor.ts` already defines. One internal scan, so a fix to
      the state machine reaches both exports. `blank`'s signature and behaviour
      do not change (*A directive below a regex literal*, *A citation below an escaped quote*)
- [ ] 1.3 Cover the new export in `scripts/scan.test.ts` on the shapes the walk
      exists for and `blank`'s cases cannot reach, because they are about what
      is returned rather than what survives: a block comment's opening line
      when its text spans lines, a `//` inside a block comment and a `/*`
      inside a line comment, a comment inside a template interpolation, and a
      CSS file where `//` is not a comment. `blank`'s own cases have gaps that
      matter more once every scan routes through this module — a regex literal
      containing `/*`, an escaped backtick, an unterminated template, CRLF —
      so close the ones the new export makes reachable and name the rest here
      (*A directive below a regex literal*, *A citation below an escaped quote*)
- [ ] 1.4 Switch `scripts/mutation-floor.ts` to the new export and delete its
      private `comments()`. 1.1's case now passes. Run `bunx --no-install
      stryker run && bun scripts/mutation-floor.ts` and record the surviving
      count: `src/model.ts` holds no regex literal, so the prediction is that
      it does not move. If it does, move `FLOOR` with the reason on its line as
      `mutation-floor` requires, and name here the directive that became
      visible (*A directive below a regex literal*)
- [ ] 1.5 Switch `scripts/spec-coverage.ts` to the new export: derive which
      lines sit inside a block comment from the comment list — a block opening
      on line *n* whose text spans *k* newlines encloses *n* through *n + k* —
      and delete the per-line strip with the `ponytail:` comment standing over
      it. 1.1's case now passes. Keep two cases the derivation must not lose: a
      citation inside a commented-out block still does not count, and one below
      a block that has closed still does (*A citation below an escaped quote*)
- [ ] 1.6 Record the *set* of cited identifiers before and after 1.5, not only
      the count, and set `FLOOR` to whatever the new count reads with the
      reason on its line. The count moves in either direction and neither is a
      defect on its own: a citation the old scanner dropped becomes visible and
      lowers it, and a false one it accepted disappears and raises it —
      `CITATION` matches a line-leading `// spec:` inside a multi-line template
      literal today, measured, because the per-line strip only removes quoted
      spans that open and close on one line. Read the set difference and say
      which citations moved and why; a count compared alone cannot tell the two
      apart (*A citation below an escaped quote*)
- [ ] 1.7 Delete `scripts/mutation-floor-exemptions.test.ts`, redistributing
      its cases by what they exercise: scanning to `scripts/scan.test.ts`,
      directive grammar to `scripts/mutation-floor.test.ts`. Drop a case only
      where `scan.test.ts` already covers it, and name each dropped case here
      beside the case that covers it — a lift shrinks the count on purpose, and
      an unnamed drop is indistinguishable from a case lost by accident
      (*A directive below a regex literal*, *A citation below an escaped quote*)
- [ ] 1.8 Compare the full set of describe paths across
      `scripts/scan.test.ts`, `scripts/mutation-floor.test.ts` and
      `scripts/spec-coverage.test.ts` before and after 1.7, per `CLAUDE.md`.
      The set changes by exactly the cases named in 1.7 and by 1.1's two
      additions (*A directive below a regex literal*, *A citation below an escaped quote*)
- [ ] 1.9 Measure every capped file this change touched and record the numbers,
      whether or not any is over. The cap covers `.ts`, `.tsx` and `.css`, so
      `CLAUDE.md` is not in this list — the always-on budget in its own
      §*Structure & growth of this file* is what governs it, and 1.10 is where
      that is checked. Capped: `scripts/scan.ts`,
      `scripts/scan.test.ts`, `scripts/mutation-floor.ts`,
      `scripts/mutation-floor.test.ts`, `scripts/spec-coverage.ts`,
      `scripts/spec-coverage.test.ts`. `file-size-cap` step 7.5 left
      `mutation-floor.test.ts` at 219 against 300 and asked for this (*change-slicing/No source file exceeds its per-file cap*)
- [ ] 1.10 Add the rule of two to `CLAUDE.md`'s Code list, in its own commit
      per the rule about a rules edit no artefact asks for. Tighten the
      neighbouring rule rather than appending a variant if it already covers
      the direction: the existing one is *Before inlining a single-caller
      helper, grep for the logic it duplicates elsewhere*, which is the
      opposite direction and stays. Check the always-on budget after adding it:
      `CLAUDE.md` plus `PLAN.md` against ~500 lines (*context-budget/The trigger is read
      against the sum* — this change's own two criteria are closed elsewhere,
      and citing one here would be false)
- [ ] 1.11 Confirm `src/app/module-classes.test.ts` is untouched by this change
      and passes — it is `blank`'s only production caller and therefore the
      control on the parameterisation in 1.2 (*A directive below a regex literal*, *A citation below an escaped quote*)
