# Review bot instructions

## Why

Five local skills and the PR bot read the same diff. The bot earns its place
only where it knows something they do not, and today it is pointed almost
entirely at code the local skills already cover.

Two gaps are unclaimed by any local skill, by design:

- **Nobody reviews the specification.** Proposals open as their own PRs here,
  and `docs/feature-workflow.md` says the questions a spec review would ask are
  "cheap to fix here, expensive after apply" — yet no skill reads a delta spec
  against `openspec/config.yaml`'s own rules: EARS form, measurable values
  rather than adjectives, a Non-goals section, every criterion cited by a task.
- **Nobody checks an implementation against its proposal.** `/triage` maps the
  diff, `/zombies` finds test gaps, `/ponytail-review` hunts over-engineering.
  None of them opens the change the diff is supposed to implement.

Separately, three rules in this repository — *never call an unfamiliar
framework/library API from memory* in `CLAUDE.md`, the Playwright-documentation
rule in `docs/testing.md`, and the grep-the-receiving-class step the
`first-five` skill prescribes — are all executed by one side, the agent, on its
word. The grep confirms a method is absent from *this* codebase; it says
nothing about whether it exists in Preact, Bun or Playwright at the version
installed. The reviewer currently cannot check any of it.

## What Changes

**The two unclaimed reviews**

- `path_instructions` for `openspec/changes/**`: check EARS form, measurable
  values rather than adjectives, the presence of Non-goals, and that every
  acceptance criterion is cited by at least one task — this project's own rules
  from `openspec/config.yaml`, applied by a second reader.
- `path_instructions` for `src/**`: check the diff against the active change's
  `proposal.md`, `design.md`, `tasks.md` and delta specs — whether every
  criterion it claims is actually met, and whether anything appears that the
  proposal never asked for.

**The bot inside the loops it is outside of**

- A ponytail instruction: flag an abstraction with a single caller, a parameter
  or option with no current consumer, and any new dependency. Linters do not
  cover these and the bot finds them well.
- A fix-and-capture instruction on the path `**`: when a defect violates a rule
  in `/CLAUDE.md`, quote the rule; when a defect is covered by no rule and
  could recur, say so. The loop is fed by the user and the local skills today
  and not by the bot.

**MCP, for the API-existence rule**

- `knowledge_base.mcp.usage` is set to `"enabled"`. Its default `"auto"`
  disables MCP for public repositories — the same visibility trap already
  recorded for `learnings.scope`, so the setting is pinned by decision rather
  than inherited.
- The `**/*.{ts,tsx}` instructions gain a line: check calls into Preact, Bun
  and Playwright against the documentation for the installed version rather
  than assuming they exist; a non-existent or changed API is Major.

**Noise**

- `reviews.related_issues` and `reviews.related_prs` go to `false`. Both
  default to `true` and neither has anything to relate in a solo repository.

## Non-goals

- **Re-doing what `coderabbit-config` already shipped.** `path_filters`, the
  three disabled linters and `learnings.scope: "local"` are in the file with
  their reasons beside them since PR #24. `!dist/**` was rejected there because
  the directory is gitignored, and `docs/**/*.md` because `filePatterns` has no
  negation syntax and would pull in `docs/context/`.
- **Connecting Context7 itself.** The schema exposes only `usage` and
  `disabled_servers`; which MCP servers exist is dashboard state, and this
  change cannot and should not reach it.
- **Replacing the `bun info` dependency check.** Context7 is documentation, not
  a registry; release age, downloads and install scripts stay with `/warm`.
- **A file-size cap, the rule of two, or the import arrow.** Those are item 29
  of the source analysis and belong to `reviewable-diff-gates`, which already
  carries the arrow and records the other two as non-goals — reversing them is
  an update to that change, not a new proposal.
- **Traceability from criterion to test, and mutation testing.** Sequenced
  after this one as their own proposals; see the design.

## Capabilities

### Modified Capabilities

- `review-bot-config`: the capability gains what the bot is told to look for —
  two new path scopes, two instructions that wire it into this project's loops,
  an MCP knowledge source, and two walkthrough sections turned off.

## Impact

- **Config**: `.coderabbit.yaml` — three new `path_instructions` entries
  (`openspec/changes/**`, `src/**`, and `**` for the fix-and-capture clause,
  which has nowhere else to go: the schema has no general review-instruction
  key), the existing `**/*.{ts,tsx}` entry extended twice, plus
  `knowledge_base.mcp.usage`, `reviews.related_issues` and
  `reviews.related_prs`. The last two default to `true`, so setting them is a
  behaviour change and not only an addition.
- **Tests**: `coderabbit-config.test.ts`, which `always-on-context-budget`
  creates, gains assertions for the keys this change adds.
- **PLAN.md**: the Context7 caveats and the review checkpoint after three or
  four PRs.
- **Behaviour**: proposal PRs get a reviewer they did not have; implementation
  PRs get one that has read the proposal. `/coderabbit-local` inherits both,
  since `local-review-loop` requires it to pass `--config .coderabbit.yaml`
  and so applies the same `path_instructions` — the spec review therefore
  happens before the proposal PR is opened, not only on it.
