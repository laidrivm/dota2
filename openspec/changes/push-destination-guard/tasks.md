# Tasks — push destination guard

One group, one pull request on `feat/push-destination-guard`. The parse and the
prose narrowing ship together, because a rule deleted before its mechanism
exists leaves the prohibition unenforced in between. Requirement citations are
the `### Requirement:` headings in `specs/agent-permissions/spec.md`.

## 1. The destination check

- [ ] 1.1 Archive `mechanised-prohibitions` before starting, so this change's
      delta applies to `openspec/specs/agent-permissions/spec.md` rather than
      to an unarchived delta of it
- [ ] 1.2 In `scripts/command-guard.ts`, read each non-option argument of a
      `push` as a refspec: strip a leading `+`, take the text after the last
      `:` when there is one and the whole word when there is not, and block
      when it equals `main` or `refs/heads/main` — *The git prohibitions are
      enforced by a hook*
- [ ] 1.3 Block a `push` carrying no refspec while `currentBranch()` is `main`,
      reusing the call the commit path already makes, and block `--all`,
      `--branches` and `--mirror` outright — *The git prohibitions are enforced
      by a hook*
- [ ] 1.4 Write the block reason as one message naming the refused destination
      and the remedy — push the branch and open a pull request
- [ ] 1.5 Extend `scripts/command-guard.test.ts` with the blocked forms: a
      refspec destination, a bare `main`, `+HEAD:refs/heads/main`, `:main`
      whose `<src>` is empty because it deletes the branch, a second refspec
      aimed at `main` in `git push origin feat/x main`, no refspec on `main`,
      and each of `--all`, `--branches` and `--mirror`
- [ ] 1.6 Extend it with the allowed forms, which are what keep the check from
      blocking ordinary work: `HEAD:mainline`, `main:feat/x`, no refspec on a
      feature branch, and the existing `git push -u origin feat/x`
- [ ] 1.6a Cover the three cases the destination check shares with the paths
      around it: the block reason names the refused destination, as the force
      path's reason is already asserted; `--all` with a detached `HEAD` blocks
      on the flag without reaching `currentBranch()`, which blocks for its own
      reason on an unreadable head; and a push to `main` inside a command
      substitution blocks, so the check is confirmed on the recursive path and
      not only at the top level
- [ ] 1.7 Watch each new assertion fail before it passes, by breaking the parse
      rather than by editing the assertion — at least the whole-token
      comparison and the last-colon split, which are what `mainline` and a
      colon in `<src>` turn on
- [ ] 1.8 Confirm the guard fires live on `git push origin HEAD:main`, since a
      hook is re-read per tool call and the authoring session can observe it
- [ ] 1.9 Narrow the `CLAUDE.md` rule *Never push to `main`* to the residue the
      guard cannot read — a destination that comes from git configuration —
      and record in `PLAN.md` what the guard now covers and what it does not
- [ ] 1.10 Grep the sites that restate the push prohibition — the change's own
      artefacts, `openspec/specs/**`, the README ownership map — and reconcile
      each
