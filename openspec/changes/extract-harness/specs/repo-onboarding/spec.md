# repo-onboarding

## MODIFIED Requirements

### Requirement: The README states no other repository's mutable properties

`README.md` SHALL NOT describe a property of another repository that can
change without a change here — visibility, default branch, ownership. Where
such a repository is referenced, the README SHALL link to it instead.

#### Scenario: The skills repository is referenced

- **WHEN** the knowledge ownership map names the skills repository, renamed
  `laidrivm/harness`
- **THEN** the row links to `https://github.com/laidrivm/harness`
- **AND** carries no claim about whether it is public or private

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

- **WHEN** `README.md` is searched for `link.sh`
- **THEN** it SHALL NOT match
