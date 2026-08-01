# Tasks — review approval direction

One group, one pull request on `fix/review-approval-direction`. Requirement
citations are the `### Requirement:` headings in
`specs/local-review-loop/spec.md`.

## 1. The policy and its four sites

- [x] 1.1 Rename *Major and above are fixed without asking* to *A verified
      finding is fixed without asking* in
      `openspec/specs/local-review-loop/spec.md`, widen the override to every
      severity, and add the Minor scenario beside the Major one — *A verified
      finding is fixed without asking*
- [ ] 1.2 Add *Dismissing a Major or above is the user's call*, with the gate
      line reading `OPEN` on a pending dismissal and never on a pending fix —
      *Dismissing a Major or above is the user's call*
- [ ] 1.3 Reconcile `docs/review-toolkit.md:30-32` and `:48-50`: both entries
      say Major and above are applied without asking, and both become the fix
      side plus the dismissal side
- [ ] 1.4 Reconcile `PLAN.md:94` and `:365-370`, which record the original
      decision. The historical statement of what `coderabbit-local-gate`
      settled stays accurate; what changes is the policy it points at, so
      correct the forward-looking sentence and leave the record of the decision
- [ ] 1.5 Update the capability's Purpose paragraph
      (`openspec/specs/local-review-loop/spec.md:6`), which describes the loop
      as "what it fixes without asking" — the same one-sided framing, in the
      sentence that introduces the whole capability
- [ ] 1.6 Grep for any further site restating either half before calling this
      done — the five above are what a grep for "without asking" and "No fixes
      before approval" returned across `docs/`, `PLAN.md`, `CLAUDE.md` and
      `openspec/`
- [ ] 1.7 Draft the matching wording for `coderabbit` and `coderabbit-local` in
      the skills repository and hand it to the user; do not edit the skills
      from this project
- [x] 1.8 Put the two Major dismissals already made on
      `mechanised-prohibitions` to the user — the `gh` deny scenarios and the
      suppression scan's extension set, both closed under the old reading. Done
      before apply: the user upheld both, so `mechanised-prohibitions` needs no
      revision on their account
