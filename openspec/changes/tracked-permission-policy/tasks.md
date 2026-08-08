# Tasks — tracked permission policy

Two groups, two pull requests on `feat/tracked-permission-policy-<step>`, in
order. Group 1 is a boundary, group 2 is housekeeping, and both write the same
file. Requirement citations are the `### Requirement:` headings in
`specs/agent-permissions/spec.md`. Bracketed numbers cite the `/zombies` ideas
raised at propose.

Applied after `mechanised-prohibitions`, which rewrites `deny` and adds a
`hooks` section in `.claude/settings.json`.

## 1. The supply-chain files

- [x] 1.1 Add `Edit(.npmrc)` to `permissions.deny` — the file has no
      legitimate content here, so its existence is the event — *The
      supply-chain configuration files are gated*
- [x] 1.2 Add `Edit(bunfig.toml)` to `permissions.ask`, not to `deny`: the
      file legitimately carries `[test] pathIgnorePatterns` and the
      release-age gate — *The supply-chain configuration files are gated*
- [x] 1.3 Extend `agent-permissions.test.ts`: `Edit(.npmrc)` is denied (2),
      `Edit(bunfig.toml)` is asked and not denied (4, 7), and neither rule is
      written in the `Write(...)` form Claude Code never matches (3)
- [x] 1.4 Watch each assertion fail before it passes, by breaking the policy
      rather than by editing the assertion
- [x] 1.5 Confirm the behaviour per file in a session started after the
      change; `3a-check` in `PLAN.md` records how this was done before. The
      premise that the authoring session cannot observe it turned out to be
      wrong for `deny`: creating `.npmrc` in a subdirectory was blocked in the
      authoring session, so that case is closed and the root case is the same
      rule at a shallower depth. The `bunfig.toml` prompt is now settled, and
      settled as absent: four calls matching a loaded `ask` entry ran with no
      prompt in the `acceptEdits` and the `default` permission mode alike,
      against targets no earlier approval covered, while `deny` entries of the
      same shape in the same object were enforced in the same session and
      `/permissions` listed every `ask` entry as loaded. The tier is
      registered and not consulted on Claude Code 2.1.221 — a defect upstream,
      not a rule to respell — and the capability and design record that
- [x] 1.6 Leave the prose rule in `CLAUDE.md` in place, and say why in the
      capability: a subprocess writes outside the tool layer, so the mechanism
      is partial where `mechanised-prohibitions`' mechanisms are total. The
      redirection route named here at propose time was measured during
      implementation and splits: the deny half covers it, the ask half covers
      nothing. The permission mode named here first was measured too, by 1.5,
      and is not the reason the ask half leaks — Manual leaks the same way
- [x] 1.7 Pin `[install]` whole — `exact`, `minimumReleaseAge` and
      `minimumReleaseAgeExcludes` by key *and* value, so a scoped override
      fails on the key set and a wound-down age gate fails on the value — and
      pin that no `.npmrc` is tracked at any depth. Also refuse an `allow`
      entry restating a gated one, since group 2 fills that list — reading `bunfig.toml` through bun's own TOML
      import rather than by pattern. Raised by `/zombies` against 1.3: the
      routes 1.6 and 1.5 record as passing the prompt all fail this, which is
      the half a permission rule cannot hold — structurally for the subprocess,
      and on this version for every asked call — *The supply-chain
      configuration files are gated*

## 2. The allow list

- [x] 2.1 Read `.claude/settings.local.json`'s 170 allow entries and sort each
      into promote or drop: promote only what this project's documented
      workflow runs; drop anything naming a path outside the repository, a
      path under `/tmp`, or a one-off `sed`, `cp` or `mv` against a single
      named file — *The tracked allow list holds only what a clone can use*
- [x] 2.2 Move the promoted subset into `.claude/settings.json` and remove it
      from the untracked file; leave that file in place with what is genuinely
      local — *The tracked allow list holds only what a clone can use*
- [ ] 2.3 Record the promoted count and the reason for the largest dropped
      group in the PR body, so the curation is reviewable without diffing an
      untracked file the reviewer does not have
- [x] 2.4 Extend `agent-permissions.test.ts` with the hygiene check, as two
      rules over two forms — 145 of the 170 entries are `Bash(...)` command
      strings and only 6 are `Read(...)` path specifiers, so one rule cannot
      cover both. (a) No entry, whatever its tool, contains an absolute path
      token — `/`, `//` or `~/` — which is lexical and catches `//Users/…` (5)
      and `Bash(… /tmp/…)` (6) without parsing a command. (b) A `Read(...)` or
      `Edit(...)` specifier additionally resolves against the repository root,
      collapsing `..`, and must stay inside — this is what catches
      `Edit(../../secrets/**)`. Do not parse `Bash` commands for paths: that
      is a shell parser with quoting, globs and expansions. Assert the entry
      set is non-empty first, so an emptied `allow` fails rather than passing
      every per-entry check vacuously (1)
- [x] 2.5 Watch the hygiene check fail three ways before it passes — a
      `Read(//Users/…)` entry, a `Bash(… /tmp/…)` entry, and an
      `Edit(../../…)` traversal — then remove each. Confirm a pathless
      `Bash(bun test)` stays green throughout
- [ ] 2.6 Grep for sites restating what these two groups change —
      `openspec/specs/agent-permissions/spec.md`, `PLAN.md`'s decision for this
      change and the `3a` entries that describe the current policy,
      `README.md`'s ownership row for `.claude/settings.json`, and `CLAUDE.md`'s
      dependency-safety rules — and reconcile each
