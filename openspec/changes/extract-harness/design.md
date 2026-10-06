# extract-harness — design

## Context

See `proposal.md` for why. What shapes the approach:

- The scaffolding is spread across `CLAUDE.md`, eight indexed docs,
  `.claude/settings.json`, about 8,000 lines of `scripts/` and `checks/`, CI
  workflows, `.coderabbit.yaml`, and ten whole capabilities plus part of
  one more. Its skills already live in `laidrivm/skills`, reached through
  gitignored symlinks into a sibling working tree.
- All three consumers run Bun and TypeScript. Linters differ: d2ass and
  `mellon` use Biome, `laidrivm.com` ESLint and Prettier.
- Every repository involved is public. The boards are private.
- Measured against the documentation (code.claude.com plugins, hooks and
  memory pages) during the explore session: a plugin cannot ship permission
  rules or always-on instructions, and its marketplace source takes a `ref`
  but no `sha`. A `CLAUDE.md` `@path` import may resolve into a gitignored
  directory, takes no approval when the target is inside the project, and
  follows at most four hops. A skill directory reached through a symlink is
  undocumented but observed working: d2ass's eleven skills are loaded today
  through exactly such links.
- CodeRabbit reads guidelines from files of the repository under review, and
  `node_modules/` is never part of that.
- OpenSpec 1.14 retires a capability whose every requirement a delta removes,
  deleting its main spec, only when `.openspec.yaml` sets
  `retire_capabilities: true`. Without the marker the archive refuses with
  `Spec must have at least one requirement`.

## Goals / Non-Goals

**Goals:**

- One commit of the harness governs a session, a hook, CI and the review bot
  at once, and moving it is one reviewed diff.
- d2ass keeps working between any two steps, whichever repository the step
  lands in.
- What moves arrives verbatim, so a reviewer of a moving step reads a rename,
  not a rewrite.

**Non-Goals:**

- Re-wording the moved capabilities, docs and changes for a generic consumer.
  They keep naming d2ass where they did; changes in the harness repository
  re-word them.
- Preparing `mellon` or `laidrivm.com`. Their onboarding changes need this one
  shipped, not anything extra inside it.

## Decisions

### D1. One repository, two layers, renamed in place

`laidrivm/skills` is renamed `laidrivm/harness`. GitHub redirects the old URL,
so links in the archive keep resolving. The layout:

```text
harness/
  package.json        name "harness", no scripts, no dependencies of its own
  core/
    rules.md          the loop, the quality bar, Process and Safety rules,
                      the Code rules that name nothing only d2ass has
    <doc>.md          verification, git-and-prs, review-toolkit,
                      feature-workflow, rulebook-growth, code-style,
                      api-design, testing (the parts true of any project),
                      flat beside rules.md as the consumer's copy holds
                      them, so a link between the two resolves in both
    skills/<name>/    every skill, as today
  bun/                command-guard, command-parse, scan, diff-budget,
                      file-size, no-suppressions, manifest-ranges,
                      spec-coverage, spec-criteria, mutation-floor,
                      repo-layout, board-state, check-yaml, root,
                      sync, check (the consumer entry point), and their tests
  openspec/           the moved specs and changes
  CLAUDE.md           the harness's own: imports core/rules.md
```

*Alternative:* a separate repository for `bun/`. Rejected for now. Every
consumer is on Bun and takes both layers, so a second repository would add a
second pin that has to be kept in step with the first. The split is made when
a consumer is not on Bun.

### D2. Delivered as a Git dependency pinned to a commit

d2ass adds `"harness": "github:laidrivm/harness#<40-hex>"`. `bun.lock` records
the commit, so the pin cannot move under a session. `bun install` places the
package at `node_modules/harness/`, where the hook, the gates, CI and the skill
links all read it.

*Alternatives:*

- **Plugin and marketplace.** These cover skills and hooks natively, but not
  permissions or always-on rules. The marketplace pins by tag only, CI would
  need a second delivery path, and every skill would be renamed `harness:<name>`
  in the gate lines, docs and permission entries.
- **Submodule.** Pins a commit and CI sees it. But it needs
  `--recurse-submodules` in every checkout, and it is a second mechanism next
  to the package manager that every consumer already runs.
- **Reusable workflows at a tag.** These cover CI only.

