# CodeRabbit config tuning

## Why

`.coderabbit.yaml` is deliberately thin, and its own opening comment sets the
principle: review rules live in `CLAUDE.md` and the docs it indexes, and the
config only tunes behaviour and "adds checks an automated scanner can't do".
Four settings currently run on the vendor's defaults in ways that contradict
that principle.

The docstring coverage pre-merge check has already fired on a config file and
a spec file, neither of which can carry a docstring. This project has no
docstring rule — neither `CLAUDE.md` nor the docs it indexes require one, and
no linter checks for one. A permanently amber check is worse than an absent
one: this repo is assembling checks it means to take seriously, and one
decorative entry teaches the eye to skim the whole list.

That incident is also the argument for the other three. The check ran on files
nobody reviews by hand, because `reviews.path_filters` is empty and every path
is in scope. On `profile: "assertive"`, an archived OpenSpec change and a
generated fixture are pure noise. Meanwhile `reviews.tools` leaves all 57
integrations enabled, three of which re-run linters this repo already runs in
`lint.yml` and in the pre-commit hook — so the bot reports exactly what the
config's own principle asks it not to. And `knowledge_base.learnings.scope`
defaults to `auto`, which resolves by repository visibility rather than by
decision.

## What Changes

- Add `reviews.pre_merge_checks.docstrings.mode: "off"`, with the reason
  written beside the key so nobody "fixes" it by restoring a threshold.
- Add `reviews.path_filters` excluding `openspec/changes/archive/**`,
  `src/fixtures/snapshot.json` and `**/*.woff2`.
- Add `reviews.tools` disabling `biome`, `yamllint` and `actionlint` — each
  already runs in this repo's own CI.
- Set `knowledge_base.learnings.scope: "local"` explicitly.
- Leave `knowledge_base.code_guidelines.filePatterns` unchanged. See design:
  widening it would pull in the one thing `CLAUDE.md` says must never be
  loaded automatically.

## Capabilities

### New Capabilities

- `review-bot-config`: which of CodeRabbit's checks, tools and paths this
  repository has decided apply to it, and on what grounds a check is switched
  off rather than loosened.

### Modified Capabilities

None.

## Non-goals

- **Lowering the docstring threshold instead.** `threshold: 33` leaves the
  same permanently amber check, which is the defect. Off or meaningful,
  nothing between.
- **Adding a docstring rule to `CLAUDE.md` so the check has something to
  enforce.** Inventing a rule to justify a vendor default inverts the order.
- **Excluding `dist/**`.** It is gitignored, so the bot never sees it and the
  filter would be a no-op.
- **Excluding `openspec/**` wholesale.** `path_filters` also drive the bot's
  git sparse-checkout, so that would stop it reading the delta spec of the
  branch under review. Only the archive is excluded.
- **Disabling the remaining tools**, including `markdownlint` and the secret
  scanners. This repo lints no Markdown of its own and is public; both add
  signal rather than duplicate it.
- **The other `pre_merge_checks` entries** — `title`, `description`,
  `issue_assessment`, `custom_checks`. None has misfired; each is its own
  decision.

## Impact

- `.coderabbit.yaml` — the only file changed.
- No code, no dependency, no CI workflow, no product behaviour.
- Nothing to verify locally: the effect appears in the bot's next review, or
  in the next `/coderabbit-local` run once that gate lands.
