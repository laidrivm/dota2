# Skill provenance

## Why

This repository's review gates are symlinks. `.claude/skills/<name>` points at
a working tree in a separate repository, not at a commit, so whatever is
checked out there when a session starts *is* the gate. An edit in that
repository changes how `/triage`, `/zombies`, `/warm` and both CodeRabbit
skills behave here, and nothing in a d2ass diff shows it. The specification for
`agent-permissions` already records the consequence from the other side: a test
cannot pin a skill's frontmatter, because the content is untracked here and
absent from a clone.

The gap is not hypothetical. The analysis that asked for this change reported
three different base-branch conventions across the diff skills; all seven now
share one — `git rev-parse --abbrev-ref origin/HEAD`, falling back to `main` —
because they were fixed upstream in the meantime. The repository had no way to
say which state its own documentation had been checked against, so a correct
observation became a stale one silently.

The shared repository's `skills-lock.json` does not close this either. It
carries one entry, `playwright-cli`, the only skill genuinely vendored from
outside; its `computedHash` answers *was my copy edited?* and not *how far
behind am I?*.

## What Changes

- `docs/review-toolkit.md` gains a provenance table: each skill this project's
  gates depend on, and the shared-repo commit its documented contract was last
  verified against. A newer upstream commit is not a defect — it is a
  re-verification the next branch owes.
- The five skills symlinked here but named by no gate — `checklist`,
  `first-five`, `preflight`, `review-order`, `session-wrapup` — are marked
  archived in the same place: available to invoke, depended on by nothing, and
  carrying no verified-at commit, because nothing here would notice if they
  changed.
- A test pins the table's internal consistency: every skill named in the
  pre-PR sequence appears with a commit, and no archived entry carries one. It
  deliberately does not read through the symlinks, which resolve to nothing in
  a clone.
- The one change the shared repository needs — `ref` and `vendoredAt` beside
  `computedHash` in `skills-lock.json`'s single entry — is drafted here for the
  user to apply there.

## Non-goals

- **Editing the skills or their lock from this project.** `CLAUDE.md` routes
  those to the shared repository; this change drafts and hands over.
- **A CI check that the symlinks are current.** It would need the shared
  repository present, which CI does not have and a clone does not either.
- **Vendoring the skills into this repository.** It would end the drift and
  also end the sharing, which is the reason they are symlinks.
- **Fixing the skills' README.** Its invocable list and its base-branch
  sentence were checked against the skills as they stand and are accurate.
- **A commit per skill from separate reviews.** Every entry starts at the same
  commit because that is when each contract was checked; they diverge later,
  as each is re-verified on its own.

## Capabilities

### New Capabilities

- `skill-provenance`: which shared skills this project's gates depend on, what
  commit each was verified against, which are archived, and what the pin can
  and cannot check.

## Impact

- **Rules and docs**: `docs/review-toolkit.md` gains the table and the archived
  list.
- **Tests**: one new test file pinning the table, in the shape
  `readme-map.test.ts` already established for a parsed markdown table.
- **Elsewhere**: a drafted patch for `skills-lock.json` in the shared
  repository, applied by the user, not by this change.
