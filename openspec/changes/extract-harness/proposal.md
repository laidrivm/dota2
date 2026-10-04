# extract-harness

## Why

The agent scaffolding was built inside d2ass and is about to serve two more
projects, `mellon` and `laidrivm.com`. Today none of it can reach them. The
rules sit in d2ass's `CLAUDE.md` and `docs/`, the hook and the gates in its
`scripts/` and `checks/`, and nine of its thirty capabilities, with parts of
two more, describe the scaffolding rather than the product. The skills reach d2ass only through
gitignored symlinks into a working tree, so a clone, CI and the review bot see
none of them, and a commit hash typed into a table stands in for a pin.

## What Changes

- **BREAKING (repository):** `laidrivm/skills` is renamed `laidrivm/harness`
  and becomes the scaffolding's home. It is laid out as `core/` (anything any
  project can use: rules, workflow docs, the task-board protocol, the skills)
  and `bun/` (anything that assumes Bun and TypeScript: the command guard, the
  gates, the scanner, the board-state derivation). It ships as a package with
  no lifecycle scripts. `link.sh` is retired once no project links through it.
- **BREAKING (agent workflow):** d2ass consumes the harness as one dependency
  pinned to a commit in `bun.lock`. The skills, the hook and the gates all
  resolve from that pin, in a session, in CI and in a fresh clone after
  `bun install`. The `Provenance` table and the check pinning it are deleted,
  because the lockfile is the pin.
- The harness rules and docs are also kept as a tracked copy in d2ass's flat
  `harness/` directory, `CLAUDE.md` importing `harness/rules.md`, and a check fails when the copy differs from the
  pinned package. The review bot reads files of this repository only, so a
  copy is how it keeps quoting a harness rule, and a pin bump then shows
  which rules changed.
- d2ass keeps what is about d2ass: the product overview, the `Code` rules about
  its application, `openspec/config.yaml`'s `context:`, `.coderabbit.yaml`,
  its product capabilities, and the values its gates are run with (what is
  mutated and the floor, which root files are allowed, the suppression
  allowlist). The scripts that read those values move; the values do not.
- Every harness artefact moves except the archive: the nine capabilities below
  and parts of two more, `docs/` other than d2ass's own, the scripts and checks
  of the scaffolding, and the active changes that modify a capability that
  moves. `glob-row-example`, which modifies only `repo-onboarding`, stays, and
  its card moves from `Harness` to `D2ASS`.
  The archive stays as the record of what was decided here.
- The `Harness` board's cards point into the harness repository once it holds
  their changes.
- Session memory is redistributed (outside this repository, listed under
  Impact): lessons about working with the user go to the user-level
  `~/.claude/CLAUDE.md`, process lessons become harness rules, lessons a rule
  already states are deleted, and the one d2ass mechanic worth keeping goes to
  `docs/testing.md`.
- Strictness stays as it is in d2ass, and it is the same for every consumer.
  No gate gains an option to be switched off.

## Capabilities

### New Capabilities

- `harness-consumption`: how this repository takes the harness in: one pinned
  dependency, what resolves from it, what stays a value d2ass owns, and how a
  clone that has not installed yet is not locked out.

### Modified Capabilities

- `repo-onboarding`: a clone obtains the skills by installing dependencies,
  not by running a linker from another checkout, and the README links the
  harness repository where it linked the skills repository.
- `mutation-floor`: the floor check and the exemption form move to the
  harness. What d2ass mutates stays here.
- `repo-layout`: the root-resolution requirement moves to the harness with the
  checks that rely on it. The root exemptions and the README section stay.
- `review-bot-config`: the bot reads the harness rules from their tracked copy
  and quotes them as it quotes `CLAUDE.md`'s.
- Moved whole to the harness, every requirement removed here:
  `agent-permissions`, `agent-rulebook`, `change-slicing`, `commit-gates`,
  `context-budget`, `local-review-loop`, `skill-provenance`,
  `spec-test-traceability`, `task-board`. `skill-provenance` is not
  re-created there: the lockfile replaces it.

## Non-goals

- Onboarding `mellon` and `laidrivm.com`, and creating their boards. Each is
  its own change in its own repository, once this one has shipped the package
  they install.
- A configuration surface for strictness. The values a gate reads are data
  each project must have anyway; switching a gate off is not one of them.
  That waits for a project that needs it.
- A Claude Code plugin. It cannot ship permission rules or always-on
  instructions, and its marketplace pins by tag rather than commit. It is
  reconsidered when a consumer is not on Bun, which is also when `bun/` would
  split into its own repository.
- Sharing `.coderabbit.yaml`. Its path filters and instructions are about
  d2ass's tree.
- Rewriting the moved capabilities in the harness. They arrive as they are and
  are re-worded for a consumer by changes made there.
- Editing the archive or `docs/context/`.

## Impact

- **New repository layout:** `laidrivm/harness` (renamed from `laidrivm/skills`,
  whose URL GitHub redirects): `core/`, `bun/`, `package.json`, `openspec/`.
- **d2ass, removed:** the harness scripts and their tests under `scripts/` and
  `checks/`, the docs that move, the specs and active changes that move, the
  `Provenance` table.
- **d2ass, added:** the tracked copy of the harness rules and docs.
- **d2ass, edited:** `CLAUDE.md` (reduced to d2ass's own and an import of the
  harness rules' copy), `package.json` and `bun.lock` (the dependency and the script
  entries), `.claude/settings.json` (the hook's path), `.gitignore` and
  `.claude/skills/` (tracked links in place of ignored ones), `.github/workflows/`,
  `README.md`, `.coderabbit.yaml` (where its guidelines are read from).
- **Boards:** `Harness` cards re-pointed; one card moved to `D2ASS`.
- **Outside any repository:** `~/.claude/CLAUDE.md` created, and the d2ass
  memory directory pruned to what is routed nowhere else. The routing:

  | Memory | Goes to |
  |---|---|
  | `user-language-and-style`, `a-count-is-not-a-report`, `an-accepted-risk-is-named-once`, `ask-where-a-visualisation-lands`, `defect-first-then-the-map`, `explain-the-mechanic-inside-the-question`, `paste-safe-commands`, `agent-spawning-probes-go-to-the-user`, `mcp-server-needs-a-new-session` | `~/.claude/CLAUDE.md` |
  | `fix-where-ci-caught-it`, `read-the-artefact-a-design-describes`, `non-interactive-path-first`, `notion-500-reconnect` | harness rules |
  | `commit-trailer-overrides-harness`, `announced-gates-are-obligations`, `a-skill-report-is-mine-to-process`, `review-finding-approval-direction`, `new-rules-bind-my-own-artefacts`, `skills-list-is-not-the-roster` | deleted, a moved doc or rule already states each |
  | `d2ass-e2e-probe-mechanics` | `docs/testing.md` §E2E |
  | `d2ass-vps-access` | stays in memory: it names a host this public tree must not |

- **Dependencies:** one added, the harness itself, from GitHub at a commit.
- **Runtime:** nothing the app serves changes.
- **Card:** `Harness`.
