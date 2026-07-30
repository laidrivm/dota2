# Implementation plan — agent working file

Read at session start; updated in the same turn a task or stage completes
or a decision is made (rule in CLAUDE.md). This file holds status and
decisions; the requirements themselves live in `tasks/` and the sources
below.

## Requirement sources

- `tasks/task-1..9.md` — infrastructure tasks.
- `spec-inbox/` (gitignored, see its README) — unsorted product specs:
  `user-stories.md`, `model-spec.md`, `data-model.md`, `screens-spec.md`,
  `types.ts`, `fixture-snapshot.json`, `generate_fixture.py`. They enter
  the repo in phases 1–2 via OpenSpec artifacts and source files.
- Design: the private claude.ai/design project "Draft board screen design",
  accessed via DesignSync: `tokens/`, `styles.css`, Draft Board / Mobile
  Board mocks, `uploads/design-brief.md`.

## Queue

- [x] **Task 1** — bun supply-chain hardening (commit `b2cd96d`)
- [x] **Task 3** — Biome + tsc + YAML check + actionlint (staged)
- [x] **Task 2** — Dependabot + CI audit (`dependabot.yml`, `audit.yml`);
      awaits manual repo-settings enablement — see checklist below
- [x] **Task 6** — git hooks (simple-git-hooks): pre-commit `biome check
      --staged` (block, no autofix), pre-push `typecheck && bun test
      --pass-with-no-tests`; both demonstrated firing; `/warm` → Keep
- [x] **Task 8** — split `CLAUDE.md` per its own growth protocol (321 →
      186 lines; `docs/api-design.md`, `docs/testing.md`,
      `docs/feature-workflow.md`)
- [x] **Task 9** — unit test setup: native `bun:test`, no framework;
      landed with the model tests (`src/model.test.ts`).
