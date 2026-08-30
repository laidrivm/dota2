# snapshot-build delta — side-and-phase-deltas

## MODIFIED Requirements

### Requirement: Smoothing towards neutral by sample size

After blending, the build SHALL store the delta
`adj = (wr_blend − base) · n_eff / (n_eff + k)` in percentage points, where
`n_eff = n_new + prior(t)` and `k` is 300 for a hero's meta on a position,
500 for side and phase, and 400 for matchup and synergy (data-model §4.2).

`base` SHALL be 50 for meta, matchup and synergy, and the hero's own overall
winrate over the same matches for side and phase. The base is what the delta
is measured against, and side and phase answer a different question from the
rest: not "how good is this hero" — `meta` answers that — but "how much does
this hero's side, or the phase it was picked in, change its result". Taken
from 50 they would restate `meta`, so a hero winning 55% overall would read
about +5 on both sides and the model would weigh its strength twice.
`src/types.ts` has declared side and phase "relative to the hero's overall
winrate" since the contract was written.

The overall winrate SHALL be taken over the same matches the side or phase
rows were counted from, so that a difference in population between the
harvest and the statistics API cancels rather than leaking into the delta.
WHERE a hero has side or phase rows but no counted matches to take an
overall winrate from, the build SHALL fail rather than fall back to 50: a
silent 50 would restore the very double count this base exists to remove,
and on one hero rather than all of them.

A side or phase row carrying zero matches reaches `n_eff = 0` and stores its
column as 0. That is not the omission the next paragraph describes: omission
is for a statistic stored as a row of its own, where a stored 0 and a
measured neutral are indistinguishable. Side and phase are columns on the
hero row, so they have no such choice — the column is written, and *An
unmeasured component is zero for every hero* is what decides whether the
whole component means anything.

An `n_eff` of 0 never reaches this formula: the blending requirement above
leaves that statistic out of the snapshot, because a stored `adj` of 0 and a
measured neutral delta are the same number. That reasoning is what confines
it to statistics stored as rows — where the two are indistinguishable, the
row is omitted rather than stored as 0. A component stored as a column has no
such choice, and *An unmeasured component is zero for every hero* decides it
once for the whole snapshot instead of hero by hero.

#### Scenario: A side delta on a hero that is above average

- **WHEN** a hero's overall winrate over the counted matches is 55 and its
  Radiant winrate is 56, at an `n_eff` far above `k`
- **THEN** its stored `side_adj_radiant` SHALL approach 1.0, not 6.0

#### Scenario: A hero with side rows and no counted matches

- **IF** a hero carries side rows but the build can count no match to take
  its overall winrate from
- **THEN** the build SHALL fail rather than store a delta taken from 50

#### Scenario: A zero-match side row

- **WHEN** a hero's side row carries zero matches and its prior has decayed
- **THEN** its `side_adj` column SHALL be written as 0, the column having no
  omission to fall back on

#### Scenario: A hero with no side preference

- **WHEN** a hero's Radiant and Dire winrates both equal its overall winrate
- **THEN** both side deltas SHALL be 0 however far its overall winrate is
  from 50

#### Scenario: Sample equal to the constant

- **WHEN** a hero's meta on a position has `n_eff = k` and `wr_blend = 54`,
  so its base is 50
- **THEN** its stored `adj` SHALL equal 2.0

#### Scenario: The same sample on a side

- **WHEN** a hero's side statistic has `n_eff = k` and `wr_blend = 54` and
  the hero's overall winrate over the same matches is 55
- **THEN** its stored `adj` SHALL equal −0.5, the same inputs answering
  differently because the base does

#### Scenario: A sample far below the constant

- **WHEN** a hero's meta on a position has `n_eff = k / 9` and
  `wr_blend = 60`, so its base is 50
- **THEN** its stored `adj` SHALL equal 1.0 — a tenth of the raw delta

### Requirement: An unmeasured component is zero for every hero

The build SHALL decide per component, once for the whole snapshot, whether
staging measured it: measured where staging holds any row for it, unmeasured
where it holds none. An unmeasured component SHALL be stored as 0 on every
hero row the build writes, and SHALL NOT be omitted. Zero is the value the
model already reads as no contribution, `draft-model` specifying that reading
for an insufficient hero, so a component zeroed throughout moves no
candidate's rank. Within a *measured* component, a hero staging holds no row
for SHALL fail validation rather than take a silent 0: `src/model.ts` weighs
the delta without asking whether it was measured, so a partial zero changes
the ordering between the heroes it zeroed and the heroes it did not. Which
way it changes depends on the signs of the deltas involved and is not worth
stating — that it changes at all is the defect. Zeroing every hero adds the
same 0 to every score and so reorders nothing.

The rule stands unchanged; what changes is that `side` and `phase` are no
longer the two components named as the ones the source cannot measure. They
are measured from the harvested matches, and a run whose harvest is still
empty falls under this requirement like any other unmeasured component
rather than under a rule of its own.

#### Scenario: Neither component measured

- **WHEN** staging holds no side rows and no phase rows at all
- **THEN** every hero row SHALL carry 0 for both, and the snapshot SHALL
  publish

#### Scenario: One component measured while the other is not

- **WHEN** staging holds a side row for every hero and no phase rows at all
- **THEN** every hero row SHALL carry its blended side delta and 0 for phase,
  and the snapshot SHALL publish — the verdict is per component, so one
  unmeasured component SHALL NOT zero a measured one

#### Scenario: A component measured for some heroes only

- **IF** staging holds rows for a component on every hero but one, whichever
  component it is
- **THEN** the snapshot SHALL end at `status = 'failed'`

#### Scenario: A part the component never measured

- **WHEN** staging holds a `radiant` side row for every hero and no `dire` row
  for any
- **THEN** the snapshot SHALL publish, `side_adj_dire` standing at 0 on every
  hero row — a part missing throughout is the unmeasured case at part
  granularity, and only a part missing for some heroes reorders them

#### Scenario: The verdict outlives the build that took it

- **WHEN** a snapshot is built
- **THEN** which components its staging measured SHALL be recorded on that
  snapshot, and a later patch's blend SHALL read `wr_old` for a component only
  where that snapshot measured it — an unmeasured component's stored 0 is no
  reading, and offering it as a winrate of 50 pulls the later patch's measured
  deltas towards a number nobody measured

#### Scenario: A measured component that happens to be neutral

- **WHEN** staging measures side for every hero and one hero's blended side
  delta is exactly 0
- **THEN** the snapshot SHALL publish — a measured neutral is not an
  unmeasured component
