# letter-patch-detection — design

## Context

`patches.ts:15` reads `api.opendota.com/api/constants/patch`. That list holds
61 entries and no letter patch, which the module's own comment at line 98
records. The pipeline has therefore been on "7.41, released 2026-03-24" since
March while the game moved through 7.41a, b, c, d and e.

No endpoint is affected. Nothing here reaches the bundle beyond the value of
`patch.id`, which becomes the patch actually being played.

## Goals / Non-Goals

**Goals:** the current patch, letters included, from one source, with the
release instant it was published at; and a report when detection goes quiet.

**Non-Goals:** as the proposal fixes them — no language model, no second
transport, no banner for letter patches, no fitting of the blend parameters.

## Decisions

### The source is Valve's Steam news feed, and OpenDota goes

Four routes were measured on 2026-08-30:

```text
OpenDota /api/constants/patch    61 entries, zero letters, current       in use
STRATZ constants.gameVersions    has letters, newest 7.40b (2025-12-24)   stale
MatchType.gameVersionId          182 = 7.40b on a match from 2026-08-29   pinned
Steam ISteamNews appid 570       every patch, letters included            taken
```

The middle two are dead: STRATZ's version table stopped eight months ago and
stamps every recent match with the last id it knows. Steam's feed is the one
that carries what the game is on.

OpenDota served patch detection and nothing else — icons come from
`cdn.cloudflare.steamstatic.com` directly (`icons.ts:51`), and no other module
mentions it. Since the news feed carries majors too, keeping OpenDota beside
it would be a second source for a job one already does.

### The response shape, and the ordering that inverts with it

```text
{ "appnews": { "appid": 570, "newsitems": [ {
    "gid": "…", "title": "7.41d Gameplay Patch", "url": "…",
    "is_external_url": true, "author": "kyled",
    "contents": "…", "feedlabel": "Community Announcements",
    "date": 1780617600, "feedname": "steam_community_announcements",
    "feed_type": 1, "appid": 570 } , … ] } }
```

Three things the current parse gets wrong against it. `patches.ts` takes a
top-level array; this is an envelope, and `newsitems` is the array. It reads
`entry.date` as a string through `new Date(String(...))`; this is unix
**seconds**, and reading them as milliseconds dates every patch to 1970
without failing. And it selects `listed[listed.length - 1]` because
OpenDota listed oldest first; **Steam lists newest first** — item 0 dated
2026-08-27 against a last item dated 2024-07-10 — so the same index now
picks a patch two years stale.

`count` bounds the window rather than paginating: `count=100` reaches back to
2024-07-10, twenty patches. There is no cursor and none is needed — the run
is nightly and only ever asks what the newest patch is.

### The rule is a feed test and a version, not a language model

Measured over 100 posts spanning 2024-07-10 to 2026-08-27:

```text
                                                     hits   patches   false
Valve's own feed AND a version in the title            20        20       0
```

Every gameplay patch in the window is there — 7.41e, d, c, b, a, 7.41, 7.40c,
7.40b, 7.40, 7.39e, c, b, 7.38c, b, 7.38, 7.37e, d, c, b, 7.37 — under titles
that vary freely: `7.41d Gameplay Patch`, `Gameplay Patch 7.41e and Summer
Scrub`, `Introducing Largo and Patch 7.40`, `Update 7.37 Is Here`. The version
is the one thing every title carries.

Both halves of the rule earn their place. Press coverage carries versions in
titles too and would have produced four false hits, each dated a day after
the release — `feedname` removes them. Valve's own posts without a version
(`Dota 2 Update - 7/1/2026`, tournament announcements) are correctly refused
by the version half.

A language model was the alternative, and its strongest argument was telling
an announcement from a release. Over the same 100 posts, no Valve title
carrying a version also carries `coming`, `soon`, `next`, `arrives`,
`announcing`, `preview` or `teaser`: Valve publishes the version on the day,
never before. The distinction has nothing to distinguish. What remains is a
non-deterministic paid call in the nightly path, a prompt to maintain, and
output that would need validating for shape and order anyway — which is most
of the deterministic path rewritten.

### A version with no letter comes first

`7.41 < 7.41a < 7.41b`. Confirmed against the version list on
`dota2.com/patches/7.41e`, which orders exactly that way. Ordering is on the
numeric parts first, then the letter with the empty string lowest — the one
piece of arithmetic here, and the one worth a case per boundary.

### A watchdog, because this source can fail silently

The previous source did not break. It answered every night, parsed cleanly,
and returned a patch five releases old. Nothing failed, so nothing reported.

A rule matching on the text of a title has the same shape of failure: Valve
retitles, the request still succeeds, the parse finds nothing, `detected_at`
stops moving. The only thing that would notice is a count of days since the
newest held patch. Over the measured window the gaps between gameplay patches
run 100, 91, 75, 63, 61, 55 days and down, so a bound has a distribution to
sit above rather than a guess — 120 days, set in the requirement.

### Blending at a letter boundary is shipped unverified, deliberately

`snapshot-build` has always fixed `k0 = 3000, h = 2, t_max = 7` for a letter
patch, and no build has ever met one. This change is what lets that branch
run — and it cannot be demonstrated on production data until the next patch
lands, because 7.41e is 31 days old and `prior(31)` is 0 whatever the
parameters.

The parameters are coherent rather than arbitrary, which is why they ship as
they are: a major changes the game enough that old winrates stop applying, so
its prior is smaller and decays faster; a letter changes less, so the previous
patch's data stays usable longer. Fitting them is `outcome-calibration`'s to
enable — it scores two bundles over one set of matches, which is what a
comparison between parameter sets needs.

## Risks / Trade-offs

- **The acceptance criterion for a first-day letter blend cannot be checked
  before the next patch.** → It is written as a criterion and covered by a
  test against a constructed patch pair; what waits for a real patch is the
  observation in production, and `tasks.md` says which task that is.
- **One source, and it is parsed rather than structured.** Dropping OpenDota
  removes the fallback. → The watchdog is the compensation: a silent failure
  becomes a reported one, which is strictly better than today, where the
  fallback existed and was itself the thing that was wrong.
- **The post instant is not always the patch instant.** Steam dates 7.41d at
  2026-06-05 where the wiki says 4 June. At a `t_max` of 7 days a day's error
  is a seventh of the window. → Accepted: the post is the earliest public
  instant this project can observe, and the alternative is a source that does
  not exist.
- **`stabilizing` still requires a major.** A letter patch now moves
  `detected_at` without raising the banner, which is deliberate — but it means
  the banner and the blend no longer share a window, where
  `snapshot-export`'s requirement describes them as the same one. That
  requirement's wording is checked in this change rather than assumed.

## Open Questions

- Nothing outstanding. The watchdog's bound was the last open figure and is
  settled at 120 days in *The run reports how long detection has been
  silent*, against a measured maximum gap of 100.