- [x] **Phase 1** — OpenSpec: model module. Merged (PR #8) and archived
      (`openspec/changes/archive/2026-07-23-model-module`; capability spec
      at `openspec/specs/draft-model/`). Shipped `src/{types,model}.ts`,
      `src/fixtures/`, `src/model.test.ts` (31 tests). Two §7 scenarios
      corrected mid-apply — see decisions.
- [x] **Phase 2** — OpenSpec: draft board UI on Preact + design-token
      import. Split into three sequenced proposals, all merged and archived:
  - [x] **2a `ui-foundation`** — merged (PR #10) and archived
        (`openspec/changes/archive/2026-07-24-ui-foundation`; capability
        specs at `openspec/specs/{app-shell,snapshot-delivery,draft-session}`).
        Shipped `index.html`, `server.ts`, `static-routes.ts`, `src/app/**`,
        133 tests. Two design decisions reversed mid-apply — see decisions.
  - [x] **2b `draft-board`** — merged (PR #13) and archived
        (`openspec/changes/archive/2026-07-24-draft-board`; capability specs at
        `openspec/specs/{draft-board,draft-session}`). Shipped the bans row,
        team and enemy slots, suggestion blocks, the result block, the
        collapsed header + editor, the 390px one-column layout, and the first
        `computeModel` call. 244 tests. Corrections mid-apply — see decisions.
  - [x] **2c `hero-picker`** — merged (PR #15 for the proposal, PR #16 for the
        implementation) and archived
        (`openspec/changes/archive/2026-07-24-hero-picker`; capability specs at
        `openspec/specs/{hero-picker,draft-board,draft-session}`). Shipped
        `src/app/picker/`, the reset dialog and undo toast, board hotkeys with
        the `modal` context, `usedAs`, the `re-pick` marker, and three overlay
        tokens pushed to the design project. 319 tests; every **(e2e)** bullet
        walked by hand in Chrome. Corrections mid-apply — see decisions.
- [x] **Task 4** — Playwright smoke. Merged (PR #19) and archived
      (`openspec/changes/archive/2026-07-25-playwright-smoke`; capability spec
      at `openspec/specs/smoke-suite/`). Shipped `playwright.config.ts`,
      `e2e/smoke.spec.ts` (3 tests, Chromium, axe on every state),
      `.github/workflows/{e2e,test}.yml` and `test:coverage`. Automates
      `ui-foundation` **(e2e)** 6.4, 6.5, 6.6; three a11y defects fixed —
      see decisions. 339 unit tests.
Apply order for the four proposed changes is fixed: `coderabbit-config` first
(no preconditions, no shared files), then `vendored-skill-permissions`, then
`coderabbit-local-gate`, then `readme-drift`. The last three all edit
`CLAUDE.md`, and each writes next to what the previous one changed.

- [x] **1. `coderabbit-config`** — merged (PR #24) and archived
      (`openspec/changes/archive/2026-07-25-coderabbit-config`; capability
      spec at `openspec/specs/review-bot-config/`). Four settings in
      `.coderabbit.yaml`: `docstrings.mode: "off"`, `path_filters` for the
      archive / fixture / woff2, `tools` off for biome + yamllint +
      actionlint, `learnings.scope: "local"`, each with its reason beside
      the key. `filePatterns` left as `docs/*.md` with a comment saying why.
- [x] **2. `vendored-skill-permissions`** — merged (PR #26) and archived
      (`openspec/changes/archive/2026-07-26-vendored-skill-permissions`;
      capability spec at `openspec/specs/agent-permissions/`).
      `permissions.deny` for `npx`/`npm`/`pnpm`/`yarn` in the tracked
      `.claude/settings.json`, `ask` reduced to bun's two install commands
      (widened to all 14 manifest-writing forms by 3a), pinned by
      `agent-permissions.test.ts` (4 tests; the deny-list assertion
      was red before the policy was written). All three skills-repo fixes are
      confirmed there — the flag, the README's invocable list, and its
      base-branch sentence; the re-vendoring procedure step is drafted for
      the user to apply. Two rules added to `CLAUDE.md`, three clauses
      trimmed in `docs/review-toolkit.md`.
- [x] **3. `coderabbit-local-gate`** — merged (PR #28) and archived
      (`openspec/changes/archive/2026-07-26-coderabbit-local-gate`; capability
      spec at `openspec/specs/local-review-loop/`). Adds
      `/coderabbit-local` to the pre-PR sequence after `/triage`, three passes
      max, Major and above applied without asking. Apply settled that the CLI
      is `coderabbit` (no `cr`), that it does not read `.coderabbit.yaml`
      unprompted — so the gate prescribes `--config .coderabbit.yaml
      CLAUDE.md --agent` — and that the review quota is shared between the
      web app and the CLI, so a local run can be blocked by browser reviews.
- [x] **3a. `agent-permissions-gaps`** — merged (PR #30) and archived
      (`openspec/changes/archive/2026-07-27-agent-permissions-gaps`; capability
      spec at `openspec/specs/agent-permissions/`). One verification is
      outstanding and cannot be done from the authoring session — see the
      checklist below. CodeRabbit's three
      Major findings against the already-merged
      `openspec/specs/agent-permissions/spec.md`. In order of
      weight: `bun remove`/`bun rm` also mutate `package.json` but are absent
      from `permissions.ask`, while the spec calls its two entries "the two
      bun commands that mutate the dependency manifest" — the wording is
      false either way, so either the policy or the sentence gives. The policy
      gives: propose settled that the mutating surface is three commands in
      eight forms (`bun a`, `bun i`, `bun r`, `bun rm`, `bun uninstall` beside
      the long forms), so `bun a preact` and `bun i` reach a manifest write
      today without prompting — a live hole the finding did not name. Second,
      requirement *The permission policy is pinned by a test* promises to
      guard "the policy above" but its scenarios cover only
      `.claude/settings.json`, so dropping `disable-model-invocation` passes
      silently. Third, *Foreign package managers are denied* says "every
      package manager other than `bun`" while enumerating four. Both narrow
      rather than grow: skill frontmatter cannot be pinned by a test here,
      because `.claude/skills/*` are symlinks to untracked content. Last item
      of the CodeRabbit local-review setup; do it before `readme-drift`.
      Apply verified each new assertion red before green, by breaking the
      policy three ways; the alias probe on bun 1.3.14 confirmed eight forms
      and that `bun un` is not a command. The gate then found the surface
      reaches past the install family — `bun pm pkg set` and `bun pm version`
      rewrite `package.json` unprompted, and `bun pm trust` grants
      `trustedDependencies`, which `CLAUDE.md` forbids the agent to do alone —
      so `ask` is 14 entries — `bun patch-commit` too, which `Bash(bun patch
      *)` misses on the hyphen — and the read-only `bun pm` siblings stay
      ungated, except `bun pm pkg get`, prompted as the cost of one entry
      over three. Idea 5 from `/zombies` — that an
      unparseable settings file fails the run — is left untested: the
      module-level `await Bun.file(…).json()` makes it hold by construction,
      and a fixture would test the fixture.
- [x] **4. `readme-drift`** — merged (PR #33) and archived
      (`openspec/changes/archive/2026-07-27-readme-drift`; capability spec at
      `openspec/specs/repo-onboarding/`). `README.md` calls the
      skills repo private; it is public. Drops the claim rather than
      correcting it, adds the `link.sh` instructions a clone needs, adds
      `.claude/settings.json` and `.coderabbit.yaml` to the ownership map,
      and pins the map's paths with a test. `readme-map.test.ts` guards 14
      rows and skips the gitignored one. All four section 5 gates closed —
      `/zombies` found one gap (an untracked-but-present path must not
      satisfy a row) and it is now a test, `/ponytail-review` collapsed the
      three-branch resolver into one glob, `/coderabbit-local` returned four
      findings, all applied. 364 unit tests. On the PR, CodeRabbit's one
      Major caught the length assertion those four findings left behind
      — `toHaveLength(rows.length)` passes on `0 === 0`, so an emptied map
      generated no cases at all. The probe that had proved the old assertion
      red was not re-run after the rewrite, which is now a rule in
      `docs/verification.md`.
- [x] **3a-check. Confirm the widened permission gate actually prompts** —
      done. In a session started after PR #30 the agent ran `bun update
      --help` and the user was prompted for permission, so the 14 `ask`
      entries are live, not decorative. A session holds the permission set it
      loaded at startup, which is why every attempt from the authoring session
      passed silently. Confirming it takes the user: an approved prompt and an
      unprompted call are indistinguishable from inside the session.
- [x] **5. `reviewable-diff-gates`** — merged as four pull requests (#44, #45,
      #46 and the arrow step) and archived
      (`openspec/changes/archive/2026-07-30-reviewable-diff-gates`; capability
      specs at `openspec/specs/{change-slicing,module-boundaries}`). Makes the
      splitting rule measurable and enforces one import arrow. The first change
      to ship one PR per task group, which is the default it introduces.
      Every change after this one is measured by `bun run diff-budget`.
      The main spec differs from the archived delta in one requirement:
      *An over-budget pull request is admitted only with a named reason* said
      "exceeds 800" while the budget fails at 800 *or above*, so a count of
      exactly 800 fell outside the override's own trigger although the script
      applied it there. The living spec is corrected and carries the boundary
      scenario; the archive keeps what shipped, because it is a snapshot.
  - [x] **5.1 slicing rules** — `feat/reviewable-diff-gates-slicing`. Rules
        and docs only, no code: `CLAUDE.md`, `openspec/config.yaml`,
        `docs/feature-workflow.md`. Closes *The reviewable unit is the step*,
        *A step closes one to three acceptance criteria*, *A seam between
        steps carries a working stub*.
  - [x] **5.2 the budget script** — `scripts/diff-budget.sh`, its test and the
        `package.json` entry. Runnable by hand, wired to nothing. Pairing is
        one awk pass over per-file keys, not the design's two `comm` passes:
        same three conditions, no sorted streams. 22 tests; all four
        threshold assertions watched red under a moved threshold.
  - [x] **5.3 wiring the budget** — the `oversize:` override, the CI job, the
        pre-push call, the gate's line in `docs/review-toolkit.md`. The hook
        chains with `&&`: a `;` would make the absorbed budget the hook's exit
        status and silently retire the typecheck and test gates. The override
        reaches the script through `PR_BODY`, set from the event in `env:`,
        never interpolated into a `run:` line. Verification against
        `design.md`'s table: #30 measures 678 and #21 measures 1688, both
        exactly as recorded. The four most recent merged PRs measure 472, 76,
        112 and 485 — the last two of those sit just under the warning line,
        so the first reading of the threshold is that it is set about right.
        The hook needed `bunx simple-git-hooks` to reach `.git/hooks/pre-push`:
        editing `package.json` changed the declaration and nothing on disk, so
        the first push after the edit ran the old hook. Now a rule in
        `docs/verification.md`.
  - [x] **5.4 the import arrow** — `biome.json`: `noImportCycles` repository
        wide, plus a `noRestrictedImports` override scoped to `src/model.ts`
        and `src/types.ts`, and one rule line. The option shape came from
        Biome's own `configuration_schema.json` in `node_modules`, not from the
        design's recollection of it. Four probes, each red where it was planted
        and green after revert: a value import in `src/model.ts`, a type-only
        import in `src/types.ts` — so the boundary covers types without extra
        configuration — a `src/app/storage.ts` ↔ `src/app/session.ts` cycle,
        reported on both files, and a staged violation in `src/types.ts` that
        `git commit` itself rejected with exit 1. Two more probes fixed the
        override's blast radius: a sibling `src/app/` file is untouched by it,
        and `noDoubleEquals` still fires inside `src/model.ts`, so the override
        merges with the recommended preset rather than replacing it. Every
        probe was run twice: first under Biome 2.5.4, which was what
        `node_modules` held, and again under the 2.5.5 that `bun.lock` pins and
        CI installs — the local tree had fallen behind the lockfile, so the
        first round verified a version CI never runs. Same result on both. The
        rules list
        in `CLAUDE.md` now stands at 20, its maintenance trigger — the split is
        already queue item 7 (`always-on-context-budget`), so no separate
        proposal.
- [ ] **6. `mechanised-prohibitions`** — applying. Converts
      the prohibitions that carry no judgement into `deny` entries, a
      `PreToolUse` hook, `gitleaks` and a suppression check, then splits the
      rules list into code / process / safety and deletes what the mechanisms
      replaced. Four task groups, four PRs: permissions → secrets →
      suppressions → rulebook, the last one last because it removes the prose
      the first three take over.
  - [ ] **6.1 deny entries and the git guard** —
        `feat/mechanised-prohibitions-permissions`. Three `gh` write
        commands denied, `scripts/command-guard.ts` under a `PreToolUse` hook, 24
        guard tests and 5 settings assertions. Tasks 1.9 and 1.10 confirmed in
        the authoring session — see decisions.
- [ ] **7. `always-on-context-budget`** — proposed
      (`openspec/changes/always-on-context-budget`), not yet applied. Measures
      the budget that exists — `CLAUDE.md` plus this file, 738 lines — evicts
      this file's decisions section by a three-way test, gives it a growth
      protocol, and states the fence practice as a rule. Two task groups, two
      PRs: plan and trigger → the rule and the bot instruction. Runs after both
      5 and 6 — 5 measures every later change, and 6 deletes the Gates section
      and splits the rules list this one writes into.
- [ ] **`review-approval-direction`** — proposed
      (`openspec/changes/review-approval-direction`), not yet applied. Moves
      the review-run approval from the fix to the dismissal: any severity is
      fixed without asking, a Major or Critical dismissal is the user's. One
      task group. Unnumbered because it is not part of the numbered sequence,
      but **not** unsequenced: it corrects wording in `PLAN.md` that 7 then
      collapses, so it applies before 7. Both now sit on one branch, so that
      ordering is task order inside one apply rather than PR order.
- [ ] **`skill-provenance`** — proposed
      (`openspec/changes/skill-provenance`), not yet applied. Records which
      shared skills the gates depend on and the commit each was verified
      against, marks the five nobody depends on archived, pins the table with a
      test, and hands the `skills-lock.json` patch to the user. One task group,
      one PR. Unnumbered like `review-approval-direction`, and genuinely
      unsequenced this time — it touches `docs/review-toolkit.md` and a new
      test file, which nothing else in the queue edits.
- [ ] **`review-bot-instructions`** — proposed
      (`openspec/changes/review-bot-instructions`), not yet applied. Points the
      bot at the two reviews no local skill performs — the delta spec, and the
      diff against its own proposal — wires it into the ponytail ladder and the
      fix-and-capture loop, and enables MCP so the API-existence rule becomes
      checkable. One task group, one PR. Applies after
      `always-on-context-budget`, which creates the test and the
      `**/*.{ts,tsx}` clause this one extends.
- [ ] **`spec-test-traceability`** — not yet proposed. Extends
      `openspec/config.yaml`'s "every criterion is cited by a task" one step:
      cited by a **test**, via a criterion identifier in the test name and a
      script that greps both sides. Second of the three the source analysis's
      items 25–31 decompose into.
- [ ] **`mutation-floor`** — not yet proposed. Mutation testing over
      `src/model.ts` and `src/types.ts` only, its own CI job, floor set from
      the first measurement and forbidden to fall. Tool through `/warm` first;
      a hand-rolled AST mutator is the fallback. Third of the three, last
      because it is the heaviest.
- [ ] **`reviewable-diff-gates` — reverse two non-goals** (item 29). The
      file-size cap (~300 `.ts`, ~200 `.css`) and the rule of two are recorded
      there as deliberate non-goals; the import arrow is already in its scope.
      An `/opsx:update` on that change, not a new proposal.
- [ ] **`tracked-permission-policy`** — proposed
      (`openspec/changes/tracked-permission-policy`), not yet applied. Gates
      `bunfig.toml` and `.npmrc` with `Edit` rules, and curates the 170
      auto-accepted allow entries out of the untracked settings file into the
      tracked one. Two task groups, two PRs. Applies after
      `mechanised-prohibitions`, which rewrites `deny` and adds `hooks` in the
      same file.
- [ ] **Task 7** — Docker + VPS deploy (open decisions: registry
      GHCR/Docker Hub, same VPS or a new one)
- [ ] **Phase 3** — OpenSpec: STRATZ → Postgres → snapshot bundle pipeline
      (blockers: API key, pick-phase granularity in STRATZ)
- [ ] **Task 5** — error tracking (precondition: product is deployed)

## Accepted decisions

- `mechanised-prohibitions` step 1: four things the design did not foresee, all
  found by the gates rather than by writing the code. The guard fails closed on
  an event it cannot read, but a guard that never *starts* — an unresolved
  `${CLAUDE_PROJECT_DIR}`, an absent `bun` — exits 1, which Claude Code treats
  as non-blocking, so the whole boundary would vanish silently; the registration
  carries `|| exit 2` and the three outcomes were run through `sh` to confirm
  0/2/2. Git bundles short flags, reading `push -uf` as `-u -f`, so a
  whole-argument match on `-f` alone missed a spelling git itself accepts —
  confirmed against the binary, which parses `-uf` past option handling while
  rejecting an unknown flag outright. And the compound-command split had to
  become quote-aware, which cuts both ways: it severed a force flag from its
  command, and it turned a quoted `;` inside `--grep` into a fragment that read
  as a commit and blocked a read. `--exec-path` came out of the value-taking
  global options, since bare it prints the path and runs nothing. The delta spec
  and `design.md` carry all four.

- The guard lost its `if` field, on the user's push-back against a rejected
  CodeRabbit Critical. The finding said a `deny` entry matches the command word
  literally, so `/opt/homebrew/bin/gh pr comment` walks past it — true — and
  proposed a hook, which was rejected because a hook's `if` field inherits the
  same ceiling, demonstrated by `/usr/bin/git push --force` passing the
  registered guard. The rejection was right about the bot's remedy and wrong to
  stop there: dropping `if` altogether closes it, because the script then sees
  every Bash call and resolves the command to its base name, past a leading
  assignment, a wrapper word (`command`, `builtin`, `exec`, `env`) and into a
  shell's `-c`. The only argument for narrowing was cost, and it was never
  measured; it is 16-22 ms per Bash call. `gh` moved into the guard for the same
  reason, so `scripts/git-guard.ts` is `scripts/command-guard.ts` now. Both
  bypasses were confirmed closed live, against the same two commands that had
  passed. The residual ceiling is a command whose text never contains the
  guarded name — `python -c` spawning a subprocess — which is outside the
  agent-not-adversary model this guard is for. The deny entries stay as a
  zero-cost first pass. Two side effects worth knowing: the guard now blocks any
  Bash command whose *text* contains a forbidden invocation, which caught a
  diagnostic script of mine that merely passed `git push --force` as a string;
  and `|| exit 2` now fails all of Bash closed rather than only git, which is
  the same direction and a wider blast radius.

- Tasks 1.9 and 1.10 rested on a false premise, and both are done. They say the
  authoring session cannot observe its own hook because settings load at
  startup — generalised from `3a-check`, which established that only for the
  *permission* set. A hook is re-read from `.claude/settings.json` per tool
  call: the guard registered mid-session blocked a force-push immediately, and
  stopped blocking the moment `git checkout main` put a settings file without
  it on disk. So the check cost three commands rather than a session boundary,
  and `docs/verification.md` now says which half of the claim holds.
  1.10 is closed by `bun test && git commit` with `HEAD` on `main`: blocked, and
  `bun test` never ran, so the `if` field matched the git subcommand rather than
  the command string's prefix. The `|| exit 2` fallback also proved itself
  unprompted — with the hook registered and the guard script absent from
  `main`, every git command was blocked until the registration was removed with
  a non-Bash tool. That is the intended failure direction, and it is worth
  knowing that a half-applied guard locks git rather than degrading quietly.

- `reviewable-diff-gates` step 1: the PR-description rule was amended in
  place rather than joined by a sentence about naming criteria — the two
  read as a contradiction otherwise, since an identifier *is* a reference to
  an acceptance criterion. What the identifier prohibition now forbids is the
  criterion's text, which is the part CodeRabbit regenerates. The
  reconciliation grep found the default restated nowhere else by name, but
  twice by cadence: `docs/feature-workflow.md` spoke of "the branch" for a
  whole change and of archiving once "the change is merged", both of which
  are per-step now. The instruction to split a feature into sequenced
  proposals is deleted rather than given a number: its trigger was an
  adjective in the same rule block that forbids adjectives, and with the step
  as the reviewable unit a proposal's step count no longer bounds anything.

- Cross-artefact staleness is not held by prose, demonstrated on three pull
  requests in a row. The rule *When a statement changes … grep every site that
  restates it* was widened on 2026-07-29 to name a change's own sibling
  artefacts, precisely because a delta spec kept being corrected by a review
  finding while its proposal still said the old thing. It was then violated
  twice more in the same session — PR #40 raised two findings of exactly that
  class, PR #41 one. The trigger fires at the wrong moment: the correction
  happens mid-review, where the rule reads as an end-of-change checklist. So
  the mechanism is what closes it, not a tighter sentence —
  `review-bot-instructions`' `openspec/changes/**` instruction has the bot
  compare a change's artefacts against each other, and that is the argument for
  its position in the queue.

- `tracked-permission-policy`: the registry rule is expressible as a
  permission entry, unlike the two git prohibitions `mechanised-prohibitions`
  gave a hook, so it gets two lines and no script. What settles the shape is
  the docs: file permission checks match `Edit(path)` only — a `Write(path)`
  rule is accepted, never matched, and warns at startup — and `Bash(command:…)`
  and its `file_path` equivalent are ignored outright, so no permission rule
  can see a *key*, only a file. The two files then fall on opposite sides:
  `.npmrc` has no legitimate content here at all, so its existence is the
  event and `deny` is exactly as coarse as the prose; `bunfig.toml` carries
  `[test] pathIgnorePatterns` and the release-age gate, so `ask` is the
  strongest rule that does not break a legitimate edit. A `PreToolUse` hook
  reading `tool_input.new_string` was rejected — more precise, and a second
  script to keep true, to save a prompt on a file edited twice since it was
  created. The prose rule stays in `CLAUDE.md`, unlike the ones that change
  deletes, because a shell redirection writes either file without an `Edit`
  call and the mechanism is therefore partial. `bunfig.toml`'s
  `minimumReleaseAgeExcludes` is covered by the same rule, being in the same
  file — its own comment already said "add entries only with an explicit user
  decision". `.npmrc` is denied rather than asked not because bun ignores it
  but because bun *reads* it — `bun install --help` on 1.3.14 lists it beside
  `bunfig.toml` as a registry source `--registry` overrides — and this
  repository deliberately has none, so a live channel is being kept shut. The
  entry is a prompt and not a proof, which the capability states outright:
  a shell redirection, a permission mode such as `acceptEdits`, and a
  subprocess each pass it. On the allow list, the test pins the criterion and
  not the entries: pinning fifteen conveniences by name would make every added
  convenience a test edit. The criterion is two rules over two forms, because
  the entries are not uniformly paths: 145 of the 170 are `Bash(...)` command
  strings and 6 are `Read(...)` specifiers. No entry may carry an absolute path
  token — lexical, no shell parsing, catches both `Read(//Users/…)` and
  `Bash(cp … /tmp/c.bak)`; and a path specifier additionally resolves against
  the repository root, which is what catches `Edit(../../secrets/**)`. Parsing
  paths out of a `Bash` command was rejected: quoting, globs, redirections and
  expansions, to gate a file a human reads on review. Whether an entry is a one-off stays a review criterion,
  answered in the PR body: repo-relative, it is indistinguishable from policy
  by path alone.

- `review-bot-instructions`: most of the source analysis's item 27 was already
  shipped by `coderabbit-config` on 2026-07-25 — `path_filters`, the three
  disabled linters and `learnings.scope: "local"` are in the file with their
  reasons, `!dist/**` was rejected there as a no-op over a gitignored
  directory, and `docs/**/*.md` because `filePatterns` has no negation syntax
  and would pull in `docs/context/`. So the claim that the bot duplicates Biome
  had been false for four days. What was live: the two reviews no local skill
  performs. The division is structural rather than a matter of skill — every
  local skill takes a diff and only a diff, while reviewing a delta spec means
  reading a document against `openspec/config.yaml`, and catching scope creep
  means reading the diff against a proposal it never mentions. Both are reviews
  of a diff *against something else*, which is the shape a PR bot has.
  Teaching `/triage` to do it was rejected: it returns no findings by design,
  so it has nowhere to put one. On MCP, the schema settles two things —
  `knowledge_base.mcp.usage` defaults to `auto`, which **disables** MCP for a
  public repository, so an instruction depending on version-accurate docs would
  have shipped against a dead source; and the config can only *deny* servers
  (`disabled_servers`), never allow them, so "only Context7 is connected" is
  dashboard state and the user's, not this file's. Context7 covers all three
  libraries — `/oven-sh/bun`, `/microsoft/playwright` and `/preactjs/preact`,
  the last an order of magnitude thinner than the other two when checked on
  2026-07-29; the index is theirs and moves, so those figures are dated
  evidence and not a guarantee this repository can make — and Preact's
  thinness is
  accepted, because where the index says nothing the rule falls back to the
  prose it is today, which is a floor and not a regression. The library
  documentation is community-contributed with no accuracy or safety warranty,
  which makes it in principle an injection surface into the reviewer's context;
  taken anyway because the alternative is not safety but the status quo, where
  the same claim comes from training data with no source at all, and because
  the bot comments rather than commits. Checkpoint: after three or four PRs,
  ask whether any finding of the API class appeared and set `usage` back to
  `"disabled"` if none did. Items 25–31 split into three sequenced proposals —
  this one, `spec-test-traceability`, `mutation-floor` — plus item 29, which is
  an update to `reviewable-diff-gates` rather than new work, since that change
  already carries the import arrow and records the cap and the rule of two as
  non-goals.

- `skill-provenance`: three premises of the source analysis did not survive
  checking, and the survivors reshaped the change. `skills-lock.json` lives in
  the shared repository and carries **one** entry, `playwright-cli` — the only
  skill vendored from outside; the other thirteen are authored there and have
  no upstream to fall behind, so `ref`/`vendoredAt` is a one-row hand-off, not
  a fleet problem. The skills' README and the base-branch conventions were
  already fixed upstream: all seven diff skills now use `git rev-parse
  --abbrev-ref origin/HEAD` with a `main` fallback, where the analysis found
  three conventions. That staleness is the argument for the change rather than
  against it — nothing here recorded which upstream state the observation was
  made against. What remains, and belongs to this repository, is the symlink:
  `.claude/skills/<name>` points at a working tree, so the gate is whatever is
  checked out, invisibly to any diff here. The recorded value is therefore
  **verified against**, not vendored at — `computedHash` already answers "was
  my copy edited?", and "when did I copy it?" is undefined for thirteen of the
  fourteen, while "does the contract in `docs/review-toolkit.md` still describe
  what will run?" is defined for all of them. The table lives in
  `docs/review-toolkit.md` beside the contracts it dates, in the shape
  `readme-map.test.ts` already parses, rather than in a new root manifest that
  would be a second place naming the same skills. Archived entries carry no
  commit on purpose: a verified-at on something nothing depends on claims a
  check whose absence would never be noticed. Of fourteen skills, six are
  referenced anywhere in tracked files, five more are symlinked and named
  nowhere, and three are not symlinked at all. The test never resolves the
  symlinks — they point outside the repository and are absent from a clone,
  the same reason `agent-permissions` gives for not pinning skill frontmatter.

- `always-on-context-budget`: the premise that the standing constraints need
  moving into the code is false, and checking the tree is what showed it —
  `computeModel` (`src/model.ts:152`), the 1 dp antisymmetry assertion
  (`src/model.test.ts:344`), the inline `@import` (`index.html:7`) and the
  snapshot URL (`src/app/snapshot.ts:1`) all already carry their comment, so
  those four entries are deletions from this file rather than moves into the
  code. The direction of the duplication was the opposite of the one assumed.
  What survives of that idea is the rule, which the four existing comments
  justify: the practice exists here and nothing says to keep it, while
  `/ponytail-review` runs over every diff looking for constructions that look
  gratuitous. The eviction is per entry and not per section, because a
  five-item sample of the archive suggested it held everything and the sixth,
  `aria-disabled` on taken tiles, is in no archived change — a wholesale
  deletion would have lost it. The three dispositions are ordered rather than
  parallel, settled by `/zombies` at propose: an entry can be both a fence and
  archived, and deleting it on the archive's strength leaves the governed line
  unmarked, since nobody reads the archive before editing a line. `docs/**` is
  excluded from the budget because that exclusion is the growth protocol's
  lever — a budget counting `docs/` would price extraction at zero. No CI check
  on the line counts: the trigger asks what belongs in the file, and a build
  failure is cleared by moving text to somewhere uncounted. No third file
  either — the archive is the outlet, and archived changes are never edited to
  receive an evicted entry.

- `review-approval-direction`: the override of the skills' "No fixes before
  approval" loses its severity scope rather than gaining a second rule beside
  it — the reason the override exists is that the branch is unpushed and a
  wrong fix costs a `git checkout`, and that reason never consults the severity
  label. The approval moves to the dismissal, where the asymmetry is real: a
  wrongly applied fix is reverted in one command, a wrongly dismissed Major
  merges. Minor and Trivial keep self-service skipping, because a gate on every
  dismissed Trivial trains everyone to approve without reading — the failure
  `coderabbit-config` already named for a permanently amber check. The gate
  line is where this is observable: `OPEN` now means a dismissal awaits the
  user, never a fix, so a run that fixes everything closes at `PASS` whatever
  the severities were. The skills are not edited from here; the wording is
  drafted for the user to apply in their own repository, and the project's spec
  already outranks them either way. The two Major dismissals made on
  `mechanised-prohibitions` under the old reading were put to the user
  retroactively and upheld, so that change needs no revision on their account.

- `mechanised-prohibitions`: the split between `deny` and a hook follows what
  each can express, not taste. `deny` matches a command prefix, which fits
  `gh pr comment` and does not fit either git rule — `git push origin feat/x
  --force` puts the flag last, and `git commit` is forbidden only when `HEAD`
  is on `main`, which no pattern can see. So `Bash(git push --force*)` was
  sketched and dropped: a boundary that holds only for the well-behaved caller
  is what this change exists to stop relying on. One `scripts/command-guard.ts`
  under a single `PreToolUse` entry with `if: "Bash(git *)"`, in bun rather
  than the documented `jq` (not a dependency here, not shipped by macOS), and
  reading `tool_input.command` rather than the raw payload, so a `--force` in
  a command's *description* cannot block a push. The hook contract was checked
  against `code.claude.com/docs/en/hooks`: exit 2 blocks and stderr becomes
  the reason; any other non-zero is non-blocking. The script therefore has two
  exits, 0 and 2, and an event it cannot read takes the blocking one: a
  separate "could not determine" code was drafted and dropped once it was clear
  that it lets the commit run with a transcript notice, which is the failure
  the hook exists to remove. The spec says exit 2 outright, since "non-zero"
  there would have permitted the one code that lets the commit through. The same
  page settles what the design had left open: `if` uses permission-rule
  syntax and matches each subcommand independently, stripping leading
  `VAR=value` and looking inside `$()`, so one entry covers `bun test && git
  commit` and there is no second entry to add. It matches the command word
  literally, so `/usr/bin/git commit` never reaches the hook — an accepted
  ceiling, since the guard is against a probabilistic agent and not against
  someone hunting a spelling the matcher misses. The result is stricter than the prose it replaces —
  force-push was forbidden only after a PR opened, and the agent now loses it
  entirely, because encoding "after a PR is open" means a `gh` call on every
  push. `gitleaks` comes from a digest-pinned image in CI, the way
  `actionlint` already does, and from an optional local binary in pre-commit:
  a hard prerequisite would break the first commit of a fresh clone on a Go
  binary this repository cannot install for you, and CI-only would catch a
  secret that is already pushed. The suppression allowlist keys on path,
  **marker and count**, so neither a second suppression nor one swapped for
  another kind rides in on the first one's approval, and the scanned set is
  `.ts`/`.tsx`/`.json` less the check's own script and test — prose names those
  tokens while discussing them, this proposal three times over, the check
  cannot match a marker without spelling it out, and a check that fails on its
  own proposal or on itself gets disabled in its first week. Departure from the source
  analysis: the pre-PR sequence stays in `docs/review-toolkit.md`, which
  already owns it, rather than moving to `docs/feature-workflow.md` — the only
  genuine duplicate is `PLAN.md`'s "Gates (reminder)" section, and
  `feature-workflow.md` references the sequence without repeating it. The grep
  rule is narrowed rather than dropped, because `openspec/specs/**` and the
  README ownership map still restate things this change does not touch.

- `reviewable-diff-gates`: the cap counts tests too. Exempting them was
  considered and rejected — that heuristic belongs where a human writes tests
  reluctantly, whereas here they are agent-written, nearly free, and the place
  slop hides, so exempting them would remove attention from the part that
  needs it most. `openspec/**` is not excluded either, although it dominates
  most diffs: a 1688-line proposal PR is exactly what the gate should catch,
  and sequenced proposals are the remedy `config.yaml` already prescribes.
  Only `bun.lock`, `*.woff2`, `src/fixtures/snapshot.json` and the two lines
  of a checkbox flip come off, where a flip is a removal and an addition in
  the **same file**, with identical text once the box is normalised and with
  **opposite** boxes. Netting the counts was tried and dropped: it cancelled a
  rewritten task line against an unrelated tick. The path and the
  opposite-state condition close the other two ways an exclusion can fire
  wrongly — an identically worded task moving between files, and a verbatim
  move with the box unchanged. Thresholds 500/800 were checked against
  the 26 merged PRs (median 194, eight over 500, seven over 800), so they bite
  the top third. The cap is a sensor, not the mechanism — a tight cap on a
  horizontal task yields four unreviewable stumps, so the causal rule is at
  propose: a step closes one to three acceptance criteria and leaves the app
  working, with a temporary stub at the seam (2b's native `<select>`, promoted
  from a one-off decision to a rule). One `oversize:` marker, not a second
  `mechanical:` one — mechanical is a reason, and naming the reason is already
  the requirement. Enforcement of the import boundary is Biome, verified on
  2.5.4 before the design was written: `suspicious.noImportCycles` reports a
  two-file cycle, and a `style.noRestrictedImports` override on `src/model.ts`
  and `src/types.ts` with `patterns[].group` catches both value and type-only
  imports from `./app/**`. One arrow, not a layer lattice — the current graph
  is clean by accident, and a lattice would have to permit
  `picker.tsx → board/hero-tile.tsx` by name.

- `vendored-skill-permissions`: the enforcement is a `permissions.deny` list,
  not a `PreToolUse` hook — deny is evaluated before ask and allow, matches
  each subcommand of a compound command independently, and merges across
  settings scopes, so it overrides both a skill's `allowed-tools` grant and
  the untracked `.claude/settings.local.json`. A test scanning skill grants
  was designed and then cut: `playwright-cli` grants `npx`/`npm` and cannot be
  edited from this project, so the test is red on arrival, and its inverse
  ("a grant is fine when deny covers it") is a tautology. The residual risk —
  a skill granting something forbidden that the deny list does not name — is
  closed by a step in the shared skills repo's re-vendoring procedure, drafted
  here and applied there. The `playwright-cli` skill is not forked: its binary
  is already installed through bun (`~/.bun/bin/playwright-cli`), so its whole
  body runs unchanged, and `npx playwright test` in its two reference files
  substitutes with `bunx playwright test`. Apply verified all three deny
  scenarios live in Claude Code 2.1.220 on macOS 25.2.0, interactive mode:
  `npx` blocked in a plain command, blocked inside `bun run build && npx
  some-tool`, and `npm view preact version` blocked despite
  `.claude/settings.local.json` line 47 allowing `Bash(npm view *)` among its
  119 allow entries. The skill-grant scenario was run with `/playwright-cli`
  actually invoked, so its `Bash(npx:*)` grant was live and still lost to
  deny, while `playwright-cli --version` returned `0.1.17`. The rules took
  effect without a restart. The precedence the whole design rests on is
  confirmed against `code.claude.com/docs/en/permissions`: "Rules are
  evaluated in order: deny, then ask, then allow", and an `ask` rule prompts
  even when a more specific `allow` matches — so the untracked local
  settings can neither re-open a denied command nor silence a prompt.
  Whether an `ask` rule fired is not observable from inside a session: an
  approved prompt and an unprompted call look identical to the agent.
  Task 3.1 — no startup warning about a malformed rule — is the user's
  observation on their own restart, not the agent's.
  `CLAUDE.md`'s existing `bunx`/`npx` rule is left
  alone: its subject is a package that has not passed the dependency check,
  and deny blocks a command without verifying anything, so it is not a
  restatement of the new boundary. The "Rules" list now stands at 19, one
  short of its own ~20 maintenance trigger.
- `readme-drift`: the "private" claim is deleted, not corrected to "public" —
  the fact belongs to another repository and can change with nothing changing
  here, so the root-cause fix is to stop stating it and link instead. The
  existing grep rule in `CLAUDE.md` is left alone: it fires on a local change
  and nothing local changed, and widening it to "re-verify external facts"
  would make it uncheckable. Only the map's paths get a test — a README is
  prose about intent, and no check decides whether a sentence is still true.
  The test must consult `git check-ignore`, because `.claude/skills/` is in
  the map and gitignored, so an existence check would pass here and fail in a
  clone. Apply settled that resolution reads `git ls-files` rather than the
  filesystem — one list covers the literal, directory-prefix and glob forms,
  and an untracked file cannot satisfy a row, which is the same guarantee
  from the other side. The rewritten skills row leads with the backticked
  `.claude/skills/` and carries the repository as a markdown link, so the
  parser still finds a path in it and the check-ignore skip is the branch
  that fires — a row with only a link would have been silently unparsed.
  Both guards were watched red first: a renamed row, and a renamed heading
  emptying the set. The "Rules" list stands at 18.
- The `CLAUDE.md` "Rules" list crossed its own ~20 maintenance trigger at 21,
  so the verification cluster — environments, external contracts,
  observability, causal claims — moved to `docs/verification.md` under the
  growth protocol, leaving one index line and 16 rules. The cluster was the
  largest and the most stable; the remaining rules share no second theme big
  enough to promote, so the next overflow needs a different cut.
- `coderabbit-local-gate`: CodeRabbit learnings are unreachable from the CLI
  (every documented path needs a PR comment or the web dashboard), so the
  substitute is the route already wired — `.coderabbit.yaml` points
  `knowledge_base.code_guidelines.filePatterns` at `**/CLAUDE.md`, so a
  justification written as a rule is read back by the next review. **The CLI
  does not read that config unprompted** — settled inside apply, before any
  rule was written: `coderabbit review --show-prompts` replayed three saved
  prompts carrying none of this repo's `path_instructions`, and the reviewed
  file list held five `openspec/changes/archive/**` paths that `path_filters`
  excludes. So the gate prescribes `--config .coderabbit.yaml CLAUDE.md`
  beside `--agent`, and `docs/review-toolkit.md` states why the flag is not
  optional, since the command itself lives in the skill's own repository.
  The explicit form is confirmed to work: the gate's own run over this branch
  reviewed no `openspec/changes/archive/**` path, where the unprompted run
  reviewed five. Mirroring `.gitignore` into
  the config is not needed either way — `--include-untracked` is defined as
  tracked changes plus *non-ignored* files. Only a settled convention becomes
  a rule; a
  bot's taste objections would blow through the rule quality bar and the ~20
  rule maintenance trigger. Major and above are auto-applied, deliberately
  overriding the skill's "No fixes before approval" — the branch is unpushed,
  so being wrong costs a `git checkout`. `/coderabbit` stays the user's *to
  invoke*, because its cost is the wait for the PR bot, which a synchronous CLI
  review does not have; its findings are then disposed of on the same terms,
  Major and above without asking, since invoking it is the approval.
- `coderabbit-config`: `docstrings.mode: "off"`, not a lower `threshold` — a
  permanently amber check devalues the checks beside it, and this project has
  no docstring rule for one to enforce. `path_filters` excludes
  `openspec/changes/archive/**`, the generated fixture and woff2 binaries, but
  never `openspec/**` wholesale: the schema says those patterns also drive the
  bot's git sparse-checkout, so excluding the specs would stop it reading
  them, and this repo opens proposal PRs separately from implementation PRs —
  the exclusion would leave every proposal PR unreviewed. `dist/**` is not
  filtered because it is gitignored, so the rule would be a no-op. Three of
  the 57 tool integrations go off — biome, yamllint, actionlint — each because
  `lint.yml` or the pre-commit hook already runs it; markdownlint and the
  secret scanners stay on. `code_guidelines.filePatterns` stays `docs/*.md`:
  `filePatterns` has no negation syntax, and `docs/` is flat by the growth
  protocol, so the flat pattern already excludes the `docs/context/`
  save-points that `CLAUDE.md` says are never loaded automatically —
  `docs/**/*.md` would pull them in with no way to exclude them. Apply
  settled the two things propose left open: every key path was checked
  against `schema.v2.json` and exists with the value given (`docstrings.mode`
  enum `off`/`warning`/`error`, `learnings.scope` enum `local`/`global`/`auto`
  whose `auto` the schema itself defines as resolving by repository
  visibility, `path_filters` a string array whose description confirms the
  sparse-checkout behaviour, and `enabled` on each of the three tools); and
  the 3.1 grep found no other site restating this configuration —
  `tasks/task-8.md` and the `path_instructions` citations concern
  `filePatterns`, which this change deliberately does not touch.
- `vendored-skill-permissions`, invocation half: `CLAUDE.md` wins over the
  skills repo's `0df4241` — `disable-model-invocation: true` returns to
  `coderabbit`, because the reason it was reserved for the user still holds
  (the bot's review arrives on its own schedule; an agent that waits burns a
  session). Only the `/zombies` and `/warm` clauses in the Review toolkit are
  redundant with their skills' `description`; `/triage` differs in trigger and
  position, `/ponytail-review` ships in the ponytail plugin and its
  description inverts the instruction, so both clauses stay. The skills repo's
  `README.md` line 23 is wrong on both halves — eight skills lack the flag,
  not two, and three different base-branch conventions hide behind "defaulting
  to `main`".

- Task 4 deferred `ui-foundation` **(e2e)** 1.5 (`dist/` under a plain static
  server) to Task 7: `build.test.ts` already asserts what `dist/` carries, and
  the residual "it boots in a browser" costs a second `webServer` plus a build
  per e2e run — nearly free once Task 7 introduces the container that serves
  `dist/`. The ~25 **(e2e)** bullets from `draft-board` and `hero-picker` are
  the e2e backlog; the second spec file is where fixtures earn their keep.
- Playwright's runner works under bun — no node toolchain. `e2e/*.spec.ts`
  matches bun's own test glob, so `bunfig.toml` carries
  `[test] pathIgnorePatterns = ["e2e/**"]`.
- The first axe scans failed on three real defects, all fixed in the app: the
  page had no `<h1>` (the product name is one now, and the snapshot error
  state carries its own); `--text-5` read 3.10:1 and became `#7e8897`; and
  hero tile lettering missed AA on 13 of 52 colours, so the inks became pure
  `#000`/`#fff` and `INK_THRESHOLD` moved 0.22 → 0.18 — the luminance where
  the two contrast equally, worst case now 4.64:1. All three values are
  design-owned and were pushed back to `tokens/colors.css` in the design
  project, with the contrast rationale as comments beside them. Its two
  guideline pages still hardcode the old inks — see the next bullet.
- That threshold move revives the tile contrast-floor test recorded below as
  deliberately dropped: pinned at the old threshold it guarded nothing, and it
  guards the whole palette now. `--text-5` gained the same guard in
  `styles.test.ts`; `--text-6` is exempt on purpose (separators, disabled
  controls, the result arrow — all exempt under WCAG 1.4.3).

- UI stack: **Preact** (first runtime dependency, WARM in phase 2).
- Deploy: **Docker on a VPS**.
- **camelCase in all JSON** — types.ts / fixture / generator get renamed
  keys when imported into the repo (phase 1); the bundle contract too.
- Phase 1 corrections (found during apply, spec updated): §7.1 counter-risk
  is NOT zero at an empty draft (open=1, pop=contest), so "pure meta+side"
  ordering holds only up to that term; §7.3 antisymmetry holds only to ~1
  dp, not 1e-6, because my roles are known while enemy roles are inferred.
- Fixture is Biome-owned format: regenerate from the repo root with
  `python3 src/fixtures/generate_fixture.py > src/fixtures/snapshot.json &&
  bunx biome format --write src/fixtures/snapshot.json`.
- `computeModel` trusts a well-formed session (the UI is the validation
  boundary); a hero in two sets is undefined behavior, not defended — no
  extra validation code.
- STRATZ: the user provides the API key; rate limits —
  https://stratz.com/knowledge-base/API/Are%20there%20any%20rate%20limits%3F;
  pick phases: extract via GraphQL or defer to v2.
- GitHub Actions: pin by full commit SHA + version comment; bun pinned to
  1.3.14 in CI.
- Dependency bot: **Dependabot**, not Renovate — it meets every Task 2
  requirement (bun ecosystem, 3-day `cooldown`, security updates bypass
  cooldown, keeps actions SHA-pinned) and is first-party, so no third-party
  GitHub App gets write access to this hardening-focused repo. Trade-off:
  no Dependency Dashboard and no lockFileMaintenance; the nightly
  `bun audit` compensates for the latter.
- Build tooling: **Bun's native bundler only**, no Vite. `bun run build` is
  `bun build ./index.html --outdir=dist` plus copy steps for the fonts and
  the snapshot; `bun run dev` is `server.ts` under `--hot`.
- `server.ts` + `static-routes.ts` serve the app in dev and production; Task
  7 containerises them. Bun's CSS bundler inlines every `url()` asset as
  base64 and its HTML dev server serves no static files, so the font faces
  and the snapshot are served from their own routes instead.
- IBM Plex fonts: self-hosted (decided in favour of offline operation).
  Mono has no variable release, so weights are separate Latin1 `woff2` faces
  taken from IBM's own packages — Sans 400/600, Mono 400/600 so far — with
  the OFL licence beside them in `src/app/styles/fonts/`. `fonts.css` holds
  the `@font-face` rules, stays out of the bundler, and index.html pulls it
  in with an inline `@import`, which Bun leaves alone. No font package.
- Snapshot reaches the client through a **URL** — the constant
  `/snapshot.json` in `src/app/snapshot.ts` — never a module import, so
  Phase 3 replaces the producer and nothing else. Not a hashed bundler
  asset either: that would force a rebuild to publish a snapshot. Last good
  bundle cached in `localStorage`.
- No DOM test environment: pure modules get `bun:test`, DOM-level scenarios
  are e2e (Task 4). No `happy-dom` dependency.
- `build.test.ts` stays in the default `bun test` run (and so in the pre-push
  hook), not CI-only: the copy steps and the inline-`@import` behaviour it
  guards fail silently, and catching that at push is worth ~200 ms.
- Hooks: simple-git-hooks, not husky; e2e never runs in hooks.
- All repo artifacts are in English (CLAUDE.md rule).
- No OpenSpec exemptions: the criterion in `docs/feature-workflow.md` is
  the only test.
- Unsorted product specs live in `spec-inbox/`, gitignored except its
  README — the public repo carries the pointer, never the content.
- Hero tiles take their background from the `--hero-<short>` token and derive
  their ink from that colour's relative luminance (threshold 0.18 since Task
  4; 0.22 as first shipped), so the palette is never restated in TypeScript.
  CSS `contrast-color()` was rejected — it flips the palette's mid-tone blues
  to black. The derived ink differs from the mock on exactly one hero (Wraith
  King), in favour of contrast.
  `tokens/colors.css` gains `--tile-ink-dark`, `--tile-ink-light`, and
  `--hero-fallback`, pushed back to the design project to keep the copy
  verbatim.
- Proposal 2b enters picks through a temporary native `<select>` so the board
  is usable and testable before the picker exists; 2c deletes it and points
  the same `applyAction` seam at the picker overlay.
- Side/role hotkeys become context-scoped in 2b (Setup or the open header
  editor only), because 2c reuses `1`–`5` on the board for the picker. The
  document listener reads that context through a ref and is installed once:
  re-subscribing per context change dropped the first keystroke after the
  editor opened, because effects flush a frame later than the click.
- 2c: both overlays are native `<dialog>` + `showModal()` (platform focus trap,
  inert background, Esc); reset keeps side and role and clears only the draft,
  as the design's own dialog copy promises; undo is one level, stored under
  `draft.backup`, dropped by the first draft action after a reset.
- 2c corrections found during apply: `apply` closed the undo window on the
  action's kind, so a refused ban dropped the backup — the decision now reads
  the reducer's result; Space on a grid tile was swallowed by the
  printable-key branch instead of pressing the tile; the post-pick focus
  redirect took the first removal control of a region, which after a fifth
  enemy pick is somebody else's hero. A planned `isUsed`/`usedAs` equality
  test was dropped: with `isUsed` defined as the wrapper it passes against any
  implementation.
- 2c: taken tiles use `aria-disabled`, not `disabled`, so the arrow keys keep
  the grid's geometry and a screen reader still reads them out. Only their
  artwork dims — fading the `ban`/`team`/`enemy` label with it would hide the
  one thing a taken tile says, which is where the mock is departed from.
- 2c: the picker grid is one tab stop with roving `tabIndex`, reversing
  design.md — the state that decision priced in turned out to be the `first`
  match the grid already computes.
- 2b corrections found during apply: the planned contrast-floor test for the
  tile ink guards nothing (with the softened ink pair the worst case is pinned
  at the threshold), so the suite guards the palette tokens parsing instead —
  superseded in Task 4, where pure inks gave the floor room to guard something
  and the test was written; and
  a tile carries an accessible name only where its row does not already name
  the hero, so a screen reader hears it once.

- Open against the design project: `guidelines/colors-hero-palette.html`
  (52 swatches) and `guidelines/component-hero-tile.html` (5) hardcode
  `#1b1d12`/`#f4f3fb` inline rather than referencing `--tile-ink-*`, so they
  show the superseded inks. Eight of them also show the wrong ink now, having
  been authored at threshold 0.22: batrider, clockwerk, magnus, mars, slark,
  spectre, storm-spirit, treant-protector all move light → dark. The fix is
  to reference the tokens instead of the hexes; the shortened swatch labels
  are hand-authored, so the pages cannot simply be regenerated.

## Gates (reminder)

- Before every PR: `/zombies` → fix → `/warm` (only when a manifest changed)
  → `/ponytail-review` → `/triage` → `/coderabbit-local` → push, in that
  order and all self-run; act on every finding, report what is skipped and
  why (docs/review-toolkit.md).
- `/zombies` also at propose, from the feature description.
- `/coderabbit` is the user's to invoke, whenever they choose.
- Commit per completed task-list item without being asked
