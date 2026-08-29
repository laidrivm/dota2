# hero-reference delta — hero-aliases-seed

## ADDED Requirements

### Requirement: Hero aliases are seeded from a tracked file

The repository SHALL hold one tracked SQL file naming every alias the picker
searches by, each row carrying a hero id, the alias in lower case, and a
`kind` of `legacy` or `abbrev`. `legacy` is a name the hero carried in Dota 1
or in Valve's own earlier naming; `abbrev` is an abbreviation players type.
Aliases SHALL be English; no other writing system is seeded.

The job SHALL apply that file on every run, at any point after the hero
upsert and before the export. Nothing between those two reads an alias — the
pulls do not — so the upsert is the whole of the ordering constraint and no
requirement pins the step to a narrower place than that.

It SHALL NOT be applied with `schema.sql` on connect: `hero_aliases.hero_id`
references `heroes`, which no row of fills until the upsert runs, so a seed
applied on connect fails its foreign key on a fresh database and takes the
whole run with it.

#### Scenario: A fresh database

- **WHEN** the job runs against a database holding no `heroes` rows
- **THEN** the hero upsert SHALL complete first and the seed SHALL apply
  afterwards without a foreign-key failure
- **AND** `hero_aliases` SHALL hold one row per line of the seed file

#### Scenario: The seed names a hero the reference does not hold

- **IF** the seed carries an alias for a hero id absent from `heroes`
- **THEN** the run SHALL fail, naming the hero id, rather than publish a
  bundle whose aliases silently omit it

#### Scenario: Applied twice

- **WHEN** the job runs twice with no change to the seed file
- **THEN** `hero_aliases` SHALL hold the same rows after the second run as
  after the first

### Requirement: The seed replaces the alias table whole

Applying the seed SHALL delete every row of `hero_aliases` and insert the
file's rows, inside one transaction. It SHALL NOT insert only what is
missing.

Inserting only what is missing would make the file a log of everything ever
added rather than a statement of what is true: an alias removed from the file
would stay in the database for ever, the two would drift with nothing
reporting it, and the drift would surface as a search result nobody can trace
to a line of source. The table is small, hand-maintained, and referenced by
nothing, so replacing it whole costs nothing that keeping it does not.

#### Scenario: An alias removed from the file

- **WHEN** a line is deleted from the seed and the job runs
- **THEN** that alias SHALL be absent from `hero_aliases`
- **AND** absent from the next published bundle

#### Scenario: A seed that fails part way

- **IF** applying the seed raises after the delete and before the insert
  completes
- **THEN** the transaction SHALL roll back, leaving `hero_aliases` holding
  the rows it held before the run