The package declares no lifecycle scripts, so it needs no `trustedDependencies`
entry. `bun add` stays under the `ask` permission, as every manifest mutation
does.

### D3. The rules reach the session and the bot through a tracked copy

`bun node_modules/harness/bun/sync.ts` writes `core/rules.md` and the docs
beside it in `core/`, laid out as they lie, into a tracked `harness/`
directory at d2ass's root. `CLAUDE.md` opens
with `@harness/rules.md` and links the docs at `harness/<doc>.md`. The
consumer check compares the copy with the installed package byte for byte.

A copy because CodeRabbit can read no other file: its guidelines would
otherwise lose every harness rule, and quoting the violated rule is its part
in fix and capture. The copy also earns two other things. A clone reads the
rules before `bun install`, and a pin bump's diff shows exactly which rules
changed. That diff is the one place a harness rule change is reviewed from the
consumer's side.

*Alternative:* `@node_modules/harness/core/rules.md`. Rejected because the bot
loses the rules, as above.

### D4. A gate's values live in `package.json`

Each gate reads its d2ass values from a `"harness"` key in `package.json`:

```json
"harness": {
  "mutationFloor": { "module": "src/model.ts", "surviving": 0 },
  "rootFiles": ["…the list repo-layout.ts carries today, with reasons…"],
  "suppressions": ["…the allowlist no-suppressions.ts carries today…"],
  "diffBudgetExclude": ["bun.lock", "*.woff2", "src/fixtures/snapshot.json"]
}
```

`package.json` rather than a new root file. It is already tracked and already
exempted at the root, and every gate already reads it. Stryker keeps reading
`stryker.config.json`, which is Stryker's own. Where a value carried its
reason as a comment, the reason becomes a sibling string (`"why"`), because
JSON takes no comments.

The values are moved, not given defaults. A gate that finds its key absent
fails and names the key. A default would make a forgotten value read as a
decision.

### D5. One consumer entry point for the checks

`bun test` does not collect tests under `node_modules/`, so the harness's own
tests never run in d2ass, which is correct: they run in the harness's CI. What
d2ass runs is `bun node_modules/harness/bun/check.ts` (`bun run harness:check`).
It runs every check over the consumer's tree: the pin, the skill links, the
copy, the settings policy, workflows with no second checkout, the root
exemptions, suppressions, the per-file cap and the spec-citation floor. The
pre-push hook and `lint.yml` call it where they call those checks today.

`spec-coverage` stops shipping as a `bun test` case and becomes one of these
checks. What its header gave as the reason for being a test, that CI already
runs `bun test`, is just as true of `harness:check` once `lint.yml` calls it.

### D6. The hook boots without the package

The `PreToolUse` command in `.claude/settings.json` becomes:

```sh
g="$CLAUDE_PROJECT_DIR/node_modules/harness/bun/command-guard.ts"
[ -f "$g" ] && exec bun "$g"
bun -e '<read stdin; allow "bun install" / "bun i", bare or with --frozen-lockfile only; else print the hint and exit 2>'
```

The fallback is inline because the harness cannot ship it: it runs when the
harness is not installed. It is the one piece of harness behaviour every
consumer carries as text, so the moved `agent-permissions` check asserts that
text exactly. A consumer whose copy drifts then fails that check instead of
booting differently.

### D7. Skills are tracked links into the package

`.claude/skills/<name>` becomes a tracked relative link to
`../../node_modules/harness/core/skills/<name>`, for the same eleven skills
linked today, and `.claude/skills/` leaves `.gitignore`. A link dangles until
`bun install`, which is the first step of every clone and CI job anyway.
`link.sh` is deleted once d2ass stops using it. `mellon` and `laidrivm.com`
link nothing today.

### D8. The partition rule

A line of a rule, a doc or a spec stays in d2ass when it names something only
d2ass has: its application modules, its data sources, its deployment host, its
product. Everything else moves. Applied to `CLAUDE.md`'s `Code` list, these
stay: the reducer side effect, the first enabled candidate, focus restore, the
document-listener ref, `Math.fround` and the sentinel ranges. The scanner,
test-hook, `fileURLToPath` and prose-wrap rules move. `docs/testing.md` splits
the same way. Its d2ass parts (the mutation floor, the e2e mechanics) stay in
a d2ass `docs/testing.md`, and the rest moves.

Where a moved doc illustrates with a d2ass example (*Proposal 2b shipped a
native `<select>`*), the example moves with it unchanged, per the second goal.

