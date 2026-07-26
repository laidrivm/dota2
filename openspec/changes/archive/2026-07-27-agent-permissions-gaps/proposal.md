# Close the gaps in the agent permission policy

## Why

`permissions.ask` in `.claude/settings.json` lists `Bash(bun add *)` and
`Bash(bun install *)`, and `openspec/specs/agent-permissions/spec.md` calls
those "exactly the two bun commands that mutate the dependency manifest".
Both the policy and the sentence are wrong, and the sentence being wrong is
the smaller half. `bun` documents `bun a` for `add`, `bun i` for `install`,
and `bun r` / `bun rm` / `bun uninstall` for `remove`, so the install family
alone spans eight invocation forms of which the gate covers two — `bun a
preact` and `bun i` reach a dependency write today without ever prompting.
Beyond that family, `bun update`, `bun patch --commit`, `bun pm pkg set`,
`bun pm version` and `bun pm trust` each rewrite `package.json` and are
ungated too. The last of those is the sharpest: `CLAUDE.md` forbids the agent
from adding to `trustedDependencies` on its own, and nothing enforces it.

Two further requirements in the same spec promise more than they check. *The
permission policy is pinned by a test* says the test guards "the policy
above", but the policy above includes the `disable-model-invocation`
requirement and neither its scenarios nor `agent-permissions.test.ts` touch
skill frontmatter. *Foreign package managers are denied* claims "every package
manager other than `bun`" while enumerating four. A spec that overclaims is
worse than one that is narrow: the next reader trusts the claim instead of the
enumeration.

## What Changes

- Extend `permissions.ask` to every invocation form that changes the
  dependency record: `bun add`, `bun a`, `bun install`, `bun i`, `bun remove`,
  `bun rm`, `bun r`, `bun uninstall`, `bun update`, `bun patch`,
  `bun patch-commit`, `bun pm pkg`, `bun pm version`, `bun pm trust`. Claude Code matches
  permission patterns literally, so each alias needs its own entry — there is
  no pattern that covers a command's aliases.
- Keep the read-only `bun pm` siblings ungated — `bun pm untrusted` above all,
  since `CLAUDE.md` requires surfacing its output for the user to act on. The
  one exception is `bun pm pkg get`, which the single `bun pm pkg` entry
  prompts for.
- Rename the requirement *Only bun's install commands prompt*. Removal is now
  in scope, so "install commands" no longer describes it.
- Restate that requirement in terms of the manifest-mutating **surface**
  rather than a command count, so adding an alias to the list does not
  falsify the sentence again.
- Narrow *The permission policy is pinned by a test* to the settings file it
  actually pins, and state why the frontmatter half is not pinnable here:
  `.claude/skills/*` are symlinks into a sibling repository and are untracked
  (`git ls-files .claude/` returns only `commands/` and `settings.json`), so a
  test asserting on them passes for the author and fails in a clone.
- Replace the universal claim in *Foreign package managers are denied* with
  one bounded by its enumeration.
- Extend `agent-permissions.test.ts` to pin the full `ask` list, and rename
  its `describe` and the test whose name — "both commands that mutate the
  manifest are listed" — restates the false claim.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-permissions`: the `ask` requirement changes scope from bun's two
  install commands to every manifest-mutating invocation form and is renamed;
  the test-pinning requirement narrows to the settings file; the deny
  requirement's universal claim is bounded by its enumeration.

## Impact

- `.claude/settings.json` — `permissions.ask` grows from two entries to 14.
- `agent-permissions.test.ts` — the `ask` assertion and two names.
- `openspec/specs/agent-permissions/spec.md` — three requirements, one renamed.
- `PLAN.md:82` restates the old policy as "`ask` reduced to bun's two install
  commands" and changes with it.
- Twelve new approval prompts in day-to-day work. All but one are commands
  that write `package.json` or the lockfile; `bun pm pkg get` reads it and
  prompts anyway, because one `bun pm pkg` entry is taken over three.

## Non-goals

- **Denying the aliases instead of prompting for them.** `bun` is this
  project's package manager; its manifest writes are approved, not forbidden.
- **Auditing the `deny` list for aliases.** `npx`, `npm`, `pnpm` and `yarn`
  are denied by their own names, and a foreign manager's aliases are reachable
  only through the binary this list already blocks.
- **Pinning skill frontmatter with a test.** Not possible from this
  repository while `.claude/skills/*` is a symlink to untracked content — the
  spec will say so rather than promise it.
- **Editing any vendored skill.** They live in the shared skills repository.
- **Revisiting `disable-model-invocation` itself.** The requirement stands;
  only the claim about what the test covers changes.
