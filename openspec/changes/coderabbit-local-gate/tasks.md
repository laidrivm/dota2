# Tasks — CodeRabbit local review as a pre-push gate

Requirement names are those in `specs/local-review-loop/spec.md`.

Sequenced after `vendored-skill-permissions`: both edit
`docs/review-toolkit.md`, and that change also trims the `/coderabbit` bullet
this one writes next to.

`/zombies` at propose returned no test ideas — the change is rules only.

## 1. Preconditions the user owns

- [ ] 1.1 Ask the user to run `brew install coderabbit` — never the published
      `curl … | sh` installer, and never install it on their behalf
- [ ] 1.2 Ask the user to run `cr auth login`, which is interactive (suggest
      the `!` prefix so its output lands in the session)
- [ ] 1.3 Run `cr doctor` and confirm it exits zero before writing any rule
      that depends on it (*The gate runs after triage and before the push* →
      "The CLI is unavailable")

## 2. Settle whether the CLI is aligned with the PR bot

Nothing in group 3 may be written until this group is done — an unaligned
local reviewer doubles the noise instead of cutting it.

- [ ] 2.1 Run one `cr review --base main --plain` on a branch that touches a
      path covered by a `path_instructions` block (`**/*.{ts,tsx}` is the
      broadest)
- [ ] 2.2 Run `cr review --show-prompts` and read whether the saved prompts
      carry this repo's `path_instructions` and the `code_guidelines` pointer
      at `**/CLAUDE.md` (*The local reviewer is aligned with the PR bot* →
      "The saved prompts carry this repo's instructions")
- [ ] 2.3 Record the answer in this change's design as settled, and pick the
      invocation the gate prescribes: plain `cr review` if the config is read,
      `cr review --config .coderabbit.yaml CLAUDE.md` if it is not (→ "The
      saved prompts do not carry them")
- [ ] 2.4 If neither 2.1 nor 2.2 could run, stop and report — do not write the
      rule (→ "The question is unanswered")

## 3. Write the gate into docs/review-toolkit.md

- [ ] 3.1 Add a `/coderabbit-local [base]` bullet to the skills list, stating
      that the agent invokes it and that Major and above are applied without
      asking (*Major and above are fixed without asking*)
- [ ] 3.2 In the same bullet, state the loop: at most three reviews with
      fixes between them, stopping early when a review returns nothing above
      Minor; report and stop if Major or above survives the third
      (*The loop terminates*)
- [ ] 3.3 State that Minor findings are collected across passes and reported
      once at the end (*Minor findings are reported once, at the end*)
- [ ] 3.4 Move the pre-PR sequence's ending from `/triage` to
      `/coderabbit-local`, and give a documentation, rules or config branch a
      single pass (*The gate runs after triage and before the push* → "A
      documentation branch")
- [ ] 3.5 Next to the `/coderabbit` bullet, state why that one stays the
      user's and this one does not — the PR bot's wait, absent from a
      synchronous CLI review — so the pair does not read as a contradiction
- [ ] 3.6 Extend the fix & capture routing with the skipped-Minor case: a
      settled convention becomes a rule, a one-off does not (*A justification
      survives only when it is a convention*)

## 4. Reconcile the repo

- [ ] 4.1 Grep every site restating the pre-PR sequence —
      `docs/review-toolkit.md`, `CLAUDE.md`, `docs/feature-workflow.md`,
      `docs/testing.md`, `PLAN.md`, `README.md` — and reconcile them (rule in
      `CLAUDE.md`)
- [x] 4.2 Confirm `.coderabbit.yaml` still names `**/CLAUDE.md` under
      `knowledge_base.code_guidelines.filePatterns` — the whole
      justification-feedback route depends on it (*A justification survives
      only when it is a convention*)
- [ ] 4.3 Update `PLAN.md`: queue entry, status, and the decisions this
      change settles

## 5. Review gates

- [ ] 5.1 `/triage` over the final diff, per the `CLAUDE.md` rule that a
      branch of rules runs `/triage` alone plus the grep in 4.1
- [ ] 5.2 Run `/coderabbit-local` once over this branch, with the invocation
      settled in 2.3 — the change that introduces the gate is the first to go
      through it; skip with a note if groups 1 and 2 could not be done
- [ ] 5.3 Open the PR from `chore/coderabbit-local-gate`
