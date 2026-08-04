# Tracked permission policy

## Why

The tracked `.claude/settings.json` is 456 bytes: four denied package managers
and fourteen bun commands that reach a manifest. The untracked
`.claude/settings.local.json` beside it is 11 KB and holds **170** allow
entries accumulated by clicking "don't ask again" — 19 of them naming an
absolute path outside the repository or `/tmp`, 8 a one-off `sed`, `cp` or `mv`
against a single named file. None of it is reviewed, none survives a clone, and
none was ever a decision.

Separately, one prohibition of the same kind the `mechanised-prohibitions`
change set out to mechanise was missed by it: *Never add or change a registry
(or scoped registry override) in `bunfig.toml` / `.npmrc` — a registry is a
supply-chain root of trust; adding one is a user decision, made outside any
coding task.* A grep of that change for `registry`, `bunfig` or `npmrc` returns
nothing. The rule carries no judgement and names its own trigger, which is the
definition that change used to select candidates.

`bunfig.toml` holds a second key of exactly that shape:
`minimumReleaseAgeExcludes`, whose own comment says *add entries only with an
explicit user decision*. Both keys are prose boundaries today.

## What Changes

**The supply-chain keys become a prompt**

- `.claude/settings.json` gains `permissions.deny` for `Edit(.npmrc)`: bun
  reads `.npmrc` as a registry source — its own `--help` says `--registry`
  overrides `.npmrc`, `bunfig.toml` and the environment — and this repository
  deliberately has none, so the file appearing at all is the event to stop.
- It gains `permissions.ask` for `Edit(bunfig.toml)`. The file is edited about
  twice in a repository's life, so the prompt costs nothing, and its two
  supply-chain keys — a registry and `minimumReleaseAgeExcludes` — are both
  reached only through it.
- Rules are written as `Edit(...)`, never `Write(...)`: the file permission
  checks match `Edit(path)` only, and `Edit` rules cover every file-editing
  tool. A `Write(...)` rule is accepted and never matched, and warns at
  startup.

**The allow list is curated**

- The stable subset of `settings.local.json` — commands this project's own
  documented workflow runs — moves into the tracked `.claude/settings.json`,
  where it is reviewable and reaches a clone.
- Everything machine-local, one-off, or naming a path outside the repository
  is dropped rather than moved.
- `agent-permissions.test.ts` gains a hygiene check in two rules, because the
  entries are not uniformly paths — 145 of the 170 are `Bash(...)` command
  strings and 6 are `Read(...)` specifiers. No entry may carry an absolute
  path token, which is lexical and needs no shell parsing; and a path
  specifier must additionally resolve inside the repository, which is what
  catches a `../../` traversal. Whether an entry is a one-off stays a review
  criterion, answered in the PR body.

## Non-goals

- **Pinning each allow entry by name.** The deny and ask lists are boundaries
  and are pinned entry by entry; an allow list is convenience, and pinning it
  would make every added convenience a test edit.
- **Deleting `settings.local.json`.** It stays as the untracked scratch space
  it is; this change only takes what belongs in the tracked file out of it.
- **A hook that parses the edit.** Considered and rejected in the design: it
  would inspect `tool_input` for a registry key, and two permission lines get
  the same boundary with no script to maintain.
- **Denying `Edit(bunfig.toml)` outright.** The file carries `[test]
  pathIgnorePatterns` and the release-age gate, both legitimately edited.
- **Reversing `mechanised-prohibitions`' `curl … | bash` non-goal.** That
  decision stands with its reason; this change adds the boundary that one
  missed, not the one it declined.

## Capabilities

### Modified Capabilities

- `agent-permissions`: the policy gains file-scoped rules beside its command
  rules, and gains a curated allow list with a rule about what may enter it.

## Impact

- **Config**: `.claude/settings.json` (deny, ask, allow);
  `.claude/settings.local.json` shrinks to what is genuinely local.
- **Tests**: `agent-permissions.test.ts` gains the new entries and the
  allow-list hygiene check.
- **Preconditions**: applied after `mechanised-prohibitions`, which rewrites
  the same file's `deny` and `hooks` sections.
- **Behaviour**: an agent editing `bunfig.toml` is prompted; an agent creating
  `.npmrc` is blocked, including by a shell redirection, which the deny half
  turned out to cover. Neither is a security boundary — a permission mode such
  as `acceptEdits` and a subprocess each pass both halves, and a redirection
  still passes the `ask` half, which is why the prose rule stays.
