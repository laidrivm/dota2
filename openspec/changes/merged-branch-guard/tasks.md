# merged-branch-guard — tasks

Test tasks come from the proposal-stage `/zombies` run and are written before
the code they cover (docs/testing.md — TDD for edge cases). The bracketed
numbers are that run's idea numbers, so each of its 15 ideas is traceable to
the group that closes it.

Two groups, so two pull requests on `feat/merged-branch-guard-1` and `-2`, in
order. Group 1 ships the module and its tests with nothing calling it; group 2
wires it into the guard and shortens the prose the mechanism supersedes. The
seam between them is a module no shipped path calls, which is a horizontal
slice — so group 1 is not a released step on its own and group 2 follows it in
the same session.

## 1. The branch-state module

- [ ] 1.1 Extend `scripts/command-guard.fixture.ts` to fabricate a repository
      with an `origin` remote, a `main` branch on it, a branch pushed to it,
      and a reflog entry for `origin/main` at a caller-chosen age. The fixture
      is shared rather than copied, for the reason its own header already
      gives. (Req: agent-permissions — A commit on a merged branch is refused)
- [ ] 1.2 Write the mark-reading tests in
      `scripts/command-guard-branch.test.ts`: no marks at all is allowed [1];
      one `-` mark is merged [3]; `-` and `+` together is still merged [4];
      all `+` is not merged [5]. (Req: agent-permissions — A commit on a
      merged branch is refused)
- [ ] 1.3 Write the reachability tests: a branch with no ref under
      `refs/remotes/origin/` is never examined [15]; a branch name carrying a
      slash resolves its full remote ref [13]; a repository with no `origin`
      remote allows the commit [2]. (Req: agent-permissions — A commit on a
      merged branch is refused)
- [ ] 1.4 Write the freshness tests: exactly at the bound, fixing whether it
      is inclusive [6]; one second either side of it [7]; a future timestamp
      that must not compute a negative age [8]; an absent reflog, whose
      command exits 128, blocking [11]. (Req: agent-permissions — A commit on
      a merged branch is refused)
- [ ] 1.5 Write `scripts/branch-state.ts` against those tests: the three ref
      reads, the `FETCH_MAX_AGE` bound with its reason on its line, and a
      result that distinguishes merged, stale and unknown so the guard can
      word each refusal differently. It runs the reads in the repository a
      caller names, not in `cwd`, because `git commit -C <dir>` commits
      elsewhere. (Req: agent-permissions — A commit on a merged branch is
      refused)

## 2. Wiring, and the prose it supersedes

- [ ] 2.1 Write the guard-level tests in `scripts/command-guard-branch.test.ts`:
      a block exits exactly 2 [9]; the stale reason names the fetch and the
      merged reason names moving the work, distinguishably [10]; `git commit
      -C <other-repo>` is decided against the `-C` target [12]; a detached
      HEAD still reaches the existing branch-read refusal first [14]. (Req:
      agent-permissions — A commit on a merged branch is refused)
- [ ] 2.2 Call `branch-state.ts` from `command-guard.ts`'s `commit` arm, after
      the `main` check, and confirm `command-guard.ts` and every file this
      change touches stay under the 300-line cap `change-slicing` sets. (Req:
      agent-permissions — A commit on a merged branch is refused)
- [ ] 2.3 Measure the guard's per-call cost on a non-commit Bash call before
      and after, and record both numbers where the existing 16–22 ms figure is
      stated — the guard runs on every call, so a regression there is paid by
      every tool use, and the claim that only commits pay for this needs a
      measurement rather than a reading of the code. (Req: agent-permissions —
      A commit on a merged branch is refused)
- [ ] 2.4 Shorten `docs/git-and-prs.md`'s pull-request-state rule to what the
      guard cannot see — a merge that has not been fetched yet is refused
      rather than missed, so what remains for the prose is the judgement the
      guard declines to make: where the work goes once it is refused. (Req:
      agent-rulebook — A mechanised prohibition leaves its prose home)
