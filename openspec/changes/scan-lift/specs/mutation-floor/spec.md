# mutation-floor — delta spec

## MODIFIED Requirements

### Requirement: An equivalent mutant is admitted at the line it occupies

A mutant that cannot be killed because it does not change behaviour SHALL be
admitted with a `// Stryker disable next-line <Mutator>[,<Mutator>…]: <reason>`
comment on the line above it, naming the mutators concerned and giving a
reason. Stryker then reports the mutant as `Ignored`, the reason travels into
the report, and both sit in the diff beside the code they excuse. This SHALL be
the exemption mechanism the project uses: there is no register of exempt
mutants.

That form SHALL be the only one the check accepts in `src/model.ts`, and it
SHALL fail on every other, naming the line. Specifically: a comment naming
`all` rather than mutators, because `all` would also silence a mutant added to
that line later which no one has judged; a comment without `next-line`, whose
scope runs to the end of the file or to a matching `// Stryker restore`; and a
comment carrying no reason, or none after its colon. A comma-separated list of
named mutators is accepted — a single line can carry two mutants that are both
equivalent for the same reason.

The check SHALL read the same comments Stryker does — a `/* … */` comment as
well as a `//` one, and either anywhere on the line rather than only leading it
— because Stryker matches its directive against every comment the parser hands
it. It SHALL nonetheless accept only the `//` spelling, so a block-comment
directive fails however well it is formed: Stryker honours both, and one
spelling in `src/model.ts` is what stops an exemption from hiding inside a
comment that does not look like one.

Stryker offers exemptions this requirement does not cover — `// Stryker
restore`, and an ignore-plugin declared in `ignorers`. Neither is used, and
neither is checked for: an ignore-plugin is a new file and a new dependency,
and a `restore` without a matching `disable` changes nothing — and the paired
`disable` that would give it meaning is itself rejected, since it cannot carry
`next-line`.

`mutator.excludedMutations` in `stryker.config.json` would achieve the same
exemption with no trace at the line it affects, and it is not taken. It is not
checked for either: a fifteen-line configuration file is read whole by whoever
reviews a change to it, where a disable comment hides in 296 lines of
arithmetic. The scan exists for the one that hides.

#### Scenario: An equivalent mutant is marked

- **WHEN** a surviving mutant is judged equivalent and a
  `// Stryker disable next-line <Mutator>: <reason>` comment is added above its
  line
- **THEN** its status becomes `Ignored`, the survivor count falls by one, and
  the floor is lowered to match

#### Scenario: A well-formed directive in a block comment

- **WHEN** a comment in `src/model.ts` reads
  `/* Stryker disable next-line ArithmeticOperator: <reason> */`
- **THEN** the check fails, because the accepted form is the `//` spelling,
  even though Stryker honours this one

#### Scenario: A blanket disable comment

- **WHEN** a comment in `src/model.ts` reads `// Stryker disable next-line all`
- **THEN** the check fails, because the mutator is not named

#### Scenario: An exemption with no reason

- **WHEN** a disable comment names a mutator but the text after the colon is
  absent, empty or whitespace
- **THEN** the check fails

#### Scenario: A directive below a regex literal

- **WHEN** `src/model.ts` holds a regex literal containing a backtick — `/[`]/`
  — and a `// Stryker disable next-line all` comment on a later line
- **THEN** the check fails on that comment, because the scan reads the literal
  as a regex literal and not as an opening template literal
