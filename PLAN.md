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
      `.claude/settings.json`, `ask` reduced to bun's two install commands,
      pinned by `agent-permissions.test.ts` (4 tests; the deny-list assertion
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
- [ ] **3a. `agent-permissions-gaps`** — proposed (stage 1 complete,
      `openspec/changes/agent-permissions-gaps`, validates). CodeRabbit's three
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
      Next: branch `fix/agent-permissions-gaps`, `/clear`, `/opsx:apply`.
- [ ] **4. `readme-drift`** — proposed (stage 1 complete,
      `openspec/changes/readme-drift`, validates). `README.md` calls the
      skills repo private; it is public. Drops the claim rather than
      correcting it, adds the `link.sh` instructions a clone needs, adds
      `.claude/settings.json` and `.coderabbit.yaml` to the ownership map,
      and pins the map's paths with a test. Next: branch `fix/readme-drift`,
      `/clear`, `/opsx:apply`.
- [ ] **Task 7** — Docker + VPS deploy (open decisions: registry
      GHCR/Docker Hub, same VPS or a new one)
- [ ] **Phase 3** — OpenSpec: STRATZ → Postgres → snapshot bundle pipeline
      (blockers: API key, pick-phase granularity in STRATZ)
- [ ] **Task 5** — error tracking (precondition: product is deployed)

## Accepted decisions

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
  clone.
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
  so being wrong costs a `git checkout`. `/coderabbit` stays the user's
  because its cost is the wait for the PR bot, which a synchronous CLI review
  does not have.
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
