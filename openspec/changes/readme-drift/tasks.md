# Tasks — README drift

Requirement names are those in `specs/repo-onboarding/spec.md`.

Last of the four proposed changes: all of them write to the `CLAUDE.md`
"Rules" list or beside it, and this one's rule is the least entangled.

## 1. Pin the map with a test (tests first)

- [x] 1.1 Add `readme-map.test.ts` at the repo root, parsing the first
      backticked span of each ownership-map row out of `README.md` (*Every
      path the map names is real and shipped* → "A row with two backticked
      spans")
- [x] 1.2 Fail when no row parses, rather than passing on an empty set (→
      "The table shape changes")
- [x] 1.3 Resolve each path as a literal file, a directory, or a glob with at
      least one match (→ "A glob row", "A directory row")
- [x] 1.4 Skip rows whose path `git check-ignore` covers, so the test does not
      pass locally and fail in a clone (→ "A gitignored row")
- [x] 1.5 Name the failing row in the assertion message (→ "A doc is renamed
      but the map is not")
- [x] 1.6 Run `bun test` and watch it fail with a deliberately broken row
      before the map is correct — a test that never failed guards nothing

## 2. Fix the README

- [x] 2.1 Replace the skills row's "private" with a link to
      `https://github.com/laidrivm/skills`, dropping the visibility claim
      entirely (*The README states no other repository's mutable properties*)
- [x] 2.2 Add `.claude/settings.json` and `.coderabbit.yaml` rows to the map
      (*The ownership map covers the files that own decisions*)
- [x] 2.3 Add a "Getting the review skills" section naming
      `./link.sh all <path-to-d2ass>` from the skills repo root (*A clone is
      told how to obtain the review skills*)
- [x] 2.4 In that section, say that it supplies `/zombies`, `/warm`,
      `/triage` and `/coderabbit`, and that `/ponytail-review` comes from the
      ponytail plugin (→ "A fresh clone")
- [x] 2.5 Run `bun test` — 1.1–1.5 now pass against the corrected map

## 3. Capture the lesson

- [x] 3.1 Add one rule to the `CLAUDE.md` "Rules" list: never restate another
      repository's mutable properties — link to it instead
- [x] 3.2 Re-read the "Rules" list first and tighten an existing rule rather
      than appending a variant if one is close (rule quality bar in
      `CLAUDE.md`)
- [x] 3.3 Grep the repo for any other claim about a repository this project
      does not own — `README.md`, `CLAUDE.md`, `docs/`, `PLAN.md`,
      `tasks/`, `spec-inbox/README.md`

## 4. Reconcile the repo

- [x] 4.1 Check the map's own claim — one fact, one file — still holds for
      the two rows added in 2.2, and that neither restates what
      `.coderabbit.yaml` or `.claude/settings.json` already says
- [x] 4.2 Update `PLAN.md`: queue entry, status, and the decisions this
      change settles

## 5. Review gates

- [x] 5.1 `/zombies` with no arguments over the final diff, then fix what it
      finds — this change ships a test, so the diff-mode pass applies
- [x] 5.2 `/ponytail-review`, applying the cuts that survive
- [ ] 5.3 `/triage` last, over the final diff
- [ ] 5.4 `/coderabbit-local` if `coderabbit-local-gate` has landed by then
- [ ] 5.5 Open the PR from `fix/readme-drift`
