# hero-tile-icon — tasks

One group, so this change ships whole on `feat/hero-tile-icon`. It closes two
acceptance criteria, both new in this change's delta: *The image is drawn* and
*The image does not resolve*.

The delta's other four — *Abbreviation*, *Ink follows the background*, *Hero
missing from the palette*, *Hero missing from the snapshot* — are carried by the
`MODIFIED` copy rather than closed here: `draft-board` closed them already and
their behaviour does not move. Each is cited below by the task that must leave it
standing.

## 1. The tile draws the hero

- [ ] 1.1 Add `iconSrc(icon: unknown): string | null` to
      `src/app/board/format.ts` — returns the value when it matches
      `/^\/icons\/[a-z0-9_-]+\.png$/`, `null` otherwise, throwing on nothing.
      It sits with the board's other non-DOM branches and is the only place the
      payload's `icon` is trusted (*The image is drawn*, *The image does not
      resolve*)
- [ ] 1.2 Cover it in `src/app/board/format.test.ts` before 1.3 exists, as the
      contract the tile will lean on: `undefined` and `""` yield `null`;
      `/icons/pudge.png` comes back unchanged; `/icons/bounty_hunter.png` is
      accepted, since the underscore is what the ingest writes where the
      fixture's `short` beside it reads `bounty-hunter`; `/icons/.png` yields
      `null`. Refused, each on its own case: `/icons/../../etc/passwd.png`,
      an absolute `https://` URL to the mirror's own upstream,
      `/icons/pudge.png?v=2`, `/icons/Pudge.PNG`, and `/icons/pudge.png\n` —
      the last is what says the pattern is anchored at both ends and not only
      at the start (*The image is drawn*, *The image does not resolve*)
- [ ] 1.3 Render the image in `src/app/board/hero-tile.tsx`: the span keeps its
      background and its abbreviation, and an `<img src>` from 1.1 is laid over
      them with `alt=""`, `loading="lazy"` and `decoding="async"`. `null` from
      1.1 renders no element at all. The five call sites and their props do not
      change (*The image is drawn*)
- [ ] 1.4 Hold the failed source in per-tile state as the `src` string that
      failed, compared against the current one — not a boolean, which Preact's
      reuse of a slot's component instance would carry from one hero to the
      next. `onError` records it; a recorded source suppresses the element
      (*The image does not resolve*)
- [ ] 1.5 Size and crop the image in `src/app/board/hero-tile.module.css`:
      absolutely positioned to fill the tile, `object-fit: cover`, centre
      `object-position`, so the 256×144 source is cropped to the square at all
      three sizes and no row's geometry moves. Every value stays a token
      reference or a keyword — `app-shell` §*Style values come from design
      tokens* is unchanged by this (*The image is drawn*)
- [ ] 1.6 Confirm by reading the component that the four carried criteria still
      hold with an image present: the abbreviation is still `heroAbbr(name)`
      (*Abbreviation*), the ink still comes from `tileInk` on the resolved token
      (*Ink follows the background*), an unknown slug still resolves
      `--hero-fallback` through the same `var()` (*Hero missing from the
      palette*), and `hero === undefined` still renders the `fallback` slug with
      an empty abbreviation and no image (*Hero missing from the snapshot*)
- [ ] 1.7 Extend `e2e/board.spec.ts` with the browser half, the two states side
      by side against a routed snapshot: a hero whose icon resolves shows the
      image and no visible abbreviation; a hero whose icon answers 404 shows the
      abbreviation over its palette square and presents no broken-image
      affordance; a slot whose hero is replaced after a failure shows the
      replacement's image. Assert the accessible names with it — a tile given a
      `label` exposes exactly one name and the image contributes none, and a
      tile in a row that already names its hero stays out of the accessibility
      tree (*The image is drawn*, *The image does not resolve*)
- [ ] 1.8 Add the picker's request count to `e2e/board.spec.ts`: opening the
      picker on an empty query renders every match and fetches fewer images than
      there are matches. The mirror is 127 files and 8.6 MB, which is what
      `loading="lazy"` exists here to keep off the first paint (*The image is
      drawn*)
- [ ] 1.9 Add to `e2e/static-build.spec.ts` that the served `dist/`, which
      carries no `icons/`, renders the board as palette squares throughout. This
      is the case a fresh clone is in as well, and it is what keeps `app-shell`
      §*Static production build* true (*The image does not resolve*)
- [ ] 1.10 Close this change's entry in `PLAN.md`'s Open queue in the pull
      request that implements it, and leave behind, as its own entry, the
      slug-mismatch decision `proposal.md` §*Non-goals* declines
- [ ] 1.11 Record for the sync — which copies requirements and nothing else —
      that `openspec/specs/draft-board/spec.md` §*Purpose* ends "and how the
      hero tile derives its colour and ink from the design tokens", a sentence
      that after this change describes only the fallback and is reworded when
      the change is archived
- [ ] 1.12 Run the pre-PR sequence from `docs/review-toolkit.md`, in its order.
      `bun test`, `bun run lint`, `bun run typecheck` and `bun run diff-budget`
      are part of it and none of them is the whole of it
