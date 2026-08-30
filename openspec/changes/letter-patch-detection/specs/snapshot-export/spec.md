# snapshot-export delta — letter-patch-detection

## MODIFIED Requirements

### Requirement: The stabilizing flag marks a settling major patch

The export SHALL set `stabilizing` to `true` while the snapshot's patch is
major and fewer whole days have passed from its `detected_at` to the
snapshot's `created_at` than the `t_max` *Patch blending with a decaying
prior* fixes for a major patch, and to `false` otherwise. The window is that
requirement's, not a second copy of it.

The flag is therefore narrower than the blend, and this change is what makes
the difference reachable. Before it no letter patch was ever recorded, so
every patch was major and "true exactly while the prior still weighs" held by
accident. With letter patches detected, a letter patch's prior weighs for its
own `t_max` while `stabilizing` stays `false` throughout — deliberately: the
banner tells a player the data is unsettled, and a letter patch moves
winrates gently enough that it is not.

#### Scenario: A letter patch whose prior still weighs

- **WHEN** the snapshot's patch is a letter patch released within its own
  `t_max`, so the blend is still weighing its predecessor
- **THEN** the bundle's `stabilizing` SHALL be `false`, the flag tracking the
  major window and not the blend's

#### Scenario: The day a major patch lands

- **WHEN** the snapshot's patch is major and `created_at` is on its
  `detected_at` day
- **THEN** the bundle's `stabilizing` SHALL be `true`

#### Scenario: The window has passed

- **WHEN** the snapshot's patch is major and `created_at` is `t_max` whole
  UTC days after its `detected_at`
- **THEN** the bundle's `stabilizing` SHALL be `false`

#### Scenario: An offset that crosses the UTC day

- **WHEN** a major patch's `detected_at` is `2026-07-14` and the snapshot's
  `created_at` is `2026-07-18T00:30:00+05:00`, which is
  `2026-07-17T19:30:00Z` — three whole days past the anchor `2026-07-14T00:00:00Z`,
  where reading the offset as a local date would give four — at a `t_max` of 4
- **THEN** the bundle's `stabilizing` SHALL be `true`, because `t` is 3

#### Scenario: A letter patch

- **WHEN** the snapshot's patch is not major
- **THEN** the bundle's `stabilizing` SHALL be `false`
