# glob-row-example — tasks

One acceptance criterion is in scope, the only one this change touches:
`repo-onboarding/a-glob-row`. It is closed by nothing new — the case that
already exercises it is `checks/readme-map.test.ts`, which resolves every row
of the live map and named no path before this change or after it.

One task group, so this ships whole on `feat/glob-row-example` rather than as
a numbered step.

## 1. The scenario's trigger

Closes: *Every path the map names is real and shipped*

- [ ] 1.1 Sync the `MODIFIED` delta into
      `openspec/specs/repo-onboarding/spec.md`, checking first that it carries
      all seven scenarios the live requirement has — the replacement is
      whole-requirement, so one omitted is one deleted
- [ ] 1.2 Confirm the only difference between the live requirement before and
      after is the `WHEN` line of **A glob row** and the paragraph under it:
      diff the two blocks rather than reading them, since six of the seven
      scenarios are meant to be byte-identical
- [ ] 1.3 Check the illustration is a row the map actually has —
      `docs/research/*` at the time of writing — by reading it out of
      `README.md`'s map rather than out of this change's prose
- [ ] 1.4 `bun test checks/readme-map.test.ts` passes unchanged, and no case
      in it mentions `tasks/*.md` or `docs/research/*`: the scenario is read
      by people and resolved by nothing, which is what makes this a wording
      change
- [ ] 1.5 Run the pre-PR sequence per `docs/review-toolkit.md`. A branch of
      documentation and specs takes the short one: `bun run diff-budget`,
      `/triage`, the grep for every site restating what changes, then one pass
      of `/coderabbit-local`
- [ ] 1.6 Grep `tasks/*.md` across the live tree before calling it done, and
      expect exactly the hits the archive and this change's own artefacts
      carry — an archived change is never edited, so hits under
      `openspec/changes/archive/**` are the correct answer rather than
      leftovers
- [ ] 1.7 Move this change's card on its board to the status each stage
      reaches, in the same turn rather than afterwards
