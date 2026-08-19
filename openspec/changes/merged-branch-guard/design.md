# merged-branch-guard — design

## Context

`scripts/command-guard.ts` is a `PreToolUse` hook on every Bash call. It
already reads the current branch on a `git commit` to refuse one on `main`,
so the event, the parse and the branch read are all in place; what is missing
is a second question asked at the same point.

The prose rule it would relieve is `docs/git-and-prs.md`: re-check a pushed
branch's pull-request state before every commit to it, as a call whose output
is read before the write. It is a rule about doing something first, which is
the kind a session skips without noticing — on 2026-08-19 it was not run at
all, and four commits landed on a branch whose pull request had merged seven
hours earlier.

Four measurements taken on this repository shape everything below. Each is a
count of the prefixes `git cherry` printed, or a command's own output:

- **A** — a merged branch against a fresh `origin/main`: 3 lines, every one
  `-`. Equivalence detection works with no network.
- **B** — the same branch against the `origin/main` the session actually
  held (`fdfb6d1`): 10 lines, every one `+`. A verdict computed then would
  have said "not merged", so detection alone would have missed the incident.
- **C** — a branch freshly created from `origin/main`, no commits yet: zero
  lines. A rule reading "no `+` lines means merged" refuses every branch's
  first commit.
- **D** — `git rev-parse --verify refs/remotes/origin/<branch>` separates a
  branch that exists on the remote from one that does not, and
  `git reflog show origin/main --date=unix` prints the last fetch as a Unix
  timestamp. Both are local.

A fifth, taken as the negative control this design needs: this branch, one
commit, unmerged and unpushed, printed 1 line, prefix `+`, and zero `-`.

## Goals / Non-Goals

**Goals:**

- Refuse a commit that would be stranded, at the moment it is attempted.
- Cost nothing on a branch that cannot have been merged, which is the
  branch most work happens on.
- Refuse rather than guess when the answer cannot be computed, matching the
  rule the guard's own header states.

**Non-Goals:**

- Any network call. The guard's measured cost is 16–22 ms per Bash call, and
  it runs on every one of them; a fetch or a `gh` call per commit is a
  different order, and offline it would degrade into measurement B — the
  behaviour that missed the merge.
- Guarding `git push`. A push from a merged branch strands nothing the
  commit did not already strand.
- Choosing where stranded work should go instead. The guard refuses the
  commit; recovering the branch is a judgement it should not make.

## Decisions

### Merge is detected by equivalence, not by asking GitHub

`git cherry <upstream> <head>` marks each commit on the branch `-` when an
equivalent patch is already upstream and `+` when it is not. A squash merge
rewrites the commits, so no SHA of the branch appears in `main` afterwards
and containment tests such as `git branch --merged` say nothing; equivalence
is what survives the rewrite. Measurement A confirms it on a real
squash-merged branch, and the negative control confirms the other direction.

*Alternative considered*: `gh pr list --head <branch> --state merged`, which
is what the prose rule tells a human to run. It is authoritative, and it
needs the network, an authenticated `gh`, and a GitHub remote — three things
a commit should not depend on, on a hook that runs on every Bash call.

### The verdict is "at least one `-`", not "no `+`"

Measurement C rules out the negative form directly: a branch with no commits
prints nothing, and "no `+` lines" would read that as merged and refuse the
first commit of every branch ever created.

The positive form is also the one that survives the incident. Once a stranded
commit exists the branch prints `+` for it, so a rule requiring every line to
be `-` goes quiet exactly one commit too early; the `-` lines from the merged
commits remain for as long as the branch does. The negative control shows a
healthy branch carries none of them.

### The check engages only for a branch that exists on the remote

A branch with no counterpart under `refs/remotes/origin/` was never pushed,
so no pull request of it can have merged, and no amount of staleness changes
that. `git rev-parse --verify --quiet refs/remotes/origin/<branch>`
(measurement D) is one local call, and it lets the whole staleness question —
and its cost to the user — apply only where a merge is possible.

This is the decision that makes refusing on stale data affordable. Without
it, every commit in the repository would depend on a recent fetch.

### A stale `origin/main` is undecidable, and undecidable blocks

Measurement B is the incident: the ref was 17 hours old, the verdict it
produced was wrong, and it was wrong in the passing direction. So on a pushed
branch the guard reads the last fetch time from
`git reflog show origin/main --date=unix` and refuses the commit when it is
older than `FETCH_MAX_AGE`, naming the fetch as the fix. `git config
core.logAllRefUpdates` is `true` here and defaults to true for a non-bare
repository; where the reflog is absent `git reflog show` exits 128, which is
read as unknown and therefore as a refusal, on the same terms.

`FETCH_MAX_AGE` is 30 minutes. It bounds how long a merge can go unseen, and
its cost is one `git fetch origin main` at most twice an hour while
committing on a pushed branch. The number is a judgement, not a measurement,
and it carries its reason on its line so that moving it moves the reason too.

*Alternative considered*: the mtime of `.git/refs/remotes/origin/main`. It is
one `stat` and no subprocess, but a packed ref has no such file and the
mtime then belongs to `packed-refs`, which every other ref update also
touches.

### The git interrogation is its own module

`scripts/command-guard.ts` stands at 246 lines against the 300-line cap in
`change-slicing`. Three ref reads with the comments this repository writes do
not fit under it, and a file is split to the cap that will apply to it rather
than the one that applies today. The branch questions — is this branch on the
remote, is any of its work already upstream, how old is `origin/main` — go to
`scripts/branch-state.ts`, leaving `command-guard.ts` holding what the
prohibitions are.

That seam already exists: `command-parse.ts` holds how a command line is
read, and the guard's own header says what it keeps is "what the
prohibitions themselves are". Asking git about a branch is the same kind of
thing as parsing a command line — a fact the guard consumes, not a rule it
states.

## Risks / Trade-offs

- **Offline work on a pushed branch is blocked** → the branch that cannot be
  fetched is also the branch whose merge state cannot be known, which is the
  case this change exists to refuse. The cost is bounded by the previous
  decision: an unpushed branch never asks, so the ordinary local loop —
  branch, commit, commit, push — is untouched until the push.
- **A branch that cherry-picked a commit which also landed upstream shows
  `-` without having merged** → it is refused. Over-refusing costs one
  `--no-verify`-free conversation with the user, where under-refusing costs
  the stranded work this change is named after; the guard already resolves
  its uncertainty this way for `git push` operands.
- **The check reads `origin/main` as the base for every branch** → a branch
  cut from another branch is measured against `main` regardless. That is the
  right base for the stranding question, since a merged pull request lands in
  `main`, but it means a stacked branch whose parent has merged is refused
  for the parent's commits rather than its own. Naming the merged commits in
  the refusal message is what tells the two apart.
- **The guard grows a second reason to spawn git** → a pushed branch costs
  three local git calls on a commit instead of one. All three are local ref
  reads; the branch read the guard already does is the expensive one, and it
  is already paid.

## Open Questions

None. The staleness policy was settled with the user before this document was
written: freshness is required, and only for a branch that exists on the
remote.
