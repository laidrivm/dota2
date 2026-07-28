# Design — skill provenance

## Context

Measured on `main` before this design was written:

- `.claude/skills/` holds 11 symlinks of the form
  `<name> -> ../../../skills/<name>`, resolving to a sibling working tree, plus
  six real `openspec-*` directories. The whole directory is gitignored, which
  `readme-map.test.ts` already has to special-case.
- The shared repository holds 14 skills. Six are named anywhere in this
  repository's tracked files — `coderabbit`, `coderabbit-local`,
  `playwright-cli`, `triage`, `warm`, `zombies`. Five more are symlinked and
  named nowhere: `checklist`, `first-five`, `preflight`, `review-order`,
  `session-wrapup`. Three are not even symlinked: `code-review`,
  `feature-generator`, `spec-generator`.
- Its `skills-lock.json` has one entry, `playwright-cli`, with `source`,
  `sourceType`, `skillPath` and `computedHash` — no upstream ref, no date.
- Its `README.md` line 24 enumerates which skills the agent may invoke and
  states one base-branch convention. Both were checked against the skills as
  they stand: all seven diff skills use `git rev-parse --abbrev-ref
  origin/HEAD` with a `main` fallback. The three-convention drift that
  motivated this change was fixed upstream before it was written.
- The shared repository is at `ccd3971` (2026-07-27).

## Goals / Non-Goals

**Goals:**

- Make the gates' dependency on an outside working tree visible in this
  repository's diff.
- Distinguish a skill that is merely present from one something depends on.
- Pin what a clone can actually check, and say plainly what it cannot.

**Non-Goals:** as listed in the proposal — editing the skills or the lock from
here, a CI check needing the shared repository, vendoring, README fixes, and
per-skill commits from separate reviews.

## Decisions

### A table in `docs/review-toolkit.md`, not a new file

The file already owns the toolkit and describes each skill's contract; the
provenance belongs beside the contract it dates. A `skills-manifest.json` at
the root would be a second place naming the same skills, and this project has
spent three changes removing exactly that shape.

The table form is deliberate: `readme-map.test.ts` already parses a markdown
table from prose and is the reason the README's ownership map can be trusted.
Reusing the shape means reusing a parser the project has debugged, including
the lesson that an emptied table must not make the test pass on zero cases.

Rejected: the commit inline in each skill's bullet. It removes the table but
scatters six object names through six paragraphs of prose, and the test then
parses paragraphs instead of rows.

### The commit answers "verified against", not "vendored at"

`computedHash` in the shared lock answers *was my copy edited?*. A vendoring
date would answer *when did I copy it?*. Neither is the question this
repository has, which is *does the contract written in `docs/review-toolkit.md`
still describe the skill that will run?* So the recorded value is the commit at
which that comparison was last made, and advancing it means making the
comparison again — not pulling.

This also fixes what the entry means when the skill is one of the user's own.
Thirteen of the fourteen have no upstream at all, so "vendored at" would be
undefined for them, while "verified against" is defined for every skill in the
shared tree.

### Archived entries carry no commit

A verified-at commit on a skill nothing depends on claims a check whose absence
would never be noticed. Leaving the cell empty is the honest state, and the
test enforces it, so the list cannot quietly grow into a second set of
dependencies.

Rejected: dropping the archived skills from the file entirely. Then a reader
cannot tell an unused skill from a dependency somebody forgot to record — the
two look identical from inside this repository, and that ambiguity is what the
change exists to remove.

### The test does not read the skills

The eleven symlinked entries in `.claude/skills/` point outside the repository
and resolve to nothing after `git clone`; the six `openspec-*` entries beside
them are real directories and are not what this change is about.
`agent-permissions` already records the symlink as the reason skill frontmatter
cannot be pinned here, and the same reasoning applies with more force to
content. So the test asserts the table against tracked files — this file's own
gate sequence and `CLAUDE.md`'s rules, a closed loop inside the repository —
and asserts the shape of each cell. What it cannot assert, the specification says out loud rather than
implying.

### The lock change is a hand-off

`ref` and `vendoredAt` beside `computedHash` on the `playwright-cli` entry is
one row in a file this project does not own. The draft is produced here and
applied by the user there, on the same terms as the three skills-repo fixes
`vendored-skill-permissions` handed over.

## Risks / Trade-offs

- **The commits go stale and nobody advances them.** → the pin's value is that
  staleness is now visible in a file a branch touching the gates already opens;
  an unchecked date beats a checked nothing.
- **The table and the bullets above it drift apart.** → the test binds the
  table to the pre-PR sequence in the same file, which is the sentence that
  makes a skill a gate.
- **Someone reads the commit as "this is what runs".** → the wording says
  verified-against, and the requirement states that a newer upstream commit is
  not a defect. The symlink still resolves to whatever is checked out; nothing
  here can change that without vendoring.

## Migration plan

One step, one PR on `feat/skill-provenance`: the table, the archived list, the
test, and the drafted lock patch handed to the user. Rollback is a revert.

## Open questions

None.
