# Pipeline yield

Continues `pipeline-yield-2026-08.md`. One entry per session, appended never
rewritten.

## 2026-09-01 — spec/notion-task-board (PR #258)

- diff-budget: PASS — 440 lines, then WARN at 528 and 602 as the branch grew;
  never near the 800 failing threshold
- triage: OPEN → PASS — 3 groups, 3 findings, 3 acted on (two figures wrong in
  the proposal, one scenario heading that named `archive` where the body meant
  the whole tree)
- grep: 2 sites found, 2 acted on — `docs/rulebook-growth.md`, whose protocol
  as written forbids what this change does, and `PLAN.md`'s own opening
  sentence
- coderabbit-local: BLOCKED — review refused: timed out. 0 findings. Two runs;
  the first was killed at 10 minutes still on `connecting_to_review_service`,
  the second ran hours and ended `{"type":"error","errorType":"timeout",
  "recoverable":false}` having emitted no other event. `coderabbit doctor`
  passed 9/9 both times, backend and WebSocket reachability included, so the
  service was reachable and simply never took the job.
- coderabbit: PASS — 5 findings, 5 acted on (all 🟠 Major, all applied under
  the project's apply-without-asking policy)
- coderabbit: PASS — 2 findings, 2 acted on (re-review after the fix push)
- Not run: warm (no dependency changed), zombies (a documentation branch runs
  step 1 → triage + grep → one coderabbit-local, and the `/zombies` pass this
  change owes belongs to its `tasks.md` on the `-plan` branch), first-five,
  review-order, preflight

**The cloud `coderabbit` covered for a `coderabbit-local` that never ran, and
found seven Major findings doing it.** Every one was a contradiction inside
the specification the branch was adding — a card shape that said "nothing
else" while the delta gave the card a title and a body, a view required
without saying which view, a SQL prohibition with the exception parked in a
scenario under it. A local pass would have been the cheaper place to catch
them; the sequence's last step caught them instead, which is the argument for
keeping it rather than for trimming it.

**One finding was right about a fact I had already read and recorded wrongly.**
The bot asked whether the status group values were Notion ids or names.
Re-reading the live property to answer showed the spec said "three groups"
where the property renders five keys, and did not say that what a card carries
is an option name. The bot named a gap; the gap turned out to contain an error
it had not seen.

**Four of the seven findings were about text this session had written within
the hour**, on a branch that had already passed triage and a grep sweep.
Neither of those gates reads a specification for internal consistency, and
nothing in the sequence does except the bot.

**`coderabbit review` exits 0 on a non-recoverable timeout.** The run that
produced no review at all returned the same status as one that reviews
cleanly, and the only thing separating them is an `error` event in the
`--agent` stream. Anything deciding this gate on the exit status — a hook, a
driving agent, a CI step — reads a review that never happened as a pass. Read
the stream, not the status.

## 2026-09-16 — notion-task-board, applied across five branches, synced and archived

- diff-budget: WARN 563 / PASS 498 / WARN 703 / WARN 799 / PASS 317 / WARN 672 / PASS 0 / PASS 245 — 8 runs, 2 re-cuts forced. One branch measured 2538 against a failing threshold of 800 and became five; branch 1 then went 701 → 857 when the ZOMBIES cases landed and split again at the seam `tasks.md` already drew.
- zombies: PASS — 10 gaps, 10 acted on (step 2); PASS — 4 gaps, 4 acted on (step 3); PASS — 3 gaps, 3 acted on (step 7)
- grep (documentation-branch gate): PASS — 1 site, 0 sites, 3 sites across three branches — 4 findings, 4 acted on
- triage: PASS — 1 Medium, 1 High, 1 Medium, 1 High + 1 Medium, 2 Medium, 1 High + 2 Medium across six branches — 3 findings, 3 acted on
- coderabbit-local: PASS 4/4 then 7/7 then BLOCKED on a service timeout; PASS 2/2 then 1/1; BLOCKED on timeout then PASS 0 findings run retrospectively from the merge base; PASS 1/1; timed out after 3 findings, 3 acted on; PASS 3/3 then 2/2 — 23 findings, 23 dispositioned
- coderabbit (PR #277): PASS — 4 findings, 3 applied, 1 rejected (its routing reading was inverted: it argued D2ASS from the change *not* touching workflows, where D2ASS is defined positively by `src/`, `e2e/` and product specs)
- coderabbit (PR #278): PASS — 2 findings, 1 applied, 1 already fixed on an unpushed commit
- Not run: warm (no dependency manifest changed on any of the seven branches), ponytail-review, preflight, code-review, security-review
- Not run and owed: zombies against `glob-row-example`'s proposal text, which `docs/feature-workflow.md` Stage 1 requires before a proposal is finalised. The proposal was written and committed without it.

Two things this session puts on the record rather than in a gate line.

**`/triage` returned three findings in six runs**, against a contract that says
it "returns no findings by design" and a ledger where it has mostly returned
none: the missing `outcome-calibration` → `match-harvest` edge, which no
`## Ordering` scan could have found because that change has no such section;
an obligation naming three of eight statuses and pointing at no vocabulary for
the other five; and the reconciliation of 36 leaving queue entries against the
cards meant to replace them. All three came from *reading the High group*
rather than from the map, which is what the gate asks for and what makes the
difference between it yielding and not.

**`/coderabbit-local` timed out on four of eleven runs** — twice on the same
branch, and twice leaving a branch handed to the user on a gate that never
closed. One was recovered by re-running against the merge base after the fact
(`--base 33abde3`), which returned 0 findings; the other was superseded by the
PR bot's completed review of the same diff. A timeout emits findings and then
dies without a `complete` event, so a gate read from the findings alone
reports PASS on a review that reached no conclusion — which is what happened
once here before it was corrected.
