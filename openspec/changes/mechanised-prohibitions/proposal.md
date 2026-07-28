# Mechanised prohibitions

## Why

A prohibition written as prose is executed probabilistically; a `deny` entry
or a hook is executed deterministically. Several of this repository's rules are
pure prohibitions with no judgement in them — do not commit on main, do not
force-push, do not post to a PR on the user's behalf, do not suppress a linter
finding, do not commit a secret. Each of those can move from `CLAUDE.md` into
a mechanism, and each move both frees context and strengthens the guarantee.
That combination is rare enough to be worth taking wherever it appears.

The rules list has a second problem the first one exposes. Its ~20-rule
maintenance trigger fires across the whole list at once, but the rules are not
one kind: rules about this code age with the code and should be evicted as it
changes, while process and safety rules never age. Mixed together, the trigger
finds nothing safe to evict. Splitting the list is what makes eviction
possible, and it also sorts out which rules are hook candidates.

A third, smaller thing follows. The list carries *When a rule or a recorded
decision changes, grep every site that restates it* — a rule that exists
because duplication was already created, treating the symptom. `PLAN.md`
restates the pre-PR gate sequence that `docs/review-toolkit.md` owns. Deleting
that copy removes one way for the two to diverge.

## What Changes

**Deny and hook (the agent's own boundary)**

- `.claude/settings.json` gains `permissions.deny` entries for the GitHub
  write commands the agent must never issue on the user's behalf:
  `gh pr comment`, `gh issue comment`, `gh pr review`. `gh pr create` is
  deliberately not denied — Stage 3 of the feature workflow ends by offering to
  open the PR, and it is opened once the user says go. The prose rule is
  narrowed in the same breath to name replying, commenting and reviewing, so
  that "post on the user's behalf" stops reading as a ban on the PR the user
  asked for.
- A `PreToolUse` hook guards the two git prohibitions that a prefix-matched
  `deny` entry cannot express: committing while `HEAD` is on `main`, and any
  force-push, whatever argument position the flag arrives in.

**Repository gates (everyone's boundary)**

- `gitleaks` runs in CI against the branch, pinned by image digest the way
  `actionlint` already is, and in the pre-commit hook when the binary is
  present locally.
- A CI check greps tracked sources for `biome-ignore`, `@ts-expect-error` and
  `@ts-ignore`, skipping its own script and test, which must spell the markers
  out. The repository has none today, so the check is green on arrival; an
  approved suppression is admitted by naming its path, its marker and its count
  in the check's own allowlist, which is then visible in the diff.

**The rulebook**

- The `CLAUDE.md` rules list splits into **code**, **process** and **safety**,
  so the ~20-rule trigger applies per sublist and the code sublist is the one
  that gets evicted as the code changes.
- Every prohibition this change mechanises leaves its prose home, wherever it
  lives — the commit-on-main and force-push sentences go from Git & PRs, the
  suppression rule goes from the rules list, and the two the mechanisms cover
  only in part (posting on the user's behalf, secrets) are cut back to the
  remainder rather than deleted.
- `PLAN.md`'s "Gates (reminder)" section is deleted; `docs/review-toolkit.md`
  keeps sole ownership of the pre-PR sequence. The grep rule is narrowed
  rather than dropped, because `openspec/specs/**` and the README ownership
  map still restate things this change does not touch.

## Non-goals

- **Mechanising `curl … | bash`.** A permission rule matches each subcommand
  independently, so the pipe's shell side would need `Bash(bash)` denied
  wholesale, which is far broader than the rule. It stays prose.
- **Mechanising the secrets rule in full.** `gitleaks` finds tokens and keys;
  it does not know that a path is machine-local or that an identifier is
  internal. That part of the rule stays prose, shortened to what the scanner
  cannot see.
- **A hook that reads vendored skill frontmatter.** The reconciliation rule
  stays prose — the skills are symlinks to untracked content, which
  `agent-permissions` already records as the reason a test cannot pin them.
- **Denying `gh api`.** Its write calls are shaped by flags, not by a command
  prefix, and the agent has no current reason to use it for writes.
- **Moving the pre-PR sequence to `docs/feature-workflow.md`.** It already has
  one owner in `docs/review-toolkit.md`; `feature-workflow.md` references it
  without restating it. Only the `PLAN.md` copy is a genuine duplicate.

## Capabilities

### New Capabilities

- `commit-gates`: the secret scan and the suppression check — what runs before
  a commit and in CI, for every author rather than only for the agent.
- `agent-rulebook`: how `CLAUDE.md`'s rules list is partitioned, what makes a
  rule evictable, and the requirement that a mechanised prohibition leaves its
  prose home.

### Modified Capabilities

- `agent-permissions`: the deny list grows past package managers to the GitHub
  write commands, and the capability gains a hook alongside its permission
  entries — the existing spec says permission rules are the enforcement, which
  is no longer the whole story.

## Impact

- **Config**: `.claude/settings.json` (deny entries, `hooks.PreToolUse`);
  `package.json` (`simple-git-hooks.pre-commit`); `.github/workflows/lint.yml`.
- **New files**: the git guard hook script and the suppression check under
  `scripts/`.
- **Rules and docs**: `CLAUDE.md` (Git & PRs, Rules), `PLAN.md` (the Gates
  section goes), `README.md` (ownership map rows for anything new), and
  `agent-permissions.test.ts`, which currently pins the policy.
- **Behaviour change for the agent**: it can no longer force-push at all, not
  merely after a PR is open, and can no longer commit on `main` even when the
  user asks in the moment — both become the user's to do.
