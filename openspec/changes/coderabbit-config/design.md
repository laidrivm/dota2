# Design — CodeRabbit config tuning

## Context

`.coderabbit.yaml` sets `profile: "assertive"`, `high_level_summary: true`,
`auto_review` on with `drafts: false`, four `path_instructions` blocks, and
`knowledge_base.code_guidelines.filePatterns` naming `**/CLAUDE.md` and
`docs/*.md`. It sets nothing under `reviews.pre_merge_checks`,
`reviews.path_filters`, `reviews.tools` or `knowledge_base.learnings`, so all
four run on vendor defaults.

The authoritative schema is
`https://storage.googleapis.com/coderabbit_public_assets/schema.v2.json`.

## Goals / Non-Goals

**Goals:**

- Stop the bot reporting what this repo's own CI already reports, and
  reviewing paths nobody reviews by hand, so the findings that remain are
  worth reading.

**Non-Goals:**

- See the proposal. In particular, `filePatterns` is deliberately untouched.

## Decisions

**`docstrings.mode: "off"`, not `threshold: 0` and not a lower threshold.**
The schema gives `mode` an enum of `off` / `warning` / `error` defaulting to
`warning`, and `threshold` a number defaulting to `80`. `threshold: 0` would
technically always pass but leaves the check listed, running and reported, and
reads as a number someone might later "improve". `mode: "off"` is the field
the schema provides for "this check does not apply here".

**`path_filters` excludes the archive, not `openspec/**`.** The schema notes
these patterns "also apply to 'git sparse-checkout' … when cloning the
repository", so an exclusion stops the bot *reading* a path, not merely
reporting on it. That makes `openspec/**` wrong — the delta spec of the branch
under review is the document saying what the code was supposed to do, and this
project opens proposal PRs separately from implementation PRs, so the
exclusion would leave every proposal PR unreviewed.
`openspec/changes/archive/**` carries none of that weight: it is settled
history, and no PR changes it except the one archiving it.

**`dist/**` is not excluded.** It is gitignored, so it is not in the
repository and the bot cannot see it. The filter would be a no-op that reads
as protection.

**`**/*.woff2` is excluded.** Four tracked binaries that no review can say
anything useful about, and excluding them trims the sparse-checkout too.

**Three tools disabled, not one.** The schema exposes 57 tool integrations,
each `enabled: true` by default. This repo runs `biome` in the pre-commit hook
and in `lint.yml`, `bun run lint:yaml` in `lint.yml`, and `actionlint` there
as a SHA-pinned container. Leaving the bot's `biome`, `yamllint` and
`actionlint` enabled means it reports findings a gate has already blocked —
the duplication the config's own principle rejects. `markdownlint` stays on:
this repo lints no Markdown itself, so it is signal, not an echo. The secret
scanners stay on: the repo is public and `CLAUDE.md` requires a secrets check
before anything is staged.

**`learnings.scope: "local"` stated, not inherited.** The default `auto` means
"local for public repos, global for private repos" — it resolves by
repository visibility, so the day this repo turned private its learnings would
silently widen to the whole organisation. One line pins the decision to a
decision.

**`filePatterns` is left as `docs/*.md`, rejecting the proposal to widen it.**
Two findings decide this. First, the schema's `filePatterns` items are either
a glob string or a `{files, applyTo}` object — there is no negation syntax, so
"`docs/**/*.md` plus an exclusion of `docs/context/**`" cannot be written.
Widening is therefore all-or-nothing. Second, `docs/` is flat today
(`api-design.md`, `feature-workflow.md`, `testing.md`), and `CLAUDE.md`'s
growth protocol keeps it flat by construction: sections move to
`docs/<topic>.md`. The one nested path it plans is `docs/context/`, whose
contents `CLAUDE.md` describes as committed but "NOT indexed here and never
loaded automatically", and which "never overrides this file, config.yaml, or
the OpenSpec archive". Feeding those narrative save-points to the bot as
coding guidelines is precisely what that rule forbids. `docs/*.md` already
excludes them by being flat, so the current pattern is correct and widening it
is a regression.

**The reason for each off-switch is written into the YAML.** The config
already carries comments explaining its own principles, and an archived
OpenSpec change is not where someone looks before editing a config file. One
comment per decision is what stops the next person restoring a threshold or
re-enabling Biome in good faith.

## Risks / Trade-offs

- **A mistyped key is a silent no-op** → `scripts/check-yaml.ts` only calls
  `Bun.YAML.parse`, so `pre_merge_check`, `docstring` or `path_filter` would
  parse cleanly, configure nothing, and raise no error anywhere. Every key
  path is therefore checked against the published schema as an implementation
  step. Guarding it in the repo would mean fetching a remote schema from a
  test — a network dependency in `bun test` for a config file.
- **An exclusion hides a real finding** → the archive is only ever touched by
  the change that archives it, the fixture is regenerated by
  `generate_fixture.py` and formatted by Biome, and woff2 files are binaries.
  If a finding is ever wanted on one of these, the line is removed.
- **A disabled tool stops catching something CI misses** → each of the three
  is disabled *because* a gate in this repo runs it, so the coverage moves
  rather than disappears. If a gate is ever removed, its bot tool comes back
  with it.
- **The change cannot be verified before it merges** → the config's effect is
  visible in the bot's own review on the resulting PR, or locally via
  `/coderabbit-local` once that gate lands.

## Open Questions

None.