### D9. Specs leave by archive; changes leave by deletion

Specs are not edited by hand. The capabilities that move are removed by this
change's REMOVED deltas when it is archived, and `retire_capabilities: true`
deletes the ten emptied main specs. The harness repository receives verbatim
copies in a step before that, so for a while both repositories hold them.
The harness copy is the one that changes.

The active changes that move (`gh-api-guard`, `merged-branch-guard`,
`pre-pr-sequence-gate`, `scan-lift`, `tracked-file-sweep`,
`drop-mutation-exemptions`, `bun-version-sites`) are copied with their
`.openspec.yaml` and deleted here in the same step. A change is not a spec, and
nothing else archives it. `glob-row-example` modifies only `repo-onboarding`
and stays.

A moved change's task that edits a file staying in d2ass is carried out in
d2ass, in the pull request that bumps the pin to the commit implementing the
rest of that change.

### D10. Boards follow the trees

`Pointer` is repository-relative, so a moved change's card keeps its value. It
now resolves in the harness repository, which is the board's tree under the
routing rule. Only `glob-row-example`'s card moves, from `Harness` to `D2ASS`.
`scripts/board-state.ts` runs in each repository over its own tree, deriving
`D2ASS` here and `Harness` there.

### D11. Steps alternate repositories

Each d2ass step pins the harness commit the step before it merged:

```text
 1  harness  rename, core/skills/, package.json; link.sh re-pointed
 2  d2ass    the pin, and the manifest check that admits it
 3  d2ass    tracked skill links, README and its map, Provenance removed
 4  harness  bun/ gates reading consumer values, check.ts, bootstrap; link.sh gone
 5  d2ass    hook switched to the package, with the inline bootstrap
 6  d2ass    gates, CI and pre-push switched; values into package.json
 7  d2ass    the skill links' contract
 8  harness  core/rules.md and the docs beside it, sync.ts, the harness's own CLAUDE.md
 9  d2ass    harness/ copy, CLAUDE.md reduced, docs removed
10  d2ass    .coderabbit.yaml reads the copy; no second checkout
11  harness  openspec/ with the moved specs and changes
12  d2ass    moved changes deleted, card moved
```

The d2ass steps are cut at one to three criteria each, which is why the
links' contract (7) and the bot (10) are steps of their own. Steps 5, 6
and 9 delete moved code. Its lines are counted by the diff budget and nobody
reads them, so those pull requests carry
`oversize: deletes code moved verbatim to laidrivm/harness@<sha>` where they
cross 800.

## Risks / Trade-offs

- **[Risk]** A moved change is applied here before step 9 and adds requirements
  the REMOVED deltas do not list, which leaves a requirement stranded at
  archive. → **Mitigation:** before archive, re-read every moving capability's
  live requirement list and bring the REMOVED deltas level through
  `/opsx:update`.
- **[Risk]** A spec has prose outside its requirement statements and scenario
  bullets, which OpenSpec's retirement audit reports as content the merge
  cannot name, and the archive refuses. `task-board` carries such paragraphs.
  → **Mitigation:** run the archive's sync preview before archiving. Where it
  refuses, fold the stray paragraph into its requirement in the harness copy
  first. The d2ass copy is then deleted whole.
- **[Risk]** The bootstrap hook is text in every consumer and drifts. →
  **Mitigation:** D6. The moved permission check asserts it exactly.
- **[Risk]** Always-on cost grows unseen. `retire-plan-md` budgets `CLAUDE.md`
  alone, but a session now also reads `harness/rules.md`. → **Mitigation:**
  the rulebook check, now in the harness, measures `CLAUDE.md` plus what it
  imports. Re-wording `context-budget` for an import is the harness's first
  change after this one.
- **[Trade-off]** The harness's rules exist twice in every consumer, in the
  package and in the copy. The check makes the copy a cache with a validator
  rather than a fork.
- **[Trade-off]** A dangling link is visible in a fresh clone until
  `bun install`. The README says so, per `repo-onboarding`.

## Migration Plan

The twelve steps in D11, each a pull request. A d2ass step depends only on harness
commits already merged, so any step can be reverted alone. Reverting a d2ass
step restores its files from `main` and keeps the older pin. Reverting a
harness step is invisible to d2ass until d2ass bumps the pin.
