# Tasks — CodeRabbit config tuning

Requirement names are those in `specs/review-bot-config/spec.md`.

`/zombies` at propose returned no test ideas: the change is a config edit, and
the one failure worth catching — a mistyped key — needs the remote schema, so
it is verified as step 1.1 instead of by a test.

## 1. Verify every key path before writing it

- [x] 1.1 Fetch
      `https://storage.googleapis.com/coderabbit_public_assets/schema.v2.json`
      and confirm each of `reviews.pre_merge_checks.docstrings.mode`,
      `reviews.path_filters`, `reviews.tools.{biome,yamllint,actionlint}
      .enabled` and `knowledge_base.learnings.scope` exists with the value it
      is about to be given (*Docstring coverage does not apply here* → "The
      key paths are real")

## 2. Write the config

- [x] 2.1 Add `reviews.pre_merge_checks.docstrings.mode: "off"` with no
      `threshold` (*Docstring coverage does not apply here* → "The check is
      off, not loosened")
- [x] 2.2 Add `reviews.path_filters` with `!openspec/changes/archive/**`,
      `!src/fixtures/snapshot.json` and `!**/*.woff2` — and nothing broader
      (*Generated and settled paths are out of review scope*)
- [x] 2.3 Add `reviews.tools` disabling `biome`, `yamllint` and `actionlint`
      only (*The bot does not re-run this repo's own linters*)
- [x] 2.4 Add `knowledge_base.learnings.scope: "local"` (*Learnings are
      scoped by decision, not by visibility*)
- [x] 2.5 Leave `knowledge_base.code_guidelines.filePatterns` as it is, and
      add a comment saying why `docs/**/*.md` is not used (*Coding guidelines
      cover the indexed docs only*)
- [x] 2.6 Write the reason beside each switch: no docstring rule exists and a
      permanently amber check devalues its neighbours; each disabled tool
      names the gate that already runs it (*A disabled check carries its
      reason in the config*)
- [x] 2.7 Run `bun run lint:yaml` — it parses every `**/*.{yml,yaml}`
      including dotfiles, so it covers this file

## 3. Reconcile the repo

- [x] 3.1 Grep every site restating the review-bot configuration —
      `CLAUDE.md`, `docs/`, `README.md`, `PLAN.md` — and reconcile them (rule
      in `CLAUDE.md`)
- [x] 3.2 Update `PLAN.md`: queue entry, status, and the decisions this change
      settles

## 4. Review gates

- [x] 4.1 `/triage` over the final diff, per the `CLAUDE.md` rule that a
      branch of documentation, rules or config runs `/triage` alone plus the
      grep in 3.1 — `/zombies` diff mode, `/warm` and `/ponytail-review` do
      not apply to a YAML-only change
- [ ] 4.2 Open the PR from `chore/coderabbit-config` and say in the handover
      that the effect is observable only in the bot's own review on that PR —
      do not poll for it (rule in `CLAUDE.md`)
