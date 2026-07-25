# README drift

## Why

`README.md` calls the skills repository private. It is public —
`gh repo view laidrivm/skills` reports `"visibility":"PUBLIC"`. This is the
drift `CLAUDE.md`'s grep rule exists to prevent, and the rule did not fire,
because it triggers when *this* repo changes a rule or decision. Nothing here
changed: a fact about another repository did. A rule that only fires on local
edits cannot catch a claim about somewhere else going stale.

The same row hides a second problem. `.claude/skills/` is gitignored and
holds symlinks into that repository, so a clone has none of them, while
`CLAUDE.md` instructs the reader to run `/zombies`, `/warm`, `/triage`,
`/coderabbit` and `/ponytail-review` before every PR. Five commands promised,
none present, and no page in the repo says how to get them.

The knowledge ownership map is also missing two files that own decisions:
`.claude/settings.json` and `.coderabbit.yaml`. Both gain real content from
the changes ahead of this one in the queue, and the map is where the repo
claims every fact has exactly one home.

## What Changes

- Drop the visibility claim about the skills repository. Link to
  `https://github.com/laidrivm/skills` instead: a URL cannot go stale the way
  an adjective does.
- Add a "Getting the review skills" section: `./link.sh all <path-to-d2ass>`
  from the skills repo root, and the note that `/ponytail-review` comes from
  the ponytail plugin rather than that repository — so linking supplies four
  of the five commands, not five.
- Add `.claude/settings.json` and `.coderabbit.yaml` to the knowledge
  ownership map.
- Add a test asserting every path named in the map exists.
- Add one rule to `CLAUDE.md`: never restate another repository's mutable
  properties — link to it instead.

## Capabilities

### New Capabilities

- `repo-onboarding`: what a fresh clone must be told to reach the state
  `CLAUDE.md` assumes, and which claims the README is allowed to make.

### Modified Capabilities

None.

## Non-goals

- **Automating "is the README true".** Most of its content is prose about
  intent, and no check can decide whether a sentence still describes reality.
  The two tractable pieces are taken: the paths in the map are tested, and
  the one unownable fact is removed rather than watched.
- **Vendoring the skills into this repo** so a clone has them without
  linking. They are shared across projects and edited in one place; copying
  them here creates the divergence the shared repo exists to avoid.
- **Making the review gates degrade gracefully when a skill is missing.**
  `CLAUDE.md` states the gates; a clone without the skills cannot run them,
  and the fix is to link them, not to soften the rule.
- **Rewriting the rest of the README.** Its other sections were checked
  against the repo and hold: the scripts it names match `package.json`, the
  hooks match `simple-git-hooks`, and every other path in the map exists.

## Impact

- `README.md` — one wrong claim removed, one section added, two map rows
  added.
- `CLAUDE.md` — one rule added to the "Rules" list. Sequenced last of the
  four proposed changes, which all write to that list or beside it.
- One new test file.
