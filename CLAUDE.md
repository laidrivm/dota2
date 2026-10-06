# d2ass

## Project overview

- What it is: a single-page draft assistant for Dota 2 ranked All Pick —
  the player mirrors a live draft into it and gets per-role pick
  suggestions and a win-probability estimate.
- Stack: TypeScript on Bun, Preact, no build tool beyond Bun's bundler.
- Run locally: `bun run dev` (see README for what it serves).
- Run tests: `bun test`, and `bun run test:db` for the cases that need a
  database and otherwise skip.

## Code style

The ponytail ladder, dependency safety and accessibility — see
[harness/code-style.md](harness/code-style.md).

## API design

Response contract rules for every endpoint — see
[harness/api-design.md](harness/api-design.md).

## Git & PRs

Branch and commit shape, PR description, and the git mechanics that
protect the history — see [harness/git-and-prs.md](harness/git-and-prs.md).

## Review toolkit

Which review skill to run, when, and the pre-PR sequence they form —
see [harness/review-toolkit.md](harness/review-toolkit.md).

## Feature workflow (spec-driven, OpenSpec)

The four OpenSpec stages, what gates each one, the discipline every change
artefact is written under, and the boards that hold every task — see
[harness/feature-workflow.md](harness/feature-workflow.md).

## Testing

What a test must assert and how `/zombies` findings route — see
[harness/testing.md](harness/testing.md). The mutation floor and the e2e rules
— see [docs/testing.md](docs/testing.md).

## Design sync

The design project and the swatch pages derived from the palette — see
[docs/design-sync.md](docs/design-sync.md).

@harness/rules.md

### d2ass's own rules

#### Code

Rules about this application's code that name what only d2ass has. They age
with it: when the code a rule describes is rewritten, the rule is a candidate
for deletion. Every other rule is the harness's, imported above from its
tracked copy — change one in `laidrivm/harness`, never in `harness/`.

- Gate a side effect on the reducer's result, not on the action that asked
  for it.
- A default action bound to a key applies to the first *enabled* candidate,
  never the first rendered one.
- Restore focus after an action that unmounts the active element in a
  macrotask (`setTimeout(…, 0)`), not `requestAnimationFrame`.
- Read state a document-level listener depends on through a ref, never by
  re-subscribing the listener when that state changes.
- Compare a `real` column read at two different times through `Math.fround`,
  never by raw equality.
- Write and delete rows in a shared test database only inside the sentinel
  ranges its cleaner reclaims.
