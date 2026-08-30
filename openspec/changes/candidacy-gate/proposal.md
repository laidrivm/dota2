# candidacy-gate

## Why

The picker suggests heroes for roles nobody plays them in.

Reported from use: Phantom Lancer offered as a top-three offlane pick. The
live bundle says why. Its position-3 entry carries `share: 0.0035` — 0.35% of
its games — with `sufficient: true` and a meta that read −0.54 on one day and
−0.70 the next, and the only test a candidate faces is `share(h, r) > 0`. Any
role a hero has ever been played in is a role the picker will recommend.

`sufficient` does not catch it and was never meant to. It fires at
`n_eff >= 500`, an absolute-sample test that answers "is this winrate worth
believing". The meta window is thirty days — `SOURCE_DAYS` in
`src/job/ingest/meta.ts`, capped by what the endpoint serves rather than
chosen — and thirty days of Divine and Immortal is enough that 0.35% of a
popular hero's games clears 500 comfortably. The number is believable; the
role is not one anybody picks. Two different questions, and the model asks
only the first.

That meta shows the second cost. Smoothing pulls a thin sample towards
neutral, so a role the hero genuinely loses reads as barely below average
rather than as the mistake it is — small enough to be outweighed by any other
component. dota2protracker, reading the same STRATZ data at 7000–8500 MMR
over eight days, shows 22 matches at 41% for that role — a different window
and bracket from the bundle's, so not a figure to compare against directly,
but not one a −0.6 describes either.

## What Changes

- A candidate is scored for a role only when the hero is played in that role
  often enough to be worth suggesting, not merely often enough to be counted.
- The threshold governs what is suggested and nothing else. What the model
  believes about an enemy's likely role, and which heroes it treats as
  possible future enemy picks, are unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `draft-model`: its *Suggestion scoring* requirement fixes the candidate set
  at `share(h, r) > 0`, which is the whole of the defect.

## Non-goals

- **The double-counted hero strength.** Phantom Lancer reached the top three
  on a synergy term that carries each hero's own strength once per ally; this
  gate removes him from the role, and `score-calibration` is what stops the
  term inflating whoever remains.
- **Changing `sufficient`.** It answers a different question and answers it
  correctly. Loosening or tightening it would move which winrates are
  believed, which is not this change's business.
- **Hiding the hero.** Phantom Lancer stays suggestible at position 1, where
  99.1% of his games are. Nothing is removed from the picker, which lists
  every hero whatever the model thinks.
- **A per-role or per-hero exception list.** One threshold, no exemptions.

## Impact

- `src/types.ts` — one constant joins `MODEL_CONSTANTS`.
- `src/model.ts` — one comparison, at the candidate filter and nowhere else.
- `openspec/specs/mutation-floor/` — Stryker is scoped to `src/model.ts`
  alone, so this change moves the floor and the change carries the move.
- `src/fixtures/snapshot.json` — unchanged. No position in it falls below the
  threshold, so no existing case changes its answer.
- No change to the bundle, the schema, the job, or anything served.
