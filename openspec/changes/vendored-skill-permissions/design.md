# Design — vendored-skill permissions

## Context

Review skills are symlinked into `.claude/skills/` from a shared skills repo
and are gitignored here. Their frontmatter can grant tool permissions:
`allowed-tools` pre-approves tools "without asking permission during the turn
that invokes this skill". One vendored skill, `playwright-cli`, grants
`Bash(npx:*)` and `Bash(npm:*)` — the exact commands `CLAUDE.md` forbids,
because `npx` bypasses the release-age gate on an unverified package.

The shared repo's re-vendoring procedure hashes skill files, so it detects an
edited skill. It does not compare a skill's grants against the consuming
project's policy, which is the failure mode here: nothing was edited, and the
grant still contradicts the rule.

`CLAUDE.md` cannot close this. Claude Code's own documentation is explicit:
permission rules are enforced by Claude Code, not by the model — instructions
in a prompt or `CLAUDE.md` shape what the agent attempts but do not change
what it is allowed to do.

## Goals / Non-Goals

**Goals:**

- Make the no-foreign-package-manager rule a boundary rather than a wish, in a
  file that ships with the repo.
- Catch the next conflicting grant automatically, so re-vendoring cannot
  reintroduce this class of defect silently.

**Non-Goals:**

- Curating `.claude/settings.local.json`, hooks for the remaining supply-chain
  rules, gating `bunx`, or editing anything under `.claude/skills/` — see the
  proposal's Non-goals.

## Decisions

**A deny rule, not a `PreToolUse` hook.** A hook is a script to write, test and
keep working; four deny entries are enforced by the harness with nothing to
maintain. A hook would be justified if the rule needed judgement — "`bunx` only
with a verified package" is such a rule, and it is out of scope precisely
because no glob and no cheap script can decide it.

**Scoped rules, not a bare tool-name deny.** A bare `Bash` deny removes the
tool from the agent's context entirely; a scoped rule like `Bash(npx *)` leaves
Bash available and blocks matching calls at the point of use. Only the scoped
form is usable here.

**The trailing-space wildcard form, `Bash(npx *)`.** `Bash(npx:*)` is
documented as equivalent, but the permission dialog writes the space form when
a user picks "Yes, don't ask again", so matching it keeps the file consistent
with entries added later by hand or by the dialog. `Bash(command:npx *)` is
explicitly rejected by Claude Code with a startup warning — it would be
bypassable by a compound command — so it is not an option.

**Deny the whole family, not just `npx`.** `npm`, `pnpm` and `yarn` were
already listed under `ask`; since `deny` is evaluated first, leaving them in
`ask` would make those entries unreachable dead config. Moving them to `deny`
is a smaller file and a stronger rule at once. `npm view`, currently allowed in
the untracked local settings, is superseded by `bun info`, which `CLAUDE.md`
already mandates for registry checks.

**No test scans skill grants.** The first draft of this design had a test
failing when a vendored skill granted a denied command. `/zombies` showed it
cannot work: `playwright-cli` grants `npx`/`npm` today, the deny list blocks
them, and the skill cannot be edited from this project — so the test is red on
arrival, and the only way to green it is an exemption for the very skill that
motivated the change. Inverting it to "a grant is acceptable when deny covers
it" makes it a tautology: that is what a deny rule guarantees by construction,
for every grant present and future. The residual risk — a skill granting
something policy forbids that the deny list does not name (`pip install`,
`curl`, a bare `Bash(*)`) — needs an enumeration of forbidden commands, which
is the deny list again. The human step at re-vendoring time is the only thing
that closes it, and it belongs in the shared repo's procedure.

**The settings file itself is pinned by a test.** What survives is a check on
`.claude/settings.json`: the four deny entries are present in the
trailing-space wildcard form, and no `ask` entry names a denied manager. It
guards against a later hand-edit quietly dropping the boundary, always runs
because the file is tracked, and follows the precedent of
`src/app/styles/styles.test.ts`, which pins contrast floors on design tokens
the same way.

**`disable-model-invocation` is restored on `coderabbit` rather than the
prohibition being dropped from `CLAUDE.md`.** The flag was removed in the
skills repo's `0df4241` ("allow to run coderabbit and triage automatically"),
which left the model free to invoke a skill `CLAUDE.md` reserves for the user.
The rationale in `CLAUDE.md` still holds — the bot's review arrives on its own
schedule, so an agent that invokes `/coderabbit` and waits burns a session
doing nothing — so the flag is the right place to enforce it, and prose is the
wrong one. This is the same argument as the deny rule: a claim the harness
enforces beats a claim only the model reads.

**Three of the five "who invokes" clauses in the Review toolkit stay.** Only
`/zombies` and `/warm` duplicate their skills' own `description` fields, which
already say "proactively after implementing a feature" and "proactively after
you add or upgrade a dependency yourself". The other three carry information
no description does:

- `/triage` — its description triggers on "a branch or PR that touches more
  than a couple of files"; `CLAUDE.md` requires it before *every* PR, last in
  the sequence, over the final diff. Different trigger, different position.
- `/ponytail-review` — ships in the ponytail plugin, not the vendored repo,
  and its description reads "Use when the user says … or invokes
  /ponytail-review". `CLAUDE.md` says the agent invokes it. That is an
  inversion, not a restatement.
- `/coderabbit` — once the flag is restored the sentence stops being the
  enforcement, but the reason survives as the answer to "why can't I just run
  it?", so it is kept and the instruction dropped.

## Risks / Trade-offs

- **`playwright-cli`'s `npx`/`npm` paths stop working in this repo** → the
  skill's own primary path is the `playwright-cli` binary, granted by
  `Bash(playwright-cli:*)` and untouched. That binary is already installed
  through bun — `~/.bun/bin/playwright-cli` links into
  `~/.bun/install/global/node_modules/@playwright/cli` — so the whole 12 KB
  body of `SKILL.md` runs unchanged. `npx`/`npm` appear only in its
  Installation section and in two reference files
  (`references/playwright-tests.md`, `references/test-generation.md`), where
  `npx playwright test` substitutes one-for-one with `bunx playwright test`:
  `@playwright/test` is a devDependency, so bunx resolves it locally.
- **The skill's documented recovery becomes a dead end** → it tells the agent
  to reinstall with `npx playwright cli` or `npm install -g @playwright/cli`
  when the binary is missing, and both are now denied. The bun-native
  equivalent is `bun add -g @playwright/cli`, already covered by the `ask`
  rule. Recorded as a rule in `CLAUDE.md` rather than by forking the skill:
  owning 12 KB of verbatim documentation to change ten lines inverts the
  trade vendoring exists to make, and a fork has to be re-synced by hand
  every time upstream moves.
- **A re-vendored skill can still grant something forbidden that the deny list
  does not name** → nothing in this repo catches it; the matching step in the
  shared repo's re-vendoring procedure is the mitigation, and it is reported
  rather than applied here. This is the change's known ceiling.
- **The `coderabbit` fix lands in another repo, so this change cannot verify
  it** → until the flag is restored there, the `CLAUDE.md` sentence is still
  the only brake, and trimming it early would open exactly what it forbids.
  The task list therefore drops the instruction only after the flag is
  confirmed present in the symlinked `SKILL.md`.
- **A denied command the user genuinely wants** → they run it in their own
  terminal; the rule constrains the agent, not the human.

## Open Questions

- The matching step for the shared repo's re-vendoring procedure is reported
  here for the user to apply there, per the `CLAUDE.md` rule that skills are
  not edited from this project. Its exact wording is theirs to settle.
