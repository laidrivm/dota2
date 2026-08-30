# letter-patch-detection

## Why

The pipeline believes the game is on patch 7.41, released 2026-03-24. It has
been on 7.41e since 30 July. Five letter patches — 7.41a, b, c, d, e — passed
without the project noticing one of them.

The source is why. `api.opendota.com/api/constants/patch` holds 61 entries and
not a single letter patch, which `src/job/ingest/patches.ts:98` already says
in as many words: "The source lists majors only". The consequence was not
traced. Because a letter patch is never recorded, no patch boundary is ever
crossed between majors, so:

- the blend has run at exactly one boundary since March, and its letter-patch
  parameters — which `snapshot-build` has fixed all along — have never once
  been exercised;
- the thirty-day meta window silently spans letter boundaries, as it did on
  5 June across 7.41c and 7.41d;
- `meta_capped_by_source` is permanently true, so a flag meant to report that
  the source truncated the window no longer distinguishes anything.

Valve publishes every gameplay patch, letters included, as a Steam news post
carrying the version in its title. Measured over 100 posts spanning
2024-07-10 to 2026-08-27: filtering to Valve's own posts and requiring a
version in the title yields **20 hits, every one a patch, no false positive**.

## What Changes

- The patch list comes from Valve's Steam news feed instead of OpenDota, and
  the OpenDota integration goes with it — patch detection was the only thing
  it served.
- Letter patches are recorded, which is what lets a blend run at a letter
  boundary for the first time.
- The run reports how long it has been since a patch was detected, because a
  source read through a title is one that can stop matching without failing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `hero-reference`: its *Patches are detected from a source that is current*
  requirement names the source and what makes one usable, and gains a report
  on how long detection has been silent.
- `snapshot-build`: its *Patch blending with a decaying prior* requirement
  already fixes a letter patch's parameters and has never met one; it gains
  the scenario that exercises them.
- `snapshot-export`: its *The stabilizing flag* requirement says the flag is
  true exactly while the blend's prior still weighs. That held only because
  every detected patch was major; with letter patches detected the two
  windows part, and the claim is narrowed rather than left false.

## Non-goals

- **Reading the patch with a language model.** The scheme was considered:
  send the news items to the Claude API and have it name the patch and tell
  an announcement from a release. Two years of posts refuse it — the title
  always carries the version, and Valve has never once published a version
  ahead of the release, so there is no announcement to tell apart. It stays a
  documented upgrade with a stated trigger: the first time the rule stops
  finding a patch the watchdog below reports.
- **A second transport for the same feed.** `stratz.news` mirrors this feed —
  the same five items, the same titles, the same `feedName` values — so
  reading both guards against one endpoint being down and against nothing
  else. It also holds five items with no pagination, making it the weaker of
  the two.
- **Showing the stabilizing banner after a letter patch.** It stays a
  major-patch signal: a letter patch moves winrates gently. The behaviour is
  what is unchanged — the requirement itself is modified, because it claims
  the flag is true exactly while the blend's prior weighs, and that stops
  being true the moment a letter patch can be detected.
- **Fitting the blend parameters.** They are exercised here for the first
  time, not chosen. `outcome-calibration` is what will eventually score two
  bundles built under different ones.

## Impact

- `src/job/ingest/patches.ts` — the source, its parse and its ordering.
- `api.opendota.com` — removed as a network dependency of this project.
- `openspec/specs/hero-reference/spec.md`,
  `openspec/specs/snapshot-build/spec.md`,
  `openspec/specs/snapshot-export/spec.md` — one requirement modified each.
- `src/job/run.ts` — one more line in the run's report.
- No new package. No change to the bundle, the model, or anything served: the
  only visible difference is that `patch.id` becomes the patch being played.
