# Vendored-skill permissions

## Why

Review skills are symlinked in from a shared repo, so their frontmatter
arrives without review whenever they are re-vendored, and no gate compares
what a skill claims against this project's policy. Two fields have drifted
apart from it, in opposite directions.

`allowed-tools` grants too much. `CLAUDE.md` forbids running `bunx`/`npx`
with a package that has not passed the dependency check, but
`.claude/skills/playwright-cli/SKILL.md` carries
`allowed-tools: Bash(playwright-cli:*) Bash(npx:*) Bash(npm:*)`, which
pre-approves `npx` and `npm` for the turn that invokes the skill. Claude Code
enforces permission rules, not prose — a rule written only in `CLAUDE.md`
shapes what the agent attempts and stops nothing.

`disable-model-invocation` grants too much on one skill and is documented
wrongly on six. `CLAUDE.md` reserves `/coderabbit` for the user — "never
you", because waiting on the bot's schedule burns a session — but the flag
was removed from that skill, so nothing stops the model invoking it. In the
other direction, `CLAUDE.md` tells the agent to invoke `/zombies` and
`/warm` itself, which their own `description` fields already say, so those
two clauses are dead weight.

## What Changes

- Add a `permissions.deny` list to `.claude/settings.json` covering the
  package managers this project does not use: `npx`, `npm`, `pnpm`, `yarn`.
  Deny is evaluated before ask and allow, so it overrides both the vendored
  skill's `allowed-tools` grant and any entry accumulated in the untracked
  `.claude/settings.local.json`.
- Remove the now-unreachable `npm`/`pnpm`/`yarn` entries from
  `permissions.ask`, leaving `bun add` and `bun install` — the only install
  path this project has — as the sole ask rules.
- **BREAKING** for the vendored `playwright-cli` skill: its `npx`/`npm`
  fallback path stops working. Its primary path is the `playwright-cli`
  binary, already installed through bun and untouched by the deny; the two
  reference files that call `npx playwright test` substitute one-for-one
  with `bunx playwright test`.
- Add a test pinning `.claude/settings.json` to the policy above, so a later
  hand-edit cannot drop the boundary silently.
- Add a rule to the `CLAUDE.md` "Rules" list requiring a vendored skill's
  `allowed-tools` and `disable-model-invocation` to be reconciled with this
  project's policy before the skill is used.
- Trim `docs/review-toolkit.md`: drop the "Invoke it yourself" clauses on
  `/zombies` and `/warm`, which their skill descriptions already carry, and
  reduce the `/coderabbit` prohibition to its rationale once the flag
  enforces it. The `/triage` and `/ponytail-review` clauses stay — see
  design.
- Report — do not apply — three fixes for the shared skills repo: restore
  `disable-model-invocation: true` on `coderabbit`, correct both halves of
  `README.md` line 23, and add the frontmatter-reconciliation step to the
  re-vendoring procedure. Per the `CLAUDE.md` rule, fixes to skills are
  proposed here and made there.

## Capabilities

### New Capabilities

- `agent-permissions`: which tool permissions this repo's checked-in Claude
  Code settings grant, deny, and prompt for; and how a vendored skill's own
  frontmatter claims — what it may run, and who may invoke it — are
  reconciled against this project's policy.

### Modified Capabilities

None. No product capability changes behaviour.

## Non-goals

- Curating `.claude/settings.local.json` (~100 auto-accepted entries, many
  one-off or machine-local). It is untracked and deny already overrides it;
  cleaning it is separate work.
- Enforcing the rest of the `CLAUDE.md` supply-chain rules through hooks —
  `curl … | bash`, committing to `main`, registry edits. Each needs a
  `PreToolUse` hook rather than a permission rule, and none of them is granted
  by a vendored skill today.
- Gating `bunx`. The rule it would enforce ("only with a verified package") is
  not expressible as a command glob, and this repo's real `bunx` calls
  (`biome`, `playwright`, `tsc`) are all resolved from `package.json`.
- Changing which skills are vendored, or editing any file under
  `.claude/skills/` — those live in the shared skills repo.

## Impact

- `.claude/settings.json` — the only file whose behaviour changes; tracked, so
  the policy travels with a clone.
- `CLAUDE.md` — one rule added to the "Rules" list.
- `docs/review-toolkit.md` — three clauses trimmed.
- `.claude/skills/playwright-cli/` — unchanged, but its `npx`/`npm` grant
  becomes inert in this repo.
- No production code, no dependency, no CI change.
