# Tasks — Close the gaps in the agent permission policy

Requirement names are those in `specs/agent-permissions/spec.md`.

Independent of `readme-drift`: no shared file. Do this one first — it is the
last item of the CodeRabbit local-review setup.

## 1. Settle the alias surface against the installed binary

- [x] 1.1 Re-run `bun add --help`, `bun install --help` and `bun remove --help`
      and record each `Alias:` line, rather than trusting the list in design
      (*Every manifest-mutating invocation prompts*)
- [x] 1.2 Probe the undocumented forms — `bun rm`, `bun r`, `bun uninstall` —
      and confirm each resolves to a listed command; drop from the list
      anything that does not
- [x] 1.3 Stop and report if the installed `bun` yields a surface different
      from the eight forms in design — the requirement is written as a surface,
      so the settings follow the binary, not the doc

## 2. Widen the policy

- [x] 2.1 Add the remaining forms to `permissions.ask` in
      `.claude/settings.json`, keeping the trailing-space wildcard on each
      (*Every manifest-mutating invocation prompts* → "The same command
      through its alias", "Removing a dependency")
- [x] 2.2 Confirm no added entry names `npx`, `npm`, `pnpm` or `yarn` (→
      "Settings carry no unreachable ask rule")

## 3. Repin the test

Test ideas from `/zombies` at propose; numbers are that report's.

- [x] 3.1 Widen the `ask` equality assertion to the full list, and rename the
      test whose name — "both commands that mutate the manifest are listed" —
      restates the claim this change removes (idea 1; *The permission policy is
      pinned by a test* → "An ask entry is dropped")
- [x] 3.2 Rename the `describe` block from "only bun's install commands prompt"
      to match the renamed requirement
- [x] 3.3 Assert every alias `bun` reports under `Alias:` for the three
      commands appears in `ask`, reading it from `bun <cmd> --help` rather than
      a hard-coded list, so a bun upgrade fails the test (idea 2)
- [x] 3.4 Shape-check `ask` entries for the trailing-space wildcard, as
      `deny` already is — `Bash(bun a*)` without the space also covers
      `bun add` (idea 3)
- [x] 3.5 Assert no `ask` entry matches `bun run build`, so `Bash(bun r *)`
      gates `bun remove`'s alias without capturing `bun run` (idea 4)
- [x] 3.6 Decide idea 5 — that an unparseable settings file fails the run —
      with a reason either way: it holds by construction through the
      module-level `await Bun.file(…).json()`, and the spec claims it as a
      scenario
- [x] 3.7 `bun test` passes

## 4. Correct the spec's three overclaims

- [x] 4.1 Apply the rename and the surface wording to *Every manifest-mutating
      invocation prompts* in `openspec/specs/agent-permissions/spec.md`, via
      the delta spec
- [x] 4.2 Narrow *The permission policy is pinned by a test* to the settings
      file, stating why skill frontmatter is not pinnable here (→ "A skill's
      frontmatter changes")
- [x] 4.3 Bound the universal claim in *Foreign package managers are denied*
      to its enumeration (→ its three existing scenarios stand unchanged)

## 5. Reconcile the repo

- [x] 5.1 Grep every site restating the two-command policy and reconcile it —
      `PLAN.md:82` says "`ask` reduced to bun's two install commands"; check
      `CLAUDE.md`, `docs/`, and `tasks/task-1.md`, whose lines 5 and 43 are a
      historical checklist and may be left with a note (rule in `CLAUDE.md`)
- [x] 5.2 Confirm `.claude/settings.json` is tracked, so the widened policy
      reaches a clone (rule in `CLAUDE.md`)
- [x] 5.3 Update `PLAN.md`: record the settled alias surface and the decision
      not to pin skill frontmatter. Item 3a stays unticked until the PR merges
      and the change is archived, as entries 1 to 3 did

## 6. Review gates

- [x] 6.1 `/zombies` with no arguments over the final diff — this branch
      changes a test, so diff mode reads the real assertions
- [x] 6.2 `/ponytail-review`, applying the cuts that survive
- [x] 6.3 `/triage` over the final diff
- [x] 6.4 `/coderabbit-local` — a settings-and-test branch, so the full loop
      rather than the single documentation pass
- [ ] 6.5 Open the PR from `fix/agent-permissions-gaps`

## 7. Widen to the rest of the manifest-writing surface

Raised by 6.4's first pass; the user chose to widen here rather than defer.

- [x] 7.1 Probe which commands outside the install family rewrite
      `package.json` — `bun pm pkg set`, `bun pm version`, `bun update
      --latest`, `bun patch --commit`, `bun pm trust` (*Every manifest-mutating
      invocation prompts*)
- [x] 7.2 Add the six entries to `permissions.ask`, choosing
      `Bash(bun pm pkg *)` over three narrower entries and accepting the prompt
      on the read-only `bun pm pkg get` (→ "A subcommand that edits the
      manifest directly", "trustedDependencies is never granted silently")
- [x] 7.3 Widen the test's shape regex for the two-word `bun pm` forms, and
      confirm no entry captures `bun pm untrusted` — the read `CLAUDE.md`
      relies on (→ "A read-only sibling is not captured")
- [x] 7.4 Restate the requirement as the dependency record rather than
      `package.json` alone, since `bun install` writes the lockfile
- [x] 7.5 Reconcile the counts in proposal, design and `PLAN.md`
- [x] 7.6 Gate `bun patch-commit`, which `Bash(bun patch *)` misses on the
      hyphen, and allow the hyphen in both shape checks; probe `bun link` and
      `bun unlink` and leave them out — neither writes `package.json`
