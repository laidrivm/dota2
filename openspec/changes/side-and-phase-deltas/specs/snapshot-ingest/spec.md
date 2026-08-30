# snapshot-ingest delta — side-and-phase-deltas

## MODIFIED Requirements

### Requirement: A run leaves staging whole or leaves it untouched

The ingest SHALL take the run instant as an argument rather than reading a
clock, so that the windows derived from it are fixed for the run and a repeat
over the same argument selects the same days and weeks. It SHALL replace the
current patch's staging rows rather than adding to them, and SHALL write every
row of a run inside one transaction. IF a run fails at any point before that
transaction commits, staging SHALL hold exactly the rows it held before the run
started. Two runs over unchanged source data **and the same run instant** SHALL
therefore leave identical staging rows; two runs whose instants fall either
side of a UTC day boundary SHALL NOT, the window itself having moved.

Replacing rather than accumulating is what removes the need for a ledger of
what has been pulled: the windows are a function of the patch and that
argument, so a re-run recomputes them rather than resuming a partial one.

This guarantee reaches staging and nothing else. The reference upserts and the
mirrored images are outside this transaction and are not undone by a failure
after them — `hero-reference` states what each leaves behind instead.

#### Scenario: Two runs over unchanged data

- **WHEN** the ingest runs twice with the same run instant against a source
  returning identical responses
- **THEN** staging SHALL hold the same rows with the same counts after the
  second run as after the first

#### Scenario: Two runs a day apart

- **WHEN** two runs' instants fall either side of a UTC day boundary
- **THEN** the second run's window SHALL hold a day the first's did not, and
  the rows SHALL differ

#### Scenario: A run that fails part-way

- **IF** the pair pull fails after the meta pull has produced its rows
- **THEN** staging SHALL hold the rows it held before the run started

#### Scenario: Rows from an older patch

- **WHEN** a run writes staging for a patch newer than the one staging holds
- **THEN** rows older than the previous patch SHALL be gone

#### Scenario: The two tables the write now covers

- **WHEN** a staging write replaces a patch's rows
- **THEN** `staging_hero_sides` and `staging_hero_phases` SHALL be replaced
  with it, inside the same transaction as the rest

#### Scenario: A hero with no match on one side

- **WHEN** the harvest holds matches for the patch and a hero has picks on
  one side only
- **THEN** the write SHALL emit a row for the missing side with zero matches,
  so that the component is measured for every hero or for none — a component
  measured for some heroes only fails the build

#### Scenario: A hero the harvest has never seen

- **WHEN** the harvest holds matches for the patch and a hero in `heroes`
  appears in none of them
- **THEN** the write SHALL emit its zero-match rows for every side and phase
  like any other hero, the rows being written per hero of the reference and
  not per hero the harvest saw

#### Scenario: A harvest that has collected nothing yet

- **IF** the harvest store holds no match for the patch being staged
- **THEN** the write SHALL leave both tables empty rather than writing rows
  of zeros for every hero, so that *An unmeasured component is zero for every
  hero* reads the absence as unmeasured — the zero-match rows above are for
  a hero missing a part, never for a component nothing observed
