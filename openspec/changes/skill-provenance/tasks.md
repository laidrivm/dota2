# Tasks — skill provenance

One group, one pull request on `feat/skill-provenance-table` — the unsuffixed
name belongs to the merged proposal branch. Requirement citations
are the `### Requirement:` headings in `specs/skill-provenance/spec.md`.
Bracketed numbers cite the `/zombies` ideas raised at propose.

## 1. The table, its pin, and the hand-off

- [ ] 1.1 Verify each gate skill's contract as `docs/review-toolkit.md`
      describes it against its `SKILL.md` in the shared repository — `/zombies`,
      `/warm`, `/triage`, `/coderabbit-local`, `/coderabbit`, plus
      `playwright-cli`, which `CLAUDE.md` names in a rule rather than in the
      sequence. Correct this file wherever the two disagree, in this same
      change — *Every gate skill records the commit it was verified against*
- [ ] 1.2 Add the provenance table to `docs/review-toolkit.md` with the commit
      the verification in 1.1 was made at, re-read from the shared repository
      rather than copied from `design.md` — *Every gate skill records the
      commit it was verified against*
- [ ] 1.3 List `checklist`, `first-five`, `preflight`, `review-order` and
      `session-wrapup` as archived, with no commit and one line saying what
      archived means here — *Skills no gate depends on are marked archived*
- [ ] 1.4 Write `skill-provenance.test.ts`, deriving the active set from the
      pre-PR sequence in the same file plus the skills `CLAUDE.md`'s rules
      depend on, rather than from a second hand-kept list (7), and never
      resolving `.claude/skills/` (11) — *The table is pinned by a test, within
      what a clone can see*
- [ ] 1.5 Cover in that test: an emptied or renamed table, and a renamed
      source heading that empties the active set, both fail on the empty set
      itself rather than passing every per-skill assertion vacuously (1, 2);
      one row parses to a name
      and a commit (3); 7- and 40-character object names are accepted (4, 5)
      and a 6-character cell is not (6); a sequenced skill with no row fails
      (8); an archived row carrying a commit fails (9); a prose cell such as
      `latest` or a bare date fails (10); one skill in two active rows fails;
      an active row for a skill neither source names fails; a skill listed as
      both active and archived fails
- [ ] 1.6 Watch each assertion fail before it passes, by breaking the table
      rather than by editing the assertion — the length-assertion lesson in
      `docs/verification.md` applies to the zero-row case in particular
- [ ] 1.7 Draft the `skills-lock.json` patch for the shared repository — `ref`
      and `vendoredAt` beside `computedHash` on the single `playwright-cli`
      entry — and hand it to the user; do not edit that repository from here
- [ ] 1.8 Reconcile the sites restating what this change adds. `README.md:21`
      is already wrong: its ownership row calls the directory
      "triage/zombies/warm/coderabbit" where six skills are gates, missing
      `coderabbit-local` and `playwright-cli` — `readme-map.test.ts` pins the
      map's paths and not its descriptions, so it drifted unnoticed. Also
      `README.md:100`, `openspec/specs/repo-onboarding/spec.md:8` and
      `openspec/specs/agent-permissions/spec.md:43` and `:166`, which carry the
      untracked-symlink reasoning this change leans on, and
      `docs/feature-workflow.md:30`, which cites `skills-lock.json` by name
