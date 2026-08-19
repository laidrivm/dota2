# agent-rulebook — delta spec

## MODIFIED Requirements

### Requirement: A mechanised prohibition leaves its prose home

WHEN a prohibition becomes a `deny` entry, a hook or a CI check, the prose
stating it SHALL be deleted from `CLAUDE.md` or from whichever doc indexed
there holds it — from whichever section holds it, not only from the rules
list. A prohibition SHALL NOT be stated in both places, because the prose then
reads as the boundary while the mechanism is the boundary, and the two can
drift apart. Where the section holding the prose has been extracted under
`docs/`, this requirement reaches it there.

#### Scenario: A rule fully covered by a mechanism

- **WHEN** committing on `main` becomes a hook
- **THEN** the sentence forbidding it is deleted from the Git & PRs section

#### Scenario: The section holding it has been extracted

- **WHEN** the prohibition's prose stands in a doc indexed from `CLAUDE.md`
  rather than in `CLAUDE.md` itself
- **THEN** it is deleted from that doc on the same terms, and its having
  moved is not a reason to leave it standing

#### Scenario: A rule only partly covered

- **WHEN** the secret scanner covers tokens and keys but not machine-local
  paths or internal identifiers
- **THEN** the prose is shortened to what the scanner cannot see, rather than
  deleted whole

#### Scenario: A prohibition that resists mechanisation

- **WHEN** no mechanism can express a prohibition without a far broader block
  than the rule intends
- **THEN** it stays prose, and the proposal that considered it records why
