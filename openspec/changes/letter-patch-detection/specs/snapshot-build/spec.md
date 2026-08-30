# snapshot-build delta — letter-patch-detection

## MODIFIED Requirements

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

#### Scenario: A letter patch on its first day

- **WHEN** a build runs on the day a letter patch was released, its
  predecessor being the patch before it
- **THEN** `prior(t)` SHALL be `k0 = 3000` and the previous patch's smoothed
  winrate SHALL weigh on every blended statistic

This is the parameter set the requirement has always fixed and no build has
ever reached: until `letter-patch-detection`, no letter patch was recorded,
so `t` was always measured from a major and this branch never ran.
