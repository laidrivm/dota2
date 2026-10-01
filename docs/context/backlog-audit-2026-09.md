# Backlog audit — an older proposal list re-checked against the tree

A list of items drafted in an earlier `/opsx:propose` session was re-read
against this repository on 2026-09-30, to separate what had since shipped from
what is still open. No code changed. Nine cards were drafted from the result
and **not written** — the Notion connector dropped mid-session. Their prose sat
at `harness-cards.md` in that session's scratchpad, which is session-local and
should be assumed gone; every card is re-derivable from §*Open* below.

Board and view URLs are deliberately absent: `openspec/specs/task-board/`
fixes that a board is named, never linked, this repository being public.

## Settled — shipped, do not re-raise

- **Curating permissions** — `openspec/changes/archive/2026-08-09-tracked-permission-policy/`.
  `.claude/settings.json` is tracked and carries 8 `deny`, 16 `ask`, ~60 `allow`.
- **Hooks for the prohibitions `CLAUDE.md` states in prose** —
  `openspec/changes/archive/2026-08-01-mechanised-prohibitions/` plus
  `scripts/command-guard.ts`, registered as a `PreToolUse` matcher on `Bash`.
- **The review skills being unreachable in a clone** — `README.md`
  §*Getting the review skills* gives `./link.sh all <path-to-d2ass>`, run from
  the skills repository. The gate is passable by a fresh clone.
- **Docker on a VPS** (the old "Task 7") —
  `openspec/changes/archive/2026-08-27-deploy-pipeline/`,
  `.github/workflows/deploy.yml`, `docker-compose.yml`.
- **This repository's half of the vendored-skill reconciliation** —
  `openspec/changes/archive/2026-08-01-skill-provenance/`: the Provenance table
  in `docs/review-toolkit.md` §*Provenance*, plus the `CLAUDE.md` Safety rule
  requiring `allowed-tools` and `disable-model-invocation` to be reconciled
  before a skill is used.
- **A skill composing the PR title and body** — `pr-brief` exists in the
  skills repository (101 lines).
- **A skill driving push → review → fix → merge → back to base** — `ship`
  exists there too (123 lines).

## Ruled out — settled negatives

- **`.claude/agents/`** — no repeating role a project subagent would take has
  appeared in the two months since the idea was raised. Dropped on the
  ladder's first rung rather than deferred.
- **`ship`'s `allowed-tools` as a policy conflict** — it is not one. Its
  `Bash(gh pr:*)` grant is already answered by the tracked `deny` entries for
  `gh pr comment`, `gh pr review` and `gh issue comment`, and by
  `scripts/command-guard.ts:122`'s `GH_WRITES`. Deny is evaluated before allow and
  merges across scopes. This was asserted as a conflict earlier in the session
  and withdrawn on checking; the real conflicts are in §*Open* item 1.
- **A Sentry MCP connector as an argument when choosing a tracker** — no such
  connector is in the session's tool roster, and the user confirms Sentry is
  connected to the project in no form at all. Any note resting on its presence
  is void.
- **Deriving the five hand-moved board statuses** — measured and refused
  already; `openspec/specs/task-board/spec.md` records that a branch-name
  derivation gets fourteen of thirty archived changes wrong.
- **ESON and honey** — weighed in the same earlier session as rtk: ESON a
  format for passing context between agents, honey a cap on generation
  volume. Both optimise token cost, and none of the problems on the list at
  the time — unreadable diffs, 700-line files, unverifiable gates, tests that
  would pass against a broken implementation — is a cost problem. "Not
  instead", not adopted, and not carded; reopen only on a question that is
  about cost. (Recorded 2026-10-01; neither had been written down before.)
- **Symlinking `AGENTS.md` to `CLAUDE.md`** — answered from Claude Code's
  memory documentation on 2026-10-01: with a `CLAUDE.md` present, Claude Code
  reads `CLAUDE.md` only by default, and even its read-both mode skips an
  `AGENTS.md` it has already loaded through a symlink or an import — so the
  feared double load does not happen. Dropped anyway: no agent the user runs
  reads `AGENTS.md`, so the link would serve nobody.

## Open — one heading per card that was to be written

Board is `Harness` unless stated. Status `suggested` unless stated. Every one
has an empty `Pointer`; none has a directory yet.

### 1. `ship` and `pr-brief` exist upstream and no gate here names them

Neither is symlinked into `.claude/skills/`, named in
`docs/review-toolkit.md` §*The pre-PR sequence*, or given a Provenance row.
`pr-brief` carries no conflict — it is `docs/git-and-prs.md`'s
PR-description bullet mechanised, and its `disable-model-invocation: true`
already matches how this project reserves a skill for the user.

`ship` carries two, both latent — the user has only ever run
`/coderabbit-local`, and has always invoked `/coderabbit` by hand:

