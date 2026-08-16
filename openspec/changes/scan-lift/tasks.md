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
      escaped quote, which both implementations already handle
- [ ] 1.2 Parameterise `scripts/scan.ts`'s walk by what it collects and export
      `comments(source, language)` returning `{ text, line, block }[]`, the
      shape `mutation-floor.ts` already defines. One internal scan, so a fix to
      the state machine reaches both exports. `blank`'s signature and behaviour
      do not change
- [ ] 1.3 Cover the new export in `scripts/scan.test.ts` on the shapes the walk
      exists for and `blank`'s cases cannot reach, because they are about what
      is returned rather than what survives: a block comment's opening line
      when its text spans lines, a `//` inside a block comment and a `/*`
      inside a line comment, a comment inside a template interpolation, and a
      CSS file where `//` is not a comment
- [ ] 1.4 Switch `scripts/mutation-floor.ts` to the new export and delete its
      private `comments()`. 1.1's case now passes. Run `bunx --no-install
      stryker run && bun scripts/mutation-floor.ts` and record the surviving
      count: `src/model.ts` holds no regex literal, so the prediction is that
      it does not move. If it does, move `FLOOR` with the reason on its line as
      `mutation-floor` requires, and name here the directive that became
      visible
- [ ] 1.5 Switch `scripts/spec-coverage.ts` to the new export: derive which
      lines sit inside a block comment from the comment list — a block opening
      on line *n* whose text spans *k* newlines encloses *n* through *n + k* —
      and delete the per-line strip with the `ponytail:` comment standing over
      it. 1.1's case now passes. Keep two cases the derivation must not lose: a
      citation inside a commented-out block still does not count, and one below
      a block that has closed still does
- [ ] 1.6 Record `bun scripts/spec-coverage.ts`'s uncited count before and
      after 1.5. A citation the old scanner dropped becomes visible, so the
      count can only fall or hold; lower `FLOOR` to whatever it now reads, with
      the reason on its line. A count that *rises* means the derivation is
      wrong and 1.5 is not done
- [ ] 1.7 Delete `scripts/mutation-floor-exemptions.test.ts`, redistributing
      its cases by what they exercise: scanning to `scripts/scan.test.ts`,
      directive grammar to `scripts/mutation-floor.test.ts`. Drop a case only
      where `scan.test.ts` already covers it, and name each dropped case here
      beside the case that covers it — a lift shrinks the count on purpose, and
      an unnamed drop is indistinguishable from a case lost by accident
- [ ] 1.8 Compare the full set of describe paths across
      `scripts/scan.test.ts`, `scripts/mutation-floor.test.ts` and
      `scripts/spec-coverage.test.ts` before and after 1.7, per `CLAUDE.md`.
      The set changes by exactly the cases named in 1.7 and by 1.1's two
      additions
- [ ] 1.9 Measure every file this change touched against its cap and record the
      numbers, whether or not any is over: `scripts/scan.ts`,
      `scripts/scan.test.ts`, `scripts/mutation-floor.ts`,
      `scripts/mutation-floor.test.ts`, `scripts/spec-coverage.ts`,
      `scripts/spec-coverage.test.ts`. `file-size-cap` step 7.5 left
      `mutation-floor.test.ts` at 219 against 300 and asked for this
- [ ] 1.10 Add the rule of two to `CLAUDE.md`'s Code list, in its own commit
      per the rule about a rules edit no artefact asks for. Tighten the
      neighbouring rule rather than appending a variant if it already covers
      the direction: the existing one is *Before inlining a single-caller
      helper, grep for the logic it duplicates elsewhere*, which is the
      opposite direction and stays
- [ ] 1.11 Confirm `src/app/module-classes.test.ts` is untouched by this change
      and passes — it is `blank`'s only production caller and therefore the
      control on the parameterisation in 1.2
