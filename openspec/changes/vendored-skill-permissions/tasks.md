# Tasks — vendored-skill permissions

Requirement names are those in `specs/agent-permissions/spec.md`.

## 1. Pin the policy in a test (tests first)

- [x] 1.1 Add `agent-permissions.test.ts` at the repo root, reading the tracked
      `.claude/settings.json` — never `.claude/settings.local.json`
      (*The permission policy is pinned by a test* → "The settings file stops
      parsing", "A deny entry is removed")
- [x] 1.2 Assert `permissions.deny` carries an entry for each of `npx`, `npm`,
      `pnpm`, `yarn` (*Foreign package managers are denied* → "Denied manager
      in a plain command"; *pinned by a test* → "A deny entry is removed")
- [x] 1.3 Assert every deny entry uses the trailing-space wildcard form
      `Bash(<cmd> *)` and none uses `Bash(command:…)` (*Foreign package
      managers are denied* → "A command that merely starts with a denied
      name"; *pinned by a test* → "A deny entry loses its word boundary",
      "A deny entry uses the ignored field form")
- [x] 1.4 Assert no `permissions.ask` entry names a denied manager (*Only
      bun's install commands prompt* → "Settings carry no unreachable ask
      rule"; *pinned by a test* → "An unreachable ask entry is reintroduced")
- [x] 1.5 Run `bun test` and watch 1.2–1.4 fail against the current
      `.claude/settings.json` — a test that never failed guards nothing

## 2. Write the policy

- [x] 2.1 Add `permissions.deny` to `.claude/settings.json` with
      `Bash(npx *)`, `Bash(npm *)`, `Bash(pnpm *)`, `Bash(yarn *)`
      (*Foreign package managers are denied*; *Deny overrides grants from any
      other source*)
- [x] 2.2 Reduce `permissions.ask` to `Bash(bun add *)` and
      `Bash(bun install *)`, dropping the npm/pnpm/yarn entries deny now makes
      unreachable (*Only bun's install commands prompt* → "Adding a
      dependency")
- [x] 2.3 Run `bun test` — 1.2–1.4 now pass

## 3. Verify the boundary holds in a live session

- [ ] 3.1 Restart Claude Code and confirm no startup warning about a
      permission rule in `.claude/settings.json` (a malformed rule is reported
      only at startup, and `bun test` cannot see it)
- [x] 3.2 Invoke `/playwright-cli`, attempt `npx playwright --version`, and
      record that it is blocked while the skill's `playwright-cli` grant still
      works (*Deny overrides grants from any other source* → "A vendored skill
      pre-approves a denied command")
- [x] 3.3 In the same session attempt `bun run build && npx some-tool` and
      record that it is blocked (*Foreign package managers are denied* →
      "Denied manager hidden in a compound command")
- [x] 3.4 Attempt `npm view preact`, which `.claude/settings.local.json` still
      allows, and record that it is blocked (*Deny overrides grants from any
      other source* → "A stale local allow entry names a denied command")
- [x] 3.5 Name the environment each of 3.1–3.4 ran in — Claude Code version,
      permission mode — per the rule in `CLAUDE.md`

## 4. Confirm the skills-repo fixes (user applies them there)

Two of the three were applied while this change was being proposed; 4.3 is
still outstanding. Never edit the skills repo from this project.

- [x] 4.1 Confirm `grep -c '^disable-model-invocation:'
      .claude/skills/coderabbit/SKILL.md` returns 1 (*Who may invoke a skill
      is enforced, not narrated* → "A skill reserved for the user")
- [x] 4.2 Confirm the skills `README.md` no longer lists `coderabbit` among
      the agent-invocable skills, and that its base-branch sentence matches
      what the skills do
- [x] 4.3 Draft the missing re-vendoring procedure step for the "Skill
      provenance" section — reconcile a skill's `allowed-tools` **and**
      `disable-model-invocation` against the consuming project's policy,
      since the lock's `computedHash` detects an edited skill but not a
      skill whose unedited frontmatter contradicts the project — and report
      the wording here for the user to apply

## 5. Reconcile this repo's rules

- [x] 5.1 Add one rule to the `CLAUDE.md` "Rules" list: a vendored skill's
      `allowed-tools` and `disable-model-invocation` are reconciled with this
      project's policy before the skill is used
- [x] 5.2 Add one rule to the `CLAUDE.md` "Rules" list giving the bun
      substitutions for the `playwright-cli` skill's denied paths —
      `bunx playwright test` for `npx playwright test`, `bun add -g
      @playwright/cli` for `npm install -g` — so the skill's dead-end
      recovery has a documented way out
- [x] 5.3 Drop the "Invoke it yourself" clauses on `/zombies` and `/warm` in
      `docs/review-toolkit.md` (*Who may invoke a skill is enforced, not
      narrated* → "A skill the agent is meant to run itself"); leave the
      `/triage` and `/ponytail-review` clauses alone (→ "A clause that adds
      information")
- [x] 5.4 Only after `grep -c disable-model-invocation
      .claude/skills/coderabbit/SKILL.md` returns 1, reduce the `/coderabbit`
      bullet to its rationale, dropping "**The user invokes this one**, never
      you" (*Who may invoke a skill is enforced, not narrated* → "A skill
      reserved for the user"). If the flag is not yet there, leave the
      sentence and say so — it is the only brake until then
- [x] 5.5 Grep every site restating the permission or invocation policy —
      `CLAUDE.md`, `docs/`, `README.md`, `PLAN.md` — and reconcile them (rule
      in `CLAUDE.md`)
- [x] 5.6 Update `PLAN.md`: queue entry, status, and the decisions this change
      settles

## 6. Review gates

- [x] 6.1 `/zombies` with no arguments over the final diff, then fix what it
      finds
- [x] 6.2 `/ponytail-review`, applying the cuts that survive
- [ ] 6.3 `/triage` last, over the final diff; read every file it ranks High or
      Medium and report the defects they hold
- [ ] 6.4 Open the PR from `fix/vendored-skill-permissions` — `/warm` is
      skipped, no dependency manifest changes
