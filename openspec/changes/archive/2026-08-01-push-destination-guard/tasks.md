# Tasks — push destination guard

One group, one pull request on `feat/push-destination-guard-parse` — the
unsuffixed name belongs to the merged proposal branch. The parse and the
prose narrowing ship together, because a rule deleted before its mechanism
exists leaves the prohibition unenforced in between. Requirement citations are
the `### Requirement:` headings in `specs/agent-permissions/spec.md`.

## 1. The destination check

- [x] 1.1 Archive `mechanised-prohibitions` before starting, so this change's
      delta applies to `openspec/specs/agent-permissions/spec.md` rather than
      to an unarchived delta of it
- [x] 1.2 In `scripts/command-guard.ts`, block every `push` while
      `currentBranch()` is `main`, so no operand has to be identified as the
      repository — `-o <string>` takes a separate word and moves that operand
      by one — *The git prohibitions are enforced by a hook*
- [x] 1.3 From any other branch, read every operand as a refspec — skipping
      the value words of `-o`, `--push-option`, `--receive-pack`, `--exec` and
      `--repo` — and allow the push only when each destination is a concrete
      ref other than `main`: strip a leading `+`, take the text after the last
      `:` when there is one and the whole word when there is not, and block on
      `main`, on `refs/heads/main`, and on a destination the guard cannot
      bound — the bare `:` and `+:`, a `*`, an empty destination — *The git
      prohibitions are enforced by a hook*
- [x] 1.4 Block `--all`, `--branches`, `--mirror` and `--prune` — by prefix,
      since git resolves `--mir` and `--pru` — before anything reads a branch,
      so a detached `HEAD` does not decide them, and block a leading `+` on any
      refspec as a force-push — *The git prohibitions are enforced
      by a hook*
- [x] 1.5 Write two block reasons: one naming the refused destination, one for
      a command that names none — `--all`, `--branches`, `--mirror`, `--prune`,
      the matching refspec — which must not claim a destination it cannot name.
      Assert each
- [x] 1.6 Extend `scripts/command-guard.test.ts` with the blocked forms: a
      refspec destination, a bare `main`, `+HEAD:refs/heads/main`, `:main`,
      a second refspec aimed at `main` in `git push origin feat/x main`, the
      matching `:` and `+:`, a wildcard refspec, `+feat/x:feat/x` as a force,
      each of `--all`, `--branches`, `--mirror` and `--prune`, `--mir` as an
      abbreviation of one of them, and — from `main` — a bare
      `git push`, `git push origin feat/x`, and `git push -o ci.skip origin`,
      which is the form an operand split misreads
- [x] 1.6a Extend it with the allowed forms, which are what keep the check from
      blocking ordinary work: `HEAD:mainline`, `main:feat/x`,
      `git push origin HEAD` on a feature branch, no refspec on a feature
      branch, `git push -o main origin feat/x`, whose `main` is an option's
      value and not an operand, and the existing `git push -u origin feat/x`
- [x] 1.6b Cover the two cases the destination check shares with the paths
      around it: `--all` with a detached `HEAD` blocks on the flag without
      reaching `currentBranch()`, which blocks for its own reason on an
      unreadable head; and a push to `main` inside a command substitution
      blocks, so the check is confirmed on the recursive path and not only at
      the top level
- [x] 1.7 Watch each new assertion fail before it passes, by breaking the parse
      rather than by editing the assertion — at least the whole-token
      comparison and the last-colon split, which are what `mainline` and a
      colon in `<src>` turn on
- [x] 1.8 Confirm the guard fires live on `git push origin HEAD:main
      --dry-run`, since a hook is re-read per tool call and the authoring
      session can observe it, and the reason the harness prints is what the
      probe reads — the exit code is not visible from inside the session.
      `--dry-run` is what makes the probe safe: if the guard does not fire, git
      updates nothing, where the same probe without it would push to `main`
      exactly when the guard is broken
- [x] 1.9 Narrow the `CLAUDE.md` rule *Never push to `main`* to the residue the
      guard cannot read — a destination that comes from git configuration —
      and record in `PLAN.md` what the guard now covers and what it does not
- [x] 1.10 Grep the sites that restate the push prohibition — the change's own
      artefacts, `openspec/specs/**`, the README ownership map — and reconcile
      each
