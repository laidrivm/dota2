# letter-patch-detection — tasks

Four steps, four pull requests, in this order. Each names the criteria it
closes by their `<capability>/<scenario-slug>` identifiers.

Three `MODIFIED` deltas carry sixteen criteria this change does not close —
every scenario the three requirements already had. They are copied whole
because a `MODIFIED` delta replaces a requirement rather than patching it,
and tests on `main` close them. Two change meaning and are re-verified in the
step that touches them: `hero-reference/a-patch-the-table-lacks`, whose
source now lists newest-first, and `snapshot-export/a-letter-patch`, which
now describes a state a run can actually reach.

## 1. The source and the rule

Closes `hero-reference/valve-s-own-post-names-a-patch`,
`hero-reference/press-coverage-is-not-a-patch`,
`hero-reference/a-valve-post-with-no-version`.

- [ ] 1.1 Write the failing cases first against a recorded feed, the way
      `patches.test.ts` already fakes the transport (ZOMBIES 1, 2, 3, 11, 12,
      14, 15, 16, 17): a Valve item with a version yields the patch and its
      instant; a press item carrying one does not; a Valve item without one
      does not; an item with no `feedname` is refused rather than defaulting
      into Valve's feed; a title carrying `2.0` or a date like `7/1/2026`
      yields no patch; a feed with no patch item at all fails the run.
- [ ] 1.2 Filter on `feedname`, never `feedlabel` (ZOMBIES 11). The 7.41e
      post carries `feedlabel` of `Community Announcements`, which the
      tournament announcements carry too; `feedname` is what separates them.
- [ ] 1.3 Read `date` as unix **seconds** (ZOMBIES 12). Read as milliseconds
      every patch dates to 1970 and the insert succeeds without complaint,
      which is the failure mode this whole change exists to stop repeating.
- [ ] 1.4 Point the module at
      `api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=570&count=100`
      and delete the OpenDota constant. Assert no module reaches
      `api.opendota.com` afterwards (ZOMBIES 13).

## 2. Which entry names the patch

Closes `hero-reference/a-version-with-no-letter-precedes-its-a`.

- [ ] 2.1 Write the failing cases first (ZOMBIES 4, 5, 6, 7, 8, 10): twenty
      patch items yield the newest; two sharing a date resolve by version
      order; `7.41` sorts before `7.41a`; `7.41z` sorts before `7.42`; a feed
      whose oldest item is newer than the held patch leaves that patch
      current rather than reading its absence as a change.
- [ ] 2.2 Rewrite `patches.test.ts:210` (ZOMBIES 19). It asserts "the patch
      detected is the one the list ends on", and its comment argues for
      trusting the source's order over a date. Steam lists newest **first** —
      item 0 dated 2026-08-27 against a last item dated 2024-07-10 — so both
      the assertion and its reasoning invert. Which entry names the patch is
      still worth pinning, so it is rewritten rather than deleted.
- [ ] 2.3 Order versions by the numeric parts first, then the letter with the
      empty string lowest. This is the arithmetic of the change and the one
      place a boundary case earns a test per boundary.

## 3. The watchdog

Closes `hero-reference/detection-has-gone-quiet`,
`hero-reference/a-gap-inside-the-bound`.

- [ ] 3.1 Write the failing cases first (ZOMBIES 9, 18): a patch older than
      the bound reports as a failure naming the patch and the gap; one a day
      inside it reports the gap and continues; a database holding no patch at
      all does not fire, there being no instant to count from.
- [ ] 3.2 Report whole days since the newest held patch's release instant in
      the run's report, and fail past the bound. The bound is one constant
      with `design.md`'s ninety-day reading cited, not restated.
- [ ] 3.3 Re-verify `hero-reference/a-patch-the-table-lacks` and the four
      other carried criteria of that requirement against the new source.

## 4. The first letter blend

Closes `snapshot-build/a-letter-patch-on-its-first-day`.

**This step's criterion cannot be observed on production data until the next
patch lands.** 7.41e is 31 days old and `prior(31)` is 0 whatever the
parameters, so a run today shows nothing whichever way the branch behaves.
The criterion is met by a test over a constructed patch pair; what waits is
the observation, and that is stated here rather than discovered later.

- [ ] 4.1 Write the failing cases first over a constructed pair (ZOMBIES 21,
      22, 23, 24): a build on a letter patch's release day weighs its
      predecessor at `k0 = 3000`; `t = 6` still weighs and `t = 7` does not;
      `t = 2` gives half `k0`, the half-life being 2 days against a major's
      1; a letter patch whose predecessor is a major blends against that
      major.
- [ ] 4.2 Change no blend code. `snapshot-build` has fixed these parameters
      all along and `blend.ts` implements them; this step is the first thing
      to reach the branch, not a new branch.
- [ ] 4.3 Assert the flag and the blend have parted (ZOMBIES 25): a letter
      patch inside its own `t_max` carries `stabilizing: false` while its
      prior still weighs. The two windows coincided only while every detected
      patch was major, and `snapshot-export`'s delta says so.
- [ ] 4.4 Record, in this step's pull request, that the first-day blend is
      unobserved in production and which patch will first exercise it.
- [ ] 4.5 Confirm the bundle now reports the patch being played (ZOMBIES 20):
      a run over a recorded copy of the real feed yields `7.41e` released
      2026-07-30, against the `7.41` of 2026-03-24 it reports today.
- [ ] 4.6 Update `PLAN.md`'s queue in this step's pull request, not
      afterwards.
- [ ] 4.7 Run the pre-PR sequence per `docs/review-toolkit.md` on every step.
      Steps 1 to 4 all touch the database, so each one's suite must assert it
      ran rather than skipping; `patches` is reclaimed by the sentinel
      `patch_id LIKE 'z9.%'`, which every constructed patch must use.
