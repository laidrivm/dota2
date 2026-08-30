# match-harvest Specification

## ADDED Requirements

### Requirement: Matches are drawn from leaderboard members at an asked-for bracket

The harvest SHALL take match ids by walking `leaderboard.season` members and
reading each one's `player(...).matches(...)`, there being no query that
returns recent matches globally.

The walk SHALL advance `skip` so that no member is read twice in one run, and
SHALL stop at a bounded number of members rather than reading a whole
division: a division reports around ten thousand members, and how many a
night should cover is a constant `design.md` leaves to the first run's
measured yield. Members overlap in the same matches, so a match SHALL be
stored once however many members return it. It SHALL restrict that request to ranked All
Pick with `gameModeIds: [22], lobbyTypeIds: [7]`, and SHALL state the bracket
it wants through `bracketIds` rather than inferring it from the players
being on a leaderboard — a leaderboard player may queue in a party below
their own rank.

`PlayerMatchesRequestType.bracketIds` is `[Int]` and not the `[RankBracket]`
enum `heroStats.win*` takes, so the harvest SHALL pass integers, and it SHALL
pass `[7, 8]` — Divine and Immortal, the brackets `ingest/meta.ts` already
builds the bundle from. A harvest at a bracket the bundle is not built from
would score the model against a population it was never fitted to.

It SHALL request no more than 100 matches per call, which is the cap the API
states and refuses past, and SHALL take the newest matches a member has
rather than paging back through their history: the harvest runs nightly and
100 matches is far more than any player plays in a day, so paging would spend
requests re-reading matches already stored.

#### Scenario: The bracket is asked for, not inferred

- **WHEN** the harvest requests a leaderboard member's matches
- **THEN** the request SHALL carry `bracketIds: [7, 8]` as integers, never
  the enum names the hero endpoints take
- **AND** a returned match whose `bracket` is neither 7 nor 8 SHALL NOT be
  stored, the answer being checked and not only the question asked

#### Scenario: The walk advances and stops

- **WHEN** the harvest reads a second page of leaderboard members
- **THEN** its `skip` SHALL be past the members the first page returned
- **AND** the walk SHALL stop at its bounded number of members rather than
  continuing to the end of the division

#### Scenario: One match returned by two members

- **WHEN** two members of the same match are both walked
- **THEN** the match SHALL be stored once, with one set of pick and ban rows

#### Scenario: A leaderboard member with no ranked All Pick matches

- **WHEN** a member returns an empty list, as one playing only Captains Mode
  practice lobbies does
- **THEN** the harvest SHALL continue to the next member rather than treat
  the empty list as the end of the walk

#### Scenario: A member with more matches than one call returns

- **WHEN** a member has more matching matches than the per-call cap
- **THEN** the harvest SHALL take the newest up to the cap in one call and
  move to the next member, never paging back through that member's history

### Requirement: A stored match carries the whole draft and its result

A stored match SHALL carry its id, the instant it started, which side won,
its bracket, and the patch it was played on. Each of its ten picks SHALL
carry the hero, the side, the pick order and the position, and the lane where
the API returns one. Each ban SHALL carry the hero alone: the API returns no
side for a ban, and `Session.bans` holds none either.

A match whose draft is short of ten picks SHALL be rejected rather than
stored, and counted as rejected. Roughly seven in a hundred sampled matches
are short of ten, and a partial draft is one nothing can score at 5v5 — but a
silent drop and a source that stopped returning picks look identical, so the
count is what tells them apart.

#### Scenario: A complete draft

- **WHEN** a returned match carries ten picks
- **THEN** every pick SHALL be stored with its hero, side, order and
  position, and every ban with its hero

#### Scenario: A ban has no side

- **WHEN** a ban is stored
- **THEN** it SHALL carry no side, the API returning none

#### Scenario: A draft short of ten picks

- **IF** a returned match carries fewer than ten picks
- **THEN** it SHALL NOT be stored, and the run's report SHALL count it as
  rejected

### Requirement: The store is bounded by a count of matches

Retention SHALL keep the newest **50 000** matches and delete the rest, with
their picks and bans. That count SHALL be the only bound. Why 50 000 rather
than another number is `design.md`'s; that it is the bound is this
requirement's, because a criterion reading "a fixed count" is one no test can
measure.

The patch SHALL NOT bound it. A patch runs from 7 to 200 days — measured over
the thirteen most recent — so a patch-shaped bound admits between 14 000 and
400 000 matches at any plausible rate, which is not a bound. The patch is
recorded on every match so that a reader can restrict itself to matches its
own snapshot can fairly score; deciding which matches are *relevant* is the
reader's, and deciding how much disk this costs is retention's.

#### Scenario: The store at its bound

- **WHEN** the harvest stores matches that carry the store past its count
- **THEN** the oldest matches SHALL be deleted until the count holds, and
  their picks and bans SHALL go with them

#### Scenario: A patch longer than the bound

- **WHEN** one patch has produced more matches than the count
- **THEN** the oldest of them SHALL still be deleted — belonging to the
  current patch SHALL NOT exempt a match

#### Scenario: Deleting a match leaves nothing behind

- **WHEN** a match is deleted by retention
- **THEN** no pick or ban row SHALL remain that references it

### Requirement: The run reports what the harvest did

The run's report SHALL state how many matches the harvest added, how many it
rejected and how many retention dropped. A harvest that stored nothing SHALL
say so rather than report nothing.

#### Scenario: A harvest that stored nothing

- **WHEN** every match returned was already stored, or none was returned
- **THEN** the report SHALL say the harvest added no match, rather than
  omitting the harvest from the report
