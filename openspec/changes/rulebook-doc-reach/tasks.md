# rulebook-doc-reach — tasks

One task group, so this change ships whole on `chore/rulebook-doc-reach`.
No test task: the criterion is about where prose may stand, and nothing in
the suite parses prohibition prose — `rulebook.test.ts` reads the three rules
sublists, which this change does not touch. A `/zombies` pass over it returns
nothing above the Simple category for that reason.

## 1. Widen the requirement's reach

- [ ] 1.1 Sync the delta into `openspec/specs/agent-rulebook/spec.md`,
      carrying all four scenarios — the replacement is whole-requirement.
      (Req: agent-rulebook — A mechanised prohibition leaves its prose home)
- [ ] 1.2 Re-read `CLAUDE.md` and every doc it indexes — not only
      `docs/git-and-prs.md`, which is merely where the prose moved — against
      the mechanisms that already exist: the command guard, the pre-commit and
      the pre-push hook. Delete or shorten every sentence the widened
      requirement now reaches, in whichever of those files holds it. (Req:
      agent-rulebook — A mechanised prohibition leaves its prose home)
