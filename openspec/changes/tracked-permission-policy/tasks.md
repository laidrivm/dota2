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
- [ ] 1.5 Confirm the behaviour per file in a session started after the
      change — a session loads its permissions at startup, so the authoring
      session cannot observe it, and `3a-check` in `PLAN.md` records how this
      was done before. Three cases: editing `bunfig.toml` prompts; creating
      `.npmrc` at the repository root is blocked without prompting; creating
      one in a subdirectory is blocked too, since a bare filename matches at
      any depth
- [x] 1.6 Leave the prose rule in `CLAUDE.md` in place, and say why in the
      capability: a shell redirection writes either file without an `Edit`
      call, so the mechanism is partial where `mechanised-prohibitions`'
      mechanisms are total

## 2. The allow list

- [ ] 2.1 Read `.claude/settings.local.json`'s 170 allow entries and sort each
      into promote or drop: promote only what this project's documented
      workflow runs; drop anything naming a path outside the repository, a
      path under `/tmp`, or a one-off `sed`, `cp` or `mv` against a single
      named file — *The tracked allow list holds only what a clone can use*
- [ ] 2.2 Move the promoted subset into `.claude/settings.json` and remove it
      from the untracked file; leave that file in place with what is genuinely
      local — *The tracked allow list holds only what a clone can use*
- [ ] 2.3 Record the promoted count and the reason for the largest dropped
      group in the PR body, so the curation is reviewable without diffing an
      untracked file the reviewer does not have
- [ ] 2.4 Extend `agent-permissions.test.ts` with the hygiene check, as two
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
- [ ] 2.5 Watch the hygiene check fail three ways before it passes — a
      `Read(//Users/…)` entry, a `Bash(… /tmp/…)` entry, and an
      `Edit(../../…)` traversal — then remove each. Confirm a pathless
      `Bash(bun test)` stays green throughout
- [ ] 2.6 Grep for sites restating what these two groups change —
      `openspec/specs/agent-permissions/spec.md`, `PLAN.md`'s decision for this
      change and the `3a` entries that describe the current policy,
      `README.md`'s ownership row for `.claude/settings.json`, and `CLAUDE.md`'s
      dependency-safety rules — and reconcile each
