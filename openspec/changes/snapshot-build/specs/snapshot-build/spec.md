# snapshot-build — delta spec

## ADDED Requirements

### Requirement: The build reads its own database and nothing else

The snapshot build SHALL read its inputs from the staging tables, the
reference tables, and the retained snapshot each blend draws its `wr_old`
from. It SHALL reach no source beyond that database — the ingest is what
talks to STRATZ. The build instant SHALL be an argument rather than a clock
reading, so that a build over unchanged inputs is reproducible, and the
snapshot's `created_at` SHALL be that same instant, so the decay a blend
applies and the window `stabilizing` measures are read from one clock.

#### Scenario: The predecessor a blend reads

- **WHEN** the current patch has a predecessor whose prior has not decayed to
  0
- **THEN** the build SHALL read that patch's newest published snapshot for
  `wr_old`, which retention keeps available for exactly this reason

#### Scenario: Same inputs, same snapshot

- **WHEN** the build runs twice over identical staging and reference rows
  with the same build instant
- **THEN** the two snapshots' statistics rows SHALL be equal field by field,
  their `created_at` SHALL be equal, and only `snapshot_id` SHALL differ

#### Scenario: The build reaches for the network

- **WHEN** the build runs with every network call but its database
  connection stubbed to throw
- **THEN** it SHALL reach validation without raising, because it reaches no
  source outside that database

### Requirement: Patch blending with a decaying prior

For each statistic the build SHALL blend the current patch's matches
`n_new` and winrate `wr_new` with the previous patch's already-smoothed
winrate `wr_old`, as `wr_blend = (n_new · wr_new + prior(t) · wr_old) /
(n_new + prior(t))`, where `prior(t) = k0 · 2^(−t / h)`, taken as 0 once
`t ≥ t_max`, and `t` counts whole days from the current patch's
`detected_at` to the build instant, both taken as instants on the UTC
timeline: the date anchors at `00:00:00Z`, and `t` is the elapsed time in
whole 24-hour days, rounded down. The basis has to be stated because the
column is a date while the instant carries an offset, and reading that
offset as local rather than converting it shifts `t` by a day. The
parameters SHALL be `k0 = 1000`, `h = 1`, `t_max = 4` for a major patch and
`k0 = 3000`, `h = 2`, `t_max = 7` for a letter patch (data-model §4.1).
WHERE `n_new + prior(t)` is 0 the statistic SHALL be absent from the
snapshot rather than blended, because the quotient is undefined and there
is nothing to smooth towards neutral. Absence here is a row not written, so
this reaches only a statistic stored as a row of its own — a position, a
matchup, a synergy. A statistic stored as a column of a hero's row cannot be
absent; *An unmeasured component is zero for every hero* governs those.

#### Scenario: Reading `wr_old` back off a snapshot

- **WHEN** a blend reads `wr_old` from the previous patch's snapshot
- **THEN** it SHALL take that statistic's stored delta and add 50, the
  snapshot holding a delta from neutral where the blend wants the winrate it
  came from — a snapshot stores no winrate, so this reconstruction is the
  whole of what "already-smoothed winrate" names

#### Scenario: A major patch on its first day

- **WHEN** the current patch is major and `t = 0`
- **THEN** `prior(t)` SHALL equal 1000

#### Scenario: A major patch past its window

- **WHEN** the current patch is major and `t = 4`
- **THEN** `prior(t)` SHALL equal 0 and `wr_blend` SHALL equal `wr_new`

#### Scenario: A letter patch past its window

- **WHEN** the current patch is a letter patch and `t = 7`
- **THEN** `prior(t)` SHALL equal 0 and `wr_blend` SHALL equal `wr_new`

#### Scenario: Neither matches nor prior

- **IF** a statistic has `n_new = 0` and its patch's prior has decayed to 0
- **THEN** the snapshot SHALL hold no row for it, and no division SHALL be
  attempted

#### Scenario: No previous patch to blend

- **IF** the current patch has no predecessor in `patches`
- **THEN** the snapshot's `prior_patch_id` SHALL be `NULL`, its
  `prior_weight` SHALL be 0, and `wr_blend` SHALL equal `wr_new`

### Requirement: Smoothing towards neutral by sample size

After blending, the build SHALL store the delta
`adj = (wr_blend − 50) · n_eff / (n_eff + k)` in percentage points, where
`n_eff = n_new + prior(t)` and `k` is 300 for a hero's meta on a position,
500 for side and phase, and 400 for matchup and synergy (data-model §4.2).
An `n_eff` of 0 never reaches this formula: the blending requirement above
leaves that statistic out of the snapshot, because a stored `adj` of 0 and a
measured neutral delta are the same number. That reasoning is what confines
it to statistics stored as rows — where the two are indistinguishable, the
row is omitted rather than stored as 0. A component stored as a column has no
such choice, and *An unmeasured component is zero for every hero* decides it
once for the whole snapshot instead of hero by hero.

#### Scenario: Sample equal to the constant

- **WHEN** a statistic has `n_eff = k` and `wr_blend = 54`
- **THEN** its stored `adj` SHALL equal 2.0

#### Scenario: A sample far below the constant

- **WHEN** a statistic has `n_eff = k / 9` and `wr_blend = 60`
- **THEN** its stored `adj` SHALL equal 1.0 — a tenth of the raw delta

### Requirement: An unmeasured component is zero for every hero

