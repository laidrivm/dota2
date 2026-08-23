# Git & PRs

Indexed from `CLAUDE.md`, which holds the rule quality bar and the
single-source rule this file inherits. A prohibition that becomes a `deny`
entry, a hook or a CI check leaves this file the way it would leave
`CLAUDE.md`: the prose goes, so the mechanism is the only boundary.

- One reviewable unit = one branch = one PR. The unit is the **step**: a
  change whose `tasks.md` holds more than one task group ships as one PR per
  group, in the order the groups appear, on `feat/<proposal-slug>-<step>`. A
  change whose `tasks.md` holds exactly one group is the exception and ships
  whole on `feat/<proposal-slug>` (`fix/`, `chore/` for non-feature work).
- A proposal ships on `spec/<proposal-slug>`; `feat/<proposal-slug>` is the
  implementation's, and a squash-merged branch is never freed — check the name
  against closed pull requests before branching, never against the base's
  ancestry, which reports a squash-merged branch as unmerged.
- Commits: imperative subject ≤ 72 chars, body only when the diff doesn't
  explain itself. Commit per completed task-list item, not per file.
- The only trailer a commit carries is `Co-Authored-By: Claude Opus 5
  <noreply@anthropic.com>` — no session URL, no run id, whatever the harness
  offers by default.
- Never configure a push to `main` — `remote.<name>.push`, `push.default` set
  to `matching`, `upstream` or `tracking`, `remote.<name>.mirror` — the guard
  reads the command's own words and cannot see a destination that comes from
  configuration.
- Open PRs ready for review, not as drafts — CodeRabbit's auto-review skips
  drafts, so a draft is a PR nobody reviews.
- Keep the PR description to what the diff can't say: a link to the
  proposal, the criteria the step closes named by their `### Requirement:`
  headings — or a line saying it closes none — decisions taken, anything the
  reviewer must check by hand. Never write a walkthrough, a file-by-file
  summary, or the text of an acceptance criterion — CodeRabbit generates
  those on every run.
- Re-check a pushed branch's PR state before every commit to it, as a call
  whose output you read before the write — a check chained into the same
  command as the commit runs but cannot stop it. A merged PR strands anything
  added afterwards, whichever merge style closed it.
- Commit a session's wrap-up artefacts — the pipeline-yield ledger, a save
  point — to the branch in hand, never a branch of their own.
- Never reply, comment or review under the user's name anywhere the `gh` deny
  entries do not reach — a tracker, a forum, any external service: report what
  you would have written and let them send it. Opening the pull request they
  asked for is not that.
- Never re-run a check whose own output already proved it passed and whose
  inputs have not changed since — a later command's success is not that proof.
- Never wait on a result someone else produces — CI, a review bot, a queue:
  report where it will appear and end the turn.
- This repo is public: before anything is staged or committed, read every new
  file whole, `git diff HEAD` for the rest, and the commit message about to be
  written, looking for capability URLs, internal and account identifiers, and
  machine-local files — what the secret scan cannot recognise. A diff against
  the index shows nothing of an untracked file and nothing of an unstaged edit,
  and no hook reads the message at all. Flag anything questionable instead of
  committing it.

## Git mechanics

Rules about how work is carried out here. They do not age with the code, and
they route through `CLAUDE.md`'s fix & capture loop like every other rule.

- Never bypass a git hook with `--no-verify`, `SKIP_SIMPLE_GIT_HOOKS` or a
  `core.hooksPath` override; run it or ask.
- Fetch the base before branching from it or measuring against it, and run the
  typecheck and the suite on it before the branch — a commit made through a
  web UI never ran the pre-push hook, and a gate that names no base reports a
  stale one exactly as it reports a fresh one.
- Create a branch with `git switch -c <name>` or `--no-track`, never tracking
  `origin/main`.
- Rebase a branch whose base was amended with `git rebase --onto <new base>
  <old base> <branch>`, never `git rebase <new base>`.
- Commit the work before a probe whose undo is `git checkout <path>`,
  `git reset --hard`, or `git stash drop`.
- Never move the working tree off a branch whose work is unpushed — cut the
  next branch in a worktree instead.
- Stage explicit paths in a worktree you scaffolded; `git add -A` there commits
  the scaffolding.
- Never state another repository's mutable properties — visibility, default
  branch, owner — anywhere in this repo; link to it instead.
