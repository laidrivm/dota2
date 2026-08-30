# hero-picker delta — hero-aliases-seed

## MODIFIED Requirements

### Requirement: Search filters from the first character

The picker SHALL focus its search field when it opens and SHALL filter the grid
on every input event. A hero SHALL match WHEN the lowercased query is a prefix
of any word of its canonical name, of any of its `abbreviations`, or of any of
its `aliases`. An empty query SHALL match every hero.

Matches SHALL be ordered by what matched before they are ordered by name:
every hero matched on its own name first, then every hero matched only on an
abbreviation, then every hero matched only on a legacy alias, and within each
of the three in ascending name order. A hero matching on more than one of the
three SHALL be listed at the highest-priority one — nearest the top of the
list, and so the *lowest* rank number wherever an implementation numbers
them. "Highest" here is priority, never a numeral.

The order is the ranking and nothing else is: no score, no match length, no
frequency. A player typing `es` is shown both Earth Spirit and Ember Spirit
and chooses; the picker SHALL NOT pick a winner between two heroes that
matched the same way.

#### Scenario: Alias match

- **WHEN** the query is `bone`
- **THEN** Clinkz SHALL be among the matches, through the alias `bone fletcher`

#### Scenario: Abbreviation match

- **WHEN** the query is `wk`
- **THEN** Wraith King SHALL be among the matches

#### Scenario: Word prefix inside a name

- **WHEN** the query is `king`
- **THEN** Wraith King SHALL match, because `king` is a whole word of the name

#### Scenario: Not a substring search

- **WHEN** the query is `ing`
- **THEN** Wraith King SHALL NOT match

#### Scenario: Whitespace-only query

- **WHEN** the query is one or more spaces
- **THEN** every hero SHALL match, as for an empty query

#### Scenario: Search field has focus on open

- **WHEN** the picker opens
- **THEN** the search field SHALL be the focused element and SHALL be empty

#### Scenario: The three kinds are ordered against each other

- **WHEN** one query matches one hero on a word of its own name, a second
  only on an abbreviation and a third only on a legacy alias
- **THEN** the three SHALL be listed in that order, whatever their
  alphabetical order

#### Scenario: Two heroes matched the same way

- **WHEN** the query is `es` and it is an abbreviation of both Earth Spirit
  and Ember Spirit
- **THEN** both SHALL be listed, adjacent, in ascending name order

#### Scenario: A hero matching on two kinds at once

- **WHEN** a hero matches the query both on its own name and on a legacy
  alias
- **THEN** it SHALL be ranked as a name match, appearing once

#### Scenario: A bundle cached before abbreviations existed

- **IF** the bundle the picker reads carries no `abbreviations` on a hero,
  as a payload cached before this change does
- **THEN** the search SHALL treat that hero as having none and match it on
  its name and `aliases`, and SHALL NOT throw
