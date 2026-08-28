# hero-tile-icon — tasks

One group, so this change ships whole on `feat/hero-tile-icon`. It closes two
acceptance criteria, both new in this change's delta: *The image is drawn* and
*The image does not load*.

The delta's other four — *Abbreviation*, *Ink follows the background*, *Hero
missing from the palette*, *Hero missing from the snapshot* — are carried by the
`MODIFIED` copy rather than closed here: `draft-board` closed them already and
the code's behaviour does not move. Each is cited below by the task that must
leave it standing.

*Ink follows the background* is the one with a caveat, and it is about the spec
rather than the code: the live requirement's crossover figure has disagreed with
`format.ts` since `1b85ee5`, so the delta writes the one the code has and
`format.test.ts` already pins. Read the figure there and nowhere else. No task
changes a threshold, because no threshold is wrong.

Every test a task below asks for carries a `// spec:` citation naming the
criterion it closes, per `docs/testing.md` §*Citing the criterion a test
closes*. The two identifiers are `draft-board/the-image-is-drawn` and
`draft-board/the-image-does-not-load`; a delta spec's criteria may be cited
before they are live, and they join `scripts/spec-coverage.ts`'s count at
archive — uncited, they would raise it past `FLOOR` and fail the check.

## 1. The tile draws the hero

- [x] 1.1 Add `iconSrc(icon: unknown): string | null` to
      `src/app/board/format.ts` — returns the value when it matches
      `/^\/icons\/[a-z0-9_-]+\.png$/` and `null` for everything else, `undefined`
      and the empty string included. It never throws: an absent `icon` is a
      state the tile renders, not an error. It sits with the board's other
      non-DOM branches and is the only place the payload's `icon` is trusted
      (*The image is drawn*, *The image does not load*)
- [x] 1.2 Cover it in `src/app/board/format.test.ts` before 1.3 exists, as the
      contract the tile will lean on: `undefined` and `""` yield `null`;
      `/icons/pudge.png` comes back unchanged; `/icons/bounty_hunter.png` is
      accepted, since the underscore is what the ingest writes where the
      fixture's `short` beside it reads `bounty-hunter`; `/icons/.png` yields
      `null`. Refused, each on its own case: `/icons/../../etc/passwd.png`,
      an absolute `https://` URL to the mirror's own upstream,
      `/icons/pudge.png?v=2`, `/icons/Pudge.PNG`, and `/icons/pudge.png\n` —
      the last is what says the pattern is anchored at both ends and not only
      at the start (*The image is drawn*, *The image does not load*)
- [x] 1.3 Render the image in `src/app/board/hero-tile.tsx`: the span keeps its
      background and its abbreviation, and an `<img src>` from 1.1 is laid over
      them with `alt=""`, `loading="lazy"` and `decoding="async"`. `null` from
      1.1 renders no element at all. The five call sites and their props do not
      change (*The image is drawn*)
- [x] 1.4 Reveal the image only once it has loaded: the tile holds the `src`
      that fired `load`, the image is styled `opacity: 0` and becomes visible
      when that state equals the `src` it is currently asking for. There is no
      `onError` — a failure never reaches the state that reveals the element, so
      no frame between the failure and a handler can paint a broken-image
      affordance. The state is the `src` and not a boolean, which Preact's reuse
      of a slot's component instance would carry from one hero to the next
      (*The image does not load*)
- [x] 1.5 Size and crop the image in `src/app/board/hero-tile.module.css`:
      absolutely positioned to fill the tile, `object-fit: cover`, centre
      `object-position`, so the 256×144 source is cropped to the square at all
      three sizes and no row's geometry moves. Every value stays a token
      reference or a keyword — `app-shell` §*Style values come from design
      tokens* is unchanged by this (*The image is drawn*)
- [x] 1.6 Confirm by reading the component that the four carried criteria still
      hold with an image present: the abbreviation is still `heroAbbr(name)`
      (*Abbreviation*), the ink still comes from `tileInk` on the resolved token
      (*Ink follows the background*), an unknown slug still resolves
      `--hero-fallback` through the same `var()` (*Hero missing from the
      palette*), and `hero === undefined` still renders the `fallback` slug with
      an empty abbreviation and no image (*Hero missing from the snapshot*)
- [x] 1.7 Extend `e2e/board.spec.ts` with the browser half, the states side by
      side against a routed snapshot: a hero whose image loads shows it with no
      visible abbreviation; a hero whose image request is failed by the route
      shows the abbreviation over its palette square; a slot whose hero is
      replaced after a failure shows the replacement's image. Cover the window
      1.4 exists to close, not only the state after it — hold the image request
      open, assert the tile shows its square and no broken-image affordance
      *while* the request is in flight, then fail it and assert the same. Assert
      the accessible names with it: a tile given a `label` exposes exactly one
      name and the image contributes none, and a tile in a row that already
      names its hero stays out of the accessibility tree (*The image is drawn*,
      *The image does not load*)
- [x] 1.8 Assert in `e2e/board.spec.ts` that opening the picker on an empty
      query renders every match and that every tile image carries
      `loading="lazy"`. The mirror is 127 files and 8.6 MB, which is why the
      attribute is there — but it is a hint a conforming user agent may decline,
      so what the suite checks is the request the application makes and not the
      traffic that follows. Neither a request count nor an inequality over one
      (*The image is drawn*)
- [x] 1.9 Add to `e2e/static-build.spec.ts` that the served `dist/`, which
      carries no `icons/`, renders the board as palette squares throughout. This
      is the case a fresh clone is in as well, and it is what keeps `app-shell`
      §*Static production build* true (*The image does not load*)
- [ ] 1.10 Close this change's entry in `PLAN.md`'s Open queue in the pull
      request that implements it, and leave behind, as its own entry, the
      slug-mismatch decision `proposal.md` §*Non-goals* declines
- [ ] 1.11 Carry this note forward to the archive rather than acting on it: no
      pull request of this change edits `openspec/specs/draft-board/spec.md`,
      and the sync copies requirements and nothing else, so its §*Purpose* — "and
      how the hero tile derives its colour and ink from the design tokens", true
      of the fallback alone once this lands — is reworded by `/opsx:archive`,
      which is where that file is written
- [ ] 1.12 Run the pre-PR sequence from `docs/review-toolkit.md`, in its order.
      `bun test`, `bun run lint`, `bun run typecheck` and `bun run diff-budget`
      are part of it and none of them is the whole of it
