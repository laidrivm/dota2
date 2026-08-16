# pre-push-parity — tasks

One step, so one pull request, on `feat/pre-push-parity` — the implementation
branch, this proposal's own being `spec/pre-push-parity`. The four groups below
are that step's tasks, not four steps: the change is one line of
`package.json`, the tests over it, and the specifications that bind it. It
closes all five of the `commit-gates` criteria and both restatements.

**Ordering.** This change SHALL archive after `file-size-cap`, for the reason
`design.md` gives: both carry a `MODIFIED` delta on `mutation-floor`'s first
requirement, this one carries the other's text in full, and archiving in the
other order would revert the prefix command back to a file name — the very
defect that started this.

## 1. The hook runs the gates

- [x] 1.1 Extend `simple-git-hooks.pre-push` in `package.json` with `biome ci`,
      `bun run lint:yaml`, `bun run lint:suppressions`, and the mutation gate's
      three steps in the workflow's order — delete `reports/mutation`, run
      Stryker, run the floor. Keep the diff budget last and still absorbed
      (*The budget is still soft*)
- [x] 1.2 Guard `actionlint` and `gitleaks` with `command -v`, the spelling the
      pre-commit hook already uses for `gitleaks`, so an absent binary skips
      rather than fails (*A tool the machine does not have*)
- [x] 1.3 Run `bun run prepare` so the hook on disk matches `package.json`, and
      confirm `.git/hooks/pre-push` carries the new command — the file is what
      runs, and `simple-git-hooks` rewrites it only when told to

## 2. Probe each gate by failing it

- [x] 2.1 Probe the mutation gate by refusing it, on `CLAUDE.md`'s terms: break
      a case the model's tests rely on, confirm the hook blocks the push and
      names the survivor count, then restore. The work is committed first, per
      the rule about a probe whose undo is `git checkout` (*A gate that CI would
      fail blocks the push instead*)
- [x] 2.2 Probe an optional tool that is present and failing: install neither,
      but stand in for one with a `command -v`-visible stub that exits non-zero,
      and confirm the push is blocked (*A tool the machine has, reporting a
      finding*)
- [x] 2.3 Probe the skip path with an input the session has not cleared: with
      neither binary on `PATH`, confirm the hook completes and says nothing
      about them. Report what the hook returned, not what a prompt did
- [x] 2.4 Probe the budget's exception: confirm a diff over 800 lines still
      prints `FAIL` and still pushes. No branch in the tree is over 800 — the
      largest measured 763 — so the live probe was not available and 3.4 covers
      it with a stub that makes the budget script fail. Recorded rather than
      ticked as if a real branch had been used
- [x] 2.5 Confirm `bun test` does not execute Stryker in either place it runs
      (*The gate is not picked up by the suite*)
- [x] 2.6 Time the full hook and record the number here beside `design.md`'s
      estimate of 17 s. Re-run the older measurement if the new one contradicts
      it, per the rule. Measured 20 s end to end. The components were re-timed
      rather than assumed stale: 0.17 + 0.06 + 0.05 + 0.19 + 14.9 + 4.85 =
      20.2 s, so the estimate was not contradicted but superseded — it summed
      the checks, and the sum omits one bun start per command

## 3. The tests derived from /zombies

The `/zombies` pass over this proposal is where these come from; its numbering
is kept so a reader can find the item each one closes. They land in
`commit-gates.test.ts`, which already drives the pre-commit hook with stubbed
binaries on a `PATH` — the same harness this half needs, and the reason no new
one is written.

- [x] 3.1 With neither optional binary on `PATH`, the hook exits 0 and names
      neither tool [1] (*A tool the machine does not have*)
- [x] 3.2 `gitleaks` present and reporting a finding exits non-zero [9], and
      `actionlint` present and reporting a workflow error exits non-zero [10].
      The shape that breaks both is `command -v … && tool …`, which swallows
      the failure — the pre-commit half already guards its own case that way
      (*A tool the machine has, reporting a finding*)
- [x] 3.3 A surviving-mutant count above the floor exits non-zero [8] (*A gate
      that CI would fail blocks the push instead*)
- [x] 3.4 A branch at exactly 800 counted lines exits 0 from the hook [5], the
      same count that fails the CI check (*The budget is still soft*)
- [x] 3.5 With two gates failing, the hook stops at the first and names it [4,
      7] — `&&` chaining is what makes the message name one gate
- [x] 3.6 The hook on disk at `.git/hooks/pre-push` matches `package.json`
      after `bun run prepare` [13] — the file is what runs, and the two drift
      silently
- [x] 3.7 Dispositioned without a test, with the reason: [2] the report
      deletion is asserted by 3.3 reaching a verdict at all; [3] and [6] are the
      happy path and the exit-code contract, which every case above rests on and
      none can pass without; [11] a missing `node` is a tool problem the
      `design.md` risk names and a stub cannot reproduce faithfully; [12] a
      missing script is caught by the suite that runs those scripts

## 4. The list gets one home

- [x] 4.1 Update `README.md`'s hook section: it names two of the three checks
      the hook runs today and will name none of the four added. It is the
      ownership map's entry point for a clone, so it links to `commit-gates`
      rather than restating the list (*The list has one home*)
- [x] 4.2 Grep the four places a claim like this is restated — this change's
      sibling artefacts, `openspec/specs/**`, `PLAN.md`, and the README
      ownership map — searching the wording being replaced (`type check and
      \`bun test\` only`, `its own CI job`), not the wording replacing it
- [x] 4.3 Record in `PLAN.md` that this change archives after `file-size-cap`,
      so the ordering survives a session boundary rather than living only in
      `design.md`

## 5. The criteria this change carries but does not implement

The two `MODIFIED` deltas restate whole requirements, so they carry scenarios
this change does not touch. Each is confirmed still true rather than cited for
work that does not exist — a citation for a criterion nothing implements is
bookkeeping, and the two that describe CI-only behaviour are named here as not
being this change's to verify.

- [x] 5.1 Confirm the push path still starts no browser: no Playwright binary
      is spawned by the hook, checked by running it and looking for the process
      rather than by reading the command (*The push path starts no browser*)
- [x] 5.2 Confirm the mutation gate still kills the same set after the hook
      change — the survivor count is the floor, not merely below it (*A mutant
      the tests assert against*, *The suite is the only killer*, *The model's
      tests move to another file*)
- [x] 5.3 `smoke-suite`'s *A green run uploads nothing* is CI workflow
      behaviour this change does not touch and cannot exercise from a hook. It
      is carried by the delta because `MODIFIED` takes whole requirements, and
      no task claims it