The build SHALL decide per component, once for the whole snapshot, whether
staging measured it: measured where staging holds any row for it, unmeasured
where it holds none. An unmeasured component SHALL be stored as 0 on every
hero row the build writes, and SHALL NOT be omitted — `side` and `phase` are
the two the source is known not to measure. Zero is the value the model
already reads as no contribution, `draft-model` specifying that reading for
an insufficient hero, so a component zeroed throughout moves no candidate's
rank. Within a *measured* component, a hero staging holds no row for SHALL
fail validation rather than take a silent 0: `src/model.ts` weighs the delta
without asking whether it was measured, so a partial zero changes the ordering
between the heroes it zeroed and the heroes it did not. Which way it changes
depends on the signs of the deltas involved and is not worth stating — that it
changes at all is the defect. Zeroing every hero adds the same 0 to every
score and so reorders nothing.

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

#### Scenario: A measured component that happens to be neutral

- **WHEN** staging measures side for every hero and one hero's blended side
  delta is exactly 0
- **THEN** the snapshot SHALL publish — a measured neutral is not an
  unmeasured component

### Requirement: Position shares are a distribution over a hero's positions

For each hero the build SHALL store `pick_share` per position such that the
shares over the positions the hero has any picks on sum to 1 within 1e-6,
and SHALL write no row for a position the hero was never picked on
(data-model §4.3).

#### Scenario: Shares over the positions played

- **WHEN** a hero's staging rows hold picks on two positions only
- **THEN** `hero_position_stats` SHALL hold exactly two rows for that hero
  and their `pick_share` values SHALL sum to 1 within 1e-6

### Requirement: Stored pair statistics carry their symmetry

The build SHALL store matchups antisymmetrically, so that where rows exist
for both orders `advantage_adj(a, b) = −advantage_adj(b, a)` within 1e-6,
and SHALL store each synergy once, on the row whose `hero_id` is less than
its `ally_id` (data-model §4.4).

#### Scenario: A matchup pair

- **WHEN** `hero_matchups` holds rows for both `(a, b)` and `(b, a)`
- **THEN** their `advantage_adj` values SHALL sum to 0 within 1e-6

#### Scenario: A synergy pair

- **WHEN** heroes `a` and `b` have played together and `a < b`
- **THEN** `hero_synergies` SHALL hold the row `(a, b)` and SHALL NOT hold
  the row `(b, a)`

### Requirement: Sufficiency thresholds decide what may be suggested

The build SHALL set `sufficient` on a hero-position when its `n_eff` is at
least 500, and on a hero when the sum of `n_eff` over its positions is at
least 1000. Matchups and synergies SHALL carry no threshold (data-model
§4.5).

#### Scenario: At the position threshold

- **WHEN** a hero-position has `n_eff = 500`
- **THEN** its `sufficient` SHALL be `true`

#### Scenario: Below the position threshold

- **WHEN** a hero-position has `n_eff = 499`
- **THEN** its `sufficient` SHALL be `false`

#### Scenario: At the hero threshold

- **WHEN** a hero's `n_eff` over all its positions sums to 1000
- **THEN** its `sufficient` SHALL be `true`

### Requirement: A snapshot is published only after it validates

A snapshot SHALL be created with `status = 'building'` and SHALL reach
`status = 'published'` only after validation passes: the hero count is at
least the count in the newest published snapshot, the position shares of
every hero *that has any* sum to 1 within 1e-6, and every stored `adj` lies
within ±25 percentage points, and every measured component holds a row for
every hero, which *An unmeasured component is zero for every hero* states and
this requirement does not restate. A snapshot that fails any check SHALL be set to
`status = 'failed'`, and so SHALL one whose build raises before validation is
reached: `building` is a state a snapshot passes through, never one it is left
in (data-model §7.3–7.4).

A hero the reference tables know but staging holds no picks for has no
position rows at all, and SHALL NOT fail this check — it is a hero nobody
played in the window, not a broken distribution. WHERE no published snapshot
exists yet, the hero-count check SHALL pass: there is no count to fall below,
and a first snapshot that could never publish would leave the check with
nothing to compare against forever.

#### Scenario: Validation fails

- **IF** a build produces a hero whose position shares sum to 0.8
- **THEN** that snapshot SHALL end at `status = 'failed'`, and the newest
  `published` snapshot SHALL be the one that was newest before the build

#### Scenario: The first snapshot

- **WHEN** a build satisfies every check and no snapshot has ever been
  published
- **THEN** it SHALL publish, the hero-count check having nothing to compare
  against

#### Scenario: A hero nobody played

- **WHEN** a hero in the reference tables has no picks anywhere in staging
- **THEN** the snapshot SHALL hold no `hero_position_stats` row for it and
  SHALL still pass validation

#### Scenario: Validation passes

- **WHEN** a build satisfies every check
- **THEN** its snapshot SHALL end at `status = 'published'` and SHALL be the
  newest published one

#### Scenario: The build throws part-way

- **IF** the build raises before it reaches validation
- **THEN** the snapshot SHALL be set to `status = 'failed'` before the error
  propagates, and the newest `published` snapshot SHALL be the one that was
  newest before the build

### Requirement: Snapshot retention

The build SHALL keep the 30 most recent snapshots and SHALL delete the
older ones together with their statistics rows (data-model §3.2). It SHALL
additionally retain, whatever its age, the newest published snapshot of every
patch a blend may still read `wr_old` from — a count alone would be safe only
while builds are at most daily, and nothing in this change bounds how often
the job runs.

#### Scenario: The thirty-first snapshot

- **WHEN** a build completes while 30 snapshots already exist
- **THEN** 30 snapshots SHALL remain, the oldest by `snapshot_id` SHALL be
  gone, and no statistics row SHALL reference a missing `snapshot_id`

#### Scenario: Builds faster than the prior decays

- **WHEN** 30 snapshots are built within one day and the current patch is a
  letter patch detected 2 days ago
- **THEN** the newest published snapshot of the previous patch SHALL still be
  present, so the blend has the `wr_old` its prior still weighs
