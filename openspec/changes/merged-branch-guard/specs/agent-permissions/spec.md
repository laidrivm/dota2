# agent-permissions — delta spec

## ADDED Requirements

### Requirement: A commit on a merged branch is refused

The hook SHALL block a `git commit` on a branch whose work is already
upstream, because a merged pull request strands every commit made to its
branch afterwards, whatever merge style closed it. It SHALL decide this with
local git only — no fetch, no `gh`, no network — since it runs on every Bash
call and an offline session must not silently lose the check.

The verdict SHALL be taken from `git cherry`, which marks a commit `-` when an
equivalent patch is already upstream and `+` when it is not, and equivalence
is what survives a squash merge rewriting the branch's commits. A branch SHALL
be treated as merged when at least one of its commits is marked `-`. The rule
SHALL NOT be stated as the absence of `+` marks: a branch with no commits
prints neither mark, and the absence form refuses the first commit of every
branch created.

The check SHALL engage only for a branch that exists under
`refs/remotes/origin/`. A branch with no remote counterpart was never pushed,
so no pull request of it can have merged, and its commit SHALL pass without
the branch being examined further.

For a branch that does exist there, the hook SHALL refuse the commit unless
`origin/main` was fetched within a bounded age, read from git's reflog. A
verdict computed against a stale ref reports a merged branch as unmerged, and
that is the failure this requirement exists for rather than an edge of it. An
unreadable fetch time SHALL be treated as unknown and therefore as a refusal,
on the terms this capability already applies to an undecidable event. The
bound SHALL carry the reason it holds its value on its own line.

Each refusal SHALL name what the agent is to do next — move the work to a
branch cut from the merged base, or fetch — because a block whose remedy is
unstated is a block the session works around.

#### Scenario: A commit on a branch whose pull request merged

- **WHEN** the agent attempts `git commit` on a pushed branch whose commits
  `git cherry` marks `-` against a recently fetched `origin/main`
- **THEN** the hook blocks the call, and the reason names the branch as
  already merged

#### Scenario: The branch was never pushed

- **WHEN** the agent attempts `git commit` on a branch with no ref under
  `refs/remotes/origin/`
- **THEN** the commit is allowed, whatever the age of `origin/main`, because
  no pull request of that branch can have merged

#### Scenario: The first commit of a new branch

- **WHEN** the agent attempts `git commit` on a branch freshly cut from
  `origin/main`, which carries no commits and so no `git cherry` marks at all
- **THEN** the commit is allowed, because no mark is the absence of evidence
  and not evidence of a merge

#### Scenario: A pushed branch with work of its own

- **WHEN** the agent attempts `git commit` on a pushed branch whose commits
  `git cherry` marks `+` against a recently fetched `origin/main`
- **THEN** the commit is allowed

#### Scenario: The base ref is stale

- **WHEN** the agent attempts `git commit` on a pushed branch and
  `origin/main` was last fetched longer ago than the bound
- **THEN** the hook blocks the call, and the reason names fetching
  `origin/main` as what makes the branch decidable

#### Scenario: The fetch time cannot be read

- **WHEN** `origin/main` has no reflog, so the command reading its fetch time
  exits non-zero
- **THEN** the hook blocks the call on a pushed branch, because an unknown
  answer takes the blocking path

#### Scenario: A stranded commit already exists

- **WHEN** a commit has already been made on the merged branch, so
  `git cherry` marks that one `+` while the merged commits stay `-`
- **THEN** the hook still blocks, because the merged commits' marks remain
  for as long as the branch does
