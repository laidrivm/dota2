# pre-push-parity — tasks

One step, so one pull request, on `feat/pre-push-parity`. It closes all four of
the `commit-gates` criteria and both restatements; the other two steps' worth of
work does not exist because the change is one line of `package.json` and the
specifications that bind it.

**Ordering.** This change SHALL archive after `file-size-cap`, for the reason
`design.md` gives: both carry a `MODIFIED` delta on `mutation-floor`'s first
requirement, this one carries the other's text in full, and archiving in the
other order would revert the prefix command back to a file name — the very
defect that started this.

## 1. The hook runs the gates

- [ ] 1.1 Extend `simple-git-hooks.pre-push` in `package.json` with `biome ci`,
      `bun run lint:yaml`, `bun run lint:suppressions`, and the mutation gate's
      three steps in the workflow's order — delete `reports/mutation`, run
      Stryker, run the floor. Keep the diff budget last and still absorbed
      (*The budget is still soft*)
- [ ] 1.2 Guard `actionlint` and `gitleaks` with `command -v`, the spelling the
      pre-commit hook already uses for `gitleaks`, so an absent binary skips
      rather than fails (*A tool the machine does not have*)
- [ ] 1.3 Run `bun run prepare` so the hook on disk matches `package.json`, and
      confirm `.git/hooks/pre-push` carries the new command — the file is what
      runs, and `simple-git-hooks` rewrites it only when told to

## 2. Probe each gate by failing it

- [ ] 2.1 Probe the mutation gate by refusing it, on `CLAUDE.md`'s terms: break
      a case the model's tests rely on, confirm the hook blocks the push and
      names the survivor count, then restore. The work is committed first, per
      the rule about a probe whose undo is `git checkout` (*A gate that CI would
      fail blocks the push instead*)
- [ ] 2.2 Probe an optional tool that is present and failing: install neither,
      but stand in for one with a `command -v`-visible stub that exits non-zero,
      and confirm the push is blocked (*A tool the machine has, reporting a
      finding*)
- [ ] 2.3 Probe the skip path with an input the session has not cleared: with
      neither binary on `PATH`, confirm the hook completes and says nothing
      about them. Report what the hook returned, not what a prompt did
- [ ] 2.4 Probe the budget's exception: confirm a diff over 800 lines still
      prints `FAIL` and still pushes. `file-size-cap`'s own branches are over
      500 already, so a real one is at hand rather than fabricated
- [ ] 2.5 Confirm `bun test` does not execute Stryker in either place it runs
      (*The gate is not picked up by the suite*)
- [ ] 2.6 Time the full hook and record the number here beside `design.md`'s
      estimate of 17 s. Re-run the older measurement if the new one contradicts
      it, per the rule

## 3. The list gets one home

- [ ] 3.1 Update `README.md`'s hook section: it names two of the three checks
      the hook runs today and will name none of the four added. It is the
      ownership map's entry point for a clone, so it links to `commit-gates`
      rather than restating the list (*The list has one home*)
- [ ] 3.2 Grep the four places a claim like this is restated — this change's
      sibling artefacts, `openspec/specs/**`, `PLAN.md`, and the README
      ownership map — searching the wording being replaced (`type check and
      \`bun test\` only`, `its own CI job`), not the wording replacing it
- [ ] 3.3 Record in `PLAN.md` that this change archives after `file-size-cap`,
      so the ordering survives a session boundary rather than living only in
      `design.md`

## 4. The criteria this change carries but does not implement

The two `MODIFIED` deltas restate whole requirements, so they carry scenarios
this change does not touch. Each is confirmed still true rather than cited for
work that does not exist — a citation for a criterion nothing implements is
bookkeeping, and the two that describe CI-only behaviour are named here as not
being this change's to verify.

- [ ] 4.1 Confirm the push path still starts no browser: no Playwright binary
      is spawned by the hook, checked by running it and looking for the process
      rather than by reading the command (*The push path starts no browser*)
- [ ] 4.2 Confirm the mutation gate still kills the same set after the hook
      change — the survivor count is the floor, not merely below it (*A mutant
      the tests assert against*, *The suite is the only killer*, *The model's
      tests move to another file*)
- [ ] 4.3 `smoke-suite`'s *A green run uploads nothing* is CI workflow
      behaviour this change does not touch and cannot exercise from a hook. It
      is carried by the delta because `MODIFIED` takes whole requirements, and
      no task claims it
