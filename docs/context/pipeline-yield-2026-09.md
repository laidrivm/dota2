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
- coderabbit-local: BLOCKED — review did not return. Two runs, ~40 minutes
  total, neither leaving `connecting_to_review_service`; `coderabbit doctor`
  passed 9/9 both times including backend and WebSocket reachability, so the
  service was not taking the job. **0 findings, and that is not a clean pass.**
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
