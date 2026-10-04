# repo-onboarding

## MODIFIED Requirements

### Requirement: A clone is told how to obtain the review skills

`README.md` SHALL state that the review skills arrive with `bun install`, from
the harness package the lockfile pins, and SHALL state that `/ponytail-review`
comes from the ponytail plugin rather than from that package. It SHALL NOT
name a linker run from another checkout.

#### Scenario: A fresh clone

- **WHEN** a reader clones the repo and finds the links under
  `.claude/skills/` unresolved
- **THEN** the README names `bun install` as what resolves them
- **AND** says which commands of the pre-PR sequence that supplies

#### Scenario: The retired linker

- **WHEN** the README is searched for `link.sh`
- **THEN** it SHALL not match