- Its step 4 waits for CodeRabbit on the pushed SHA in a `sleep 30` loop for
  up to nine minutes. `docs/review-toolkit.md` forbids exactly that of
  `/coderabbit` ("do not poll the checks, do not sleep on a timer"), and
  `docs/git-and-prs.md` forbids it generally ("Never wait on a result someone
  else produces"). Card 8 is the third way out.
- It invokes `/coderabbit` through `Skill`, which this project reserves for
  the user.

### 2. The Provenance rows have aged behind the skills repository

Recorded: `coderabbit` at `9adc5c6`, `coderabbit-local` at `759f15e`.
Measured against the skills repository at `0118eb4`: `coderabbit/SKILL.md`
has gained 18 lines over `11ebfa9` (a review whose inline section is empty
while findings exist outside the diff) and `0118eb4` (never buffering the
`--agent` stream; a gate line for a hung review); `coderabbit-local/SKILL.md`
has gained 3 lines at `0118eb4`. Frontmatter of both is byte-identical to the
recorded commits, so the Safety-rule reconciliation is clean — what may have
moved is the contract the toolkit's own bullets describe.

### 3. Re-vendoring never reconciles frontmatter against the consuming project

The skills repository's `README.md` §*Skill provenance* gives the procedure as
`npx -y skills add …` plus a manual move, with `skills-lock.json`'s
`computedHash` as the drift detector. That catches an *edited* vendored skill.
It says nothing about an untouched skill whose frontmatter contradicts the
project it lands in. This repository's half is already a `CLAUDE.md` Safety
rule; the skills repository's half is a drafted paragraph nobody has applied.
Work does not land in this tree, and the procedure begins with a command this
project denies.

Adjacent to, not the same as, the standing `suggested` card **The
`skills-lock.json` patch `skill-provenance` drafted** — that one is a `ref`
needing an upstream commit.

### 4. `settings.local.json` re-accumulates what the tracked policy stopped

42 `allow` entries have grown back since
`2026-08-09-tracked-permission-policy` moved the stable set into
`.claude/settings.json`. Nothing measures it:
`checks/agent-permissions.fixture.ts:18` reads the tracked settings only and
says so in a comment (`:15`), guarding against a check passing on a stale or
local slice.
Three kinds are in it — stable grants that belong in the tracked file
(`git diff`, `git push`, `git checkout`, `git pull`, `git symbolic-ref`,
`gh pr`, `docker buildx`); one-offs that belong nowhere
(`echo "--- exit=$? ---"`, `xargs -I{} echo "manifests changed: {}"`,
`col -b`, `sort -t: -k2 -rn`, `set -e`, `kill %1`, a `grep -E` over a woff2
path); and one stale as well as local, `Bash(bash scripts/diff-budget.sh)`,
where the gate is invoked as `bun run diff-budget`. The decision the card
carries: whether the fixture gains a second reader for the local file, or the
sweep becomes its own check. `/fewer-permission-prompts` does the first half;
what is missing is whatever makes it recur.

### 5. `bunfig.toml` owns the dependency-policy values and the map does not say so

`bunfig.toml` `[install]` fixes `exact = true`,
`minimumReleaseAge = 259200` and an empty `minimumReleaseAgeExcludes`, each
with its reason in a comment. `README.md`'s knowledge ownership map has no
`bunfig.toml` row, so no file is named as owner; and `README.md`
§*Dependency hygiene* restates one of them in prose ("only versions at least
3 days old resolve"), against the `CLAUDE.md` Process rule "Cite the
requirement that fixes a value; never restate the value in another
requirement". Two edits: a row in the map, and README's number replaced by a
citation of it.

The four other sites naming these values are legitimate and stay —
`checks/agent-permissions-allow.test.ts:88` pins `259200` because pinning is
what a check is for; `openspec/specs/agent-permissions/spec.md` holds the keys
as criteria; `scripts/manifest-ranges.ts:4` cites the policy without the number;
`PLAN.md` cites `exact = true` for the `overrides` constraint.

### 6. A conversation rule sits in `openspec/config.yaml`'s artefact-form list

`openspec/config.yaml:25`, under `rules: proposal:`, holds "When gathering
requirements, ask questions one at a time". `docs/feature-workflow.md`
§*Stage 4* fixes that the field "owns the form of the change artefacts
themselves and may not restate what those files already say" — and this is the
only bullet under `proposal:` that is about conducting a conversation rather
than about a document's shape. Nothing has been observed to go wrong, which is
what makes it small: the field is read at artefact generation and the rule
applies at proposal time, so the two overlap.

Must not be merged with the standing `suggested` card **A captured rule is
sent to the costliest of its two homes** — that is the same question in the
other direction, which of `CLAUDE.md` and `docs/*.md` receives a captured rule.

### 7. Decide whether rtk earns its place — survey first

Status `exploring`. The precondition an earlier session set is now met: it
said to put the diff-size gate in before rtk and never instead of it, because
a 3000-line diff is pain that should push a PR to be re-cut and a compressor
that makes it tolerable removes the pressure without removing the problem.
`scripts/diff-budget.sh`, `.github/workflows/diff-budget.yml` and step 1 of
the pre-PR sequence are all in place.

Two local facts bound the value: every review gate starts from
`git diff <base>...HEAD` and `bun run diff-budget` measures that same diff, so
a lossy compressor in front of them changes what the reviewer reads with no
signal that it did; and a global hook intercepts `Bash` only, while the gate
skills grant themselves `Read`, `Grep` and `Glob`, so a material share of the
context never passes through the tool.

Two constraints already fixed: install via `brew`, never `curl … | sh`
(`CLAUDE.md` Safety); set `RTK_TELEMETRY_DISABLED=1` explicitly so the
decision is recorded rather than inherited from a default.

First step is a dated survey at `docs/research/rtk-<date>.md` covering
alternatives too, not a proposal — see §*Open questions*.

### 8. A review's arrival should be an event, not a wait — survey first

Status `exploring`. Both `docs/review-toolkit.md` and `docs/git-and-prs.md`
forbid holding a session open for a result somebody else produces, and both
are right about the cost. The consequence today is that `/coderabbit` is
reserved for the user and run by hand after the review lands, and that
`ship`'s loop cannot be used here (card 1). Never explored: making the
review's arrival trigger a session instead. A GitHub webhook on the review
comment, an `n8n` workflow, or something smaller needing no service. Scope
covers `/coderabbit-local` too — it is synchronous and so has no wait, but it
is the one actually used, and whatever is built must leave it alone.

### 9. Decide whether error tracking earns a tracker at all — survey first

Status `exploring`. Board `D2ASS`. `tasks/task-5.md`'s card already holds the
scope and the ponytail precondition (lay out what the platform gives natively
before proposing an SDK). What is new is that no tracker is connected in any
form. The question ahead of a proposal is whether error tracking is worth
anything yet, given what the VPS and the container already record and how few
errors a single-user deployment produces. If yes, this card becomes the
proposal for `tasks/task-5.md`; if no, it records why, so the task is not
re-opened from the same priors.

## Mechanics worth not re-deriving

- `checks/skill-provenance.test.ts` derives which skills owe a Provenance row
  from `docs/review-toolkit.md` §*The pre-PR sequence* (`:30`) and `CLAUDE.md`
  §*Rules* (`:40`), never from `.claude/skills/`. Adding a symlink obliges
  nothing; naming the skill in the doc is what makes the row mandatory.
- `checks/agent-permissions.fixture.ts:18` reads the tracked settings only, on
  purpose (`:15`). `.claude/settings.local.json` is measured by nothing.
- Both boards live under one parent page in the Notion workspace, each with a
  single saved `Board view` grouped by `Status` with empty groups hidden.
  Schema on both: `Name` (title), `Status` (select, the eight names
  `openspec/specs/task-board/` fixes), `Pointer` (text), `Assign` (person).
  Read through the view, never SQL — `PLAN.md`. As read on 2026-09-30:
  `D2ASS` 33 cards, `Harness` 43.

## Where we stopped

- **The cards are written** (2026-09-30, the following session, after the
  re-added connector's OAuth sign-in): items 1–8 are cards on `Harness` under
  the headings above, statuses as stated, `Pointer` read back as empty. Item 9
  is **not** a card of its own — one task has one card — its text was appended
  to the existing `D2ASS` card `tasks/task-5.md`, which moved to `exploring`.
  The rtk and webhook open questions below went into cards 7 and 8; the
  `AGENTS.md` one stays here, uncarded, as stated. Do not write these again.
- Three `/opsx:explore` runs were requested: cards 8, 9 and 7, in that order
  of preference — 8 first, because it is the one that unblocks card 1. **Card 8
  is explored** (2026-10-01): its findings are in its own card, now titled
  without "— survey first" and back at `suggested`, and its building work
  moved to two new `Harness` cards, *Agent identity — a GitHub App for d2ass*
  and *Orchestrator on a dedicated VPS*. **Card 9 is explored** too
  (2026-10-01): no error tracker; the `tasks/task-5.md` card becomes the
  proposal for a scheduled freshness probe of the public bundle, and three
  cards split out of it — two on `D2ASS`, one on `Harness`. **Card 7 is
  explored** as well (2026-10-01): the survey is
  `docs/research/rtk-2026-10-01.md`, verdict "not now"; its card keeps its
  status at the user's request, and one `Harness` card split out of it,
  *Wire TypeScript 7's own language server into sessions*. All three
  requested explores are done.

## Open questions

- ~~Does Claude Code's `AGENTS.md` support read that file in addition to
  `CLAUDE.md`?~~ **Answered 2026-10-01: no double load** — see §*Ruled out*,
  where the symlink idea is now dropped.
- ~~Can rtk's `exclude_commands` exclude `git diff` without also excluding
  `git status`?~~ **Answered 2026-10-01 from rtk's source: yes** — see
  `docs/research/rtk-2026-10-01.md`.
- ~~Can a webhook reach a local session at all?~~ **Made moot 2026-10-01:**
  the explore of card 8 moved the agent off this machine — the event starts
  a session on a dedicated host, recorded on *Orchestrator on a dedicated
  VPS*.
