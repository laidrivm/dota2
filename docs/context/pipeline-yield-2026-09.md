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
