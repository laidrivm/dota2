# Task 8 — Split CLAUDE.md per its own growth protocol

> **Status: DONE.** `CLAUDE.md` 321 → 186 lines. Extracted:
> `docs/api-design.md`, `docs/testing.md`, `docs/feature-workflow.md`.
> "Accessibility" stayed in "Code style" — a subsection, not a section.
> `.coderabbit.yaml` now sets `knowledge_base.code_guidelines.filePatterns`
> because a custom list replaces the defaults that matched `**/CLAUDE.md`.

## Context

`CLAUDE.md` is 319 lines against its own ~250-line trigger in "Structure &
growth of this file". The protocol it defines for itself has never been
run, and the symptom the protocol predicts has already appeared: the
`<!-- newest first -->` marker in the Rules list was ignored for two
consecutive rule additions, and the OpenSpec exemption list drifted to
name a bot (Renovate) the project does not use.

Facts you must respect:

- Move **whole sections only**. Never split one topic across two homes.
- `CLAUDE.md` stays the only index: every extracted doc is linked from it,
  and extracted docs never link to each other.
- Extracted docs inherit the constitution — rule quality bar, single-source
  rule, fix & capture routing follow the section to its new home.
- `docs/context/` is out of scope: those are session save-points, not
  extracted sections.
- `.coderabbit.yaml` (`path_instructions`) cites CLAUDE.md sections by name
  — "API design", "Accessibility", "Testing", "E2E (Playwright)". Moving a
  section silently breaks those citations; CodeRabbit will not report a
  missing target.

## Steps

### 1. Extract the three self-contained sections

| Section | Lines | New home |
|---|---|---|
| API design | 30 | `docs/api-design.md` |
| Testing (incl. "E2E (Playwright)") | 37 | `docs/testing.md` |
| Feature workflow (OpenSpec) | 83 | `docs/feature-workflow.md` |

"Accessibility" is a subsection of "Code style", not a `##` section —
move it into `docs/api-design.md` only if it is promoted to a section
first; otherwise leave it in place and keep its name stable.

Each extraction leaves exactly one line in `CLAUDE.md`: the section's
scope plus the link.

### 2. Repoint the CodeRabbit citations

Update `path_instructions` in `.coderabbit.yaml` to cite the new paths
(`/docs/testing.md` etc.) instead of section names inside `/CLAUDE.md`.
Verify CodeRabbit's code-guidelines auto-detection covers the new files —
its default patterns match `**/CLAUDE.md`, not `docs/*.md`, so the
extracted docs must be named in config or their rules stop reaching the
reviewer.

### 3. Repoint the other cross-references

`README.md` knowledge-ownership map, `openspec/config.yaml` (`context:`
and `rules:` both reference `/CLAUDE.md`), and any `tasks/*.md` that cites
a moved section.

### 4. Verify the result

- `CLAUDE.md` is under 250 lines and readable in one sitting.
- Every extracted doc is reachable in one hop from `CLAUDE.md`.
- `grep -rn "CLAUDE.md" .` finds no reference to a section that moved.

## Constraints

- Do NOT rewrite rule text while moving it — a move is a move. Wording
  changes are a separate commit with their own rationale.

## Acceptance criteria

- [x] `CLAUDE.md` under 250 lines; each extracted section replaced by one
      scope line + link.
- [x] `docs/api-design.md`, `docs/testing.md`, `docs/feature-workflow.md`
      exist, each containing its section verbatim.
- [x] `.coderabbit.yaml` cites the new paths, and the extracted docs are
      covered by CodeRabbit's code-guidelines patterns.
- [x] `README.md` map and `openspec/config.yaml` reference the new homes.
- [x] No extracted doc links to another extracted doc.
