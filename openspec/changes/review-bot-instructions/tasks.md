# Tasks — review bot instructions

One group, one pull request on `feat/review-bot-instructions`. Requirement
citations are the `### Requirement:` headings in
`specs/review-bot-config/spec.md`. Bracketed numbers cite the `/zombies` ideas
raised at propose.

Applied after `always-on-context-budget`, whose task 2.1 creates
`coderabbit-config.test.ts` and adds its own clause to the `**/*.{ts,tsx}`
instructions. Before starting, confirm that file exists and carries the fence
assertions; this change extends both, never rewrites them.

## 1. Instructions, keys, and their pin

- [ ] 1.1 Check every key path this change adds against
      `https://storage.googleapis.com/coderabbit_public_assets/schema.v2.json`
      before writing it — `knowledge_base.mcp.usage`,
      `reviews.related_issues`, `reviews.related_prs` — re-fetched rather than
      trusted from `design.md` (2)
- [ ] 1.2 Add the `openspec/changes/**` entry: EARS form, measurable values
      rather than adjectives, Non-goals present, every criterion cited by a
      task — *The specification itself is reviewed*
- [ ] 1.3 Add the `src/**` entry: select the change by branch name
      (`feat/<slug>[-<step>]` → `openspec/changes/<slug>/`), compare in both
      directions, name scope not proposed as the direction nobody else checks,
      and say so rather than guess when the branch matches no directory —
      *An implementation is reviewed against its proposal*
- [ ] 1.4 Add the `**` entry for the fix-and-capture clause — `**/*.{ts,tsx}`
      would exempt configs, workflows and docs, and the schema has no general
      review-instruction key to hang it on — *The bot reports against the rules
      list*
- [ ] 1.5 Extend the `**/*.{ts,tsx}` entry with the ponytail clause — a
      single-caller abstraction, a parameter with no consumer, a new dependency
      — *The bot flags what the linters cannot*
- [ ] 1.6 Extend the same entry with the API clause: check Preact, Bun and
      Playwright calls against the installed version's documentation, treat a
      non-existent or changed API as Major. Do not disturb the fence clause
      already there (6) — *MCP is enabled by decision, not by default*
- [ ] 1.7 Word the fix-and-capture clause: quote the `/CLAUDE.md` rule a defect
      violates; say so when a defect is covered by no rule and could recur —
      *The bot reports against the rules list*
- [ ] 1.8 Set `knowledge_base.mcp.usage: "enabled"` with the reason beside it,
      as every other pinned key in this file carries one: `auto` disables MCP
      for a public repository — *MCP is enabled by decision, not by default*
- [ ] 1.9 Set `reviews.related_issues` and `reviews.related_prs` to `false`
      with their reason — *The walkthrough drops what a solo repository cannot
      relate*
- [ ] 1.10 Before touching the test, confirm `coderabbit-config.test.ts` is
      tracked and carries the fence assertions from `always-on-context-budget`.
      If it is absent, stop and settle the dependency — writing it fresh here
      produces a second file of a different shape, which is the collision this
      ordering exists to prevent
- [ ] 1.11 Extend `coderabbit-config.test.ts`: `mcp.usage` is exactly
      `"enabled"` (1); the three new path entries exist, naming EARS, the
      branch-derived change directory, and the rules list (3, 4); both
      `related_*` keys are `false` (5); the
      `**/*.{ts,tsx}` block still carries the fence clause **and** now the API
      clause (6); `docstrings.mode` is still `"off"` (7)
- [ ] 1.12 Watch each new assertion fail before it passes, by breaking the
      config rather than by editing the assertion
- [ ] 1.13 Record in `PLAN.md` that Context7's library documentation is
      community-contributed with no accuracy or safety warranty, that the
      config can only deny servers and never allow them, and the checkpoint:
      after three or four PRs, ask whether any finding of the API class
      appeared, and set `usage` back to `"disabled"` if none did
- [ ] 1.14 Tell the user what only they can do: connect Context7 in the
      CodeRabbit dashboard, since the schema exposes no way to do it from the
      repository
- [ ] 1.15 Grep for sites restating what this change adds —
      `openspec/specs/review-bot-config/spec.md`, `docs/review-toolkit.md`
      where the bot's disposition terms live, and `README.md`'s ownership row
      for `.coderabbit.yaml` — and reconcile each
