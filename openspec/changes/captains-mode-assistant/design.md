# captains-mode-assistant — design

## Context

- The All Pick page is a static Preact bundle built from `index.html`; the
  server (`src/server/server.ts`) is `Bun.serve` with `routes` for fonts,
  icons and `/snapshot.json`, and a `fetch` fallback that serves `dist/` by
  listing. It opens no database connection and reads its configuration from
  the host's `.env` through `docker-compose.yml`.
- The snapshot already carries what a CM model needs per hero: meta per
  position with position shares, side and pick-phase deltas, and full
  matchup and synergy matrices, all in percentage points around 50. Side and
  phase are 0 for every hero on the live bundle until `match-harvest` and
  `side-and-phase-deltas` land; this design reads them where they exist and
  depends on neither change.
- `src/model.ts` holds the All Pick model, including the lane-weighted
  matchup component (`MODEL_CONSTANTS.laneWeights`) this design reuses.
- dota2protracker (d2pt) serves its meta as a SvelteKit data file,
  `/meta/__data.json?mmr=7000&position=pos+N&period=patch&meta_period=patch`,
  in `devalue`'s flattened form. Inspected 2026-11-27 in a browser: per hero
  and position it carries `hero_id`, `tier`, `d2pt_rating` (0–100, null for a
  hero not rated there), `matches`, `win_rate`, and per pick phase
  `phase_1_matches`/`phase_1_wins` … `phase_3_*`. The site sits behind
  Cloudflare's bot check: the browser passes it, a server-side request does
  not.

## Goals / Non-Goals

**Goals:** a password-guarded `/cm` page that mirrors a CM draft, ranks bans
and picks for the step in progress with a lookahead over the CM order, and
uses d2pt's hero strength when the captain has uploaded it.

**Non-Goals:** the proposal's list stands; nothing here adds to it.

## Decisions

### D1. The password guards the API, not the page's code

`/cm` and its scripts are served without a session; every `/api/cm/` route
but sign-in needs one, and the page shows only the password form until
`GET /api/cm/session` answers 200. The code is in a public repository and
the snapshot is public, so hiding the bundle protects nothing; what is worth
guarding is the API — the upload in this change, and the paid model calls
the third delivery adds. Gating hashed assets would also mean telling apart
chunks Bun shares between the two entry points, which the listing-based
`distFile` cannot do cleanly.

*Alternative:* gate `/cm` and its assets with the session. Rejected for the
cost above and because it guards public data.

### D2. One password, a stateless signed cookie

The session cookie is `<expiry seconds>.<base64url HMAC-SHA256>` of
`cm-session:<expiry>` keyed by `CM_PASSWORD`. Verifying needs no store, the
server can restart freely, and changing the password invalidates every
session at once (cm-access, *A changed password ends every session*). A
password under 12 characters counts as unset: a short password on a public
host is not one the deployment should run with, and closing is the safe
failure. The wrong-password limit is global, not per address — one captain
uses this, and the address behind the shared reverse proxy is the proxy's
unless forwarded headers are trusted, which would let a caller pick its own.

*Alternative:* server-side sessions in a table or a file. Rejected: a store
for one user's cookie, and the server has no database connection to keep.

### D3. Hono for the API, mounted beside the existing routes

`Bun.serve` keeps `routes` for the static paths; its `fetch` hands `/api/cm`
and `/api/cm/*` to a Hono app and everything else to `distFile` as now. Hono brings the
middleware order the API needs (origin check, then configuration, then
session), typed handlers, and the SSE helper the report delivery will use.
`zod` provides the request and response schemas `harness/api-design.md`
requires; Hono's validator takes them directly. Both are dependencies of the
production stage.

*Alternatives:* plain `Bun.serve` routes — no dependency, but middleware,
validation and problem responses by hand for every route; Elysia — Bun-only,
more machinery, and its speed is not this API's bottleneck.

### D4. API contracts

All errors are `application/problem+json`:
`{"type":"about:blank","title":<string>,"status":<int>,"detail":<string>,
"code":<string>,"action":<string|null>}`. No `/api/cm/` response sets CORS
headers; an `Origin` other than the request's own host answers 403
`cross-origin` first (D2's cookie is `SameSite=Strict`; this is the second
line). Every response carries `Cache-Control: no-store`, since each is about
a session or sets one. The sign-in body, the one open to anyone, is capped
at 1 KB and answers 413 `too-large` past it, so an unauthenticated caller
cannot make the server buffer Bun's 128 MB default. Unmatched paths, once
signed in, answer 404 `not-found`, and a thrown error 500 `internal`, logged.
These came out of step 1's review; they protect the routes the specs name
without adding behaviour a client relies on, so they sit here rather than
in the delta specs, which apply does not edit.

| Route | Body | 2xx | Codes |
| --- | --- | --- | --- |
| `POST /api/cm/session` | `{"password": string}` | 204 + cookie | 401 `wrong-password`, 429 `too-many-attempts`, 422 `invalid-body` |
| `GET /api/cm/session` | — | 200 `{"signedIn": true, "expiresAt": string}` | 401 `not-signed-in` |
| `DELETE /api/cm/session` | — | 204, cookie cleared | 401 `not-signed-in` |
| `POST /api/cm/meta` | d2pt data file, ≤ 5 MB | 200 `{"position": 1–5, "heroes": int, "patch": string, "uploadedAt": string}` | 413 `too-large`, 422 `not-d2pt-meta`, 401 |
| `GET /api/cm/meta` | — | 200 `{"positions": {"1": Meta \| null, …, "5": …}}` | 401 |

`Meta` is `{"patch": string, "uploadedAt": string, "heroes": {"<id>":
{"rating": number|null, "tier": string|null, "matches": int, "winRate":
number, "phaseWinRates": {"first": number|null, "second": number|null,
"last": number|null}}}}`. Hero ids appear only as map keys inside the
payload and no endpoint accepts one, so the UUIDv7 rule does not apply to
them. Every route above also answers 503 `cm-not-configured` and 403
`cross-origin`. The checks run in the order origin, configuration, session,
route, so a `/api/cm/*` path not in the table answers 401 signed out and 404
problem `not-found` signed in.

### D5. d2pt meta reaches the server through the captain's browser

The page lists the five d2pt data-file URLs; the captain opens each in the
same browser that browses d2pt, saves it, and drops the files on the page,
which posts each one. The server decodes it with `devalue`'s `unflatten`,
reads the meta rows, validates them (cm-meta-import) and writes
`<CM_DATA_DIR>/meta-pos-<n>.json` atomically (write to a temporary name,
then rename). The patch label is the data file's `patch` field.

Nothing on the server requests d2pt. A server-side fetch would have to
defeat a bot check placed there to stop exactly that, and this project does
not build that. A link the captain follows is navigation, not a request the
page makes, so *No third-party runtime requests* still holds.

*Alternatives:* a headless browser on the host passing the check —
rejected above; STRATZ meta only — kept as the fallback, but the brief asks
for d2pt's rating.

### D6. The engine runs in the browser, in a Web Worker

Everything the v1 model reads is on the client already: the public snapshot,
the rosters typed on the page, and the meta it fetches once from
`/api/cm/meta`. Running the search there keeps it a pure module under
`src/cm/engine/`, testable and mutation-tested like `src/model.ts`, with no
endpoint to design for it. The worker receives `{stateId, draft, rosters,
data}` and posts `{stateId, depth, suggestions}`; the page drops any message
whose `stateId` is not the latest, and terminates and restarts the worker
when a newer state arrives mid-search (cm-model, *A newer draft state
replaces the search*). Player profiles in the second delivery live on the
server; the search can move there then if they make it heavier.

### D7. Value and assignment

Units are percentage points, the snapshot's own, so every component reads
like the All Pick page's breakdown. For a team, with `σ` the assignment of
its heroes to positions:

```text
V(team) = Σ_h ρ(p_σ(h)) · (meta(h, σ(h)) + comfort(p_σ(h), h))
        + Σ_h side(h, team side) + Σ_h phase(h, CM phase of h)
        + Σ_{pairs a<b} syn[a][b]
        + matchups(team heroes at σ, enemy heroes at σ_enemy)
E = V(captain) − V(enemy)
```

- `comfort` is 3.0 pp per signature hero — about the gap between a top-tier
  and a mid-tier hero's meta at a position on the current snapshot, so a
  signature lifts a playable hero over a slightly stronger unfamiliar one
  without making a bad hero a pick. The second delivery replaces it with a
  shrunken personal winrate.
- `ρ` weights a slot by its player's rank against the team's mean, 0.1 per
  rank tier, clamped to [0.75, 1.25] — the brief's "the higher the rank, the
  more impact", bounded so one strong player cannot dominate the draft.
- `σ` is the best of every assignment of the team's heroes to its open
  positions (at most 5! = 120), players' known positions fixed. A hero
  counts as playable where its snapshot share is ≥ 0.05 — or, at a position
  with uploaded meta, where the upload rates it (D9); elsewhere it costs
  −10 pp meta, which keeps an assignment defined when a captain enters an
  off-role pick. The enemy is assigned the same way — modelling it as
  rational is the brief's assumption — with ρ = 1 and no comfort for
  unknown players.
- `matchups` reuses the All Pick model's lane-weighted sum with the enemy's
  positions known from `σ_enemy` (one-hot) instead of inferred.
- CM pick phases map a team's picks 1 / 2–4 / 5 to the snapshot's
  `p1` / `p2` / `last`.

### D8. The search

Each node is a draft state at some step. On the captain's steps the search
maximises `E`; on the enemy's it minimises it. Candidates at a node are the
top K by an immediate score — for a pick, the team's value gain; for a ban,
the value the other team would gain picking that hero next — with K = 8 at
the root and 5 below. At the depth limit, the remaining picks are completed
greedily in draft order, each by its team's best immediate pick, and bans
past the limit are skipped. Alpha-beta pruning on that tree; iterative
deepening from depth 1, keeping the last fully completed depth's ranking,
until 1500 ms or the end of the draft. The top five root candidates are the
suggestions. A suggestion's score is the evaluation the search reaches after
it minus the current evaluation; its components are the candidate's own
contribution at the position `σ` gives it, by part (for a ban, the enemy's
would-be contribution, negated), plus `lookahead`, the rest of the score —
what the search expects the remaining steps to add or take away. The parts
therefore sum to the score by construction.

The greedy completion is what lets a flexible early pick score: a hero that
leaves the team more good completions raises the leaf value without a rule
saying "flex is good". Likewise no rule says "don't ban both of the enemy's
carries if it hands them a better one" — a ban is a move and the enemy's
reply is searched (cm-model, *A ban that would hand the enemy a better pick*).

*Alternative:* Monte-Carlo tree search. Rejected for v1: the evaluation is
cheap and deterministic, which is where alpha-beta does well, and its result
is reproducible in a test.

### D9. d2pt rating as meta

For a position with an upload, `meta(h, k) = s_k · (rating − 50) / 50`, where
`s_k` is chosen so the mapped ratings' standard deviation over rated heroes
equals the snapshot meta's over its `sufficient` heroes at `k`. The scale
then comes from the data rather than a constant, and the two sources stay
comparable within one draft where some positions are uploaded and some are
not. A hero with a null rating at `k` is unplayable there (share treated as
0). d2pt's phase win rates are stored for the report delivery and not read by
this model: they are AP-pub phases, and the snapshot's phase deltas already
fill that component.

### D10. Page structure and state

`cm.html` loads `src/cm/main.tsx`. The page reuses `src/app/picker/`,
`HeroTile` and the design tokens; it owns its session type under
`src/cm/ui/` stored at `localStorage` key `cm.session` (v: 1). The All Pick
page's key is untouched. The session is written on every change and read
back whole on load, or not at all. Resetting the draft asks first through
the browser's own `confirm()` — undo cannot bring the steps back, and the
native dialog is already keyboard- and screen-reader-operable — and keeps the
setup and rosters, since the next draft is often the same two teams.
Hotkeys are not part of v1's criteria; the picker's
own keyboard operation comes with it. Desktop layout only.

### D11. The CM store

`CM_DATA_DIR` (default `./cm-data`, `/app/cm-data` in the image, created
owned by the runtime user) on a named volume `cm` that only the application
mounts. The job never sees the password or the volume.

## Risks / Trade-offs

- **d2pt changes its data file** → uploads fail validation with
  `not-d2pt-meta` and the model keeps the snapshot meta; the fix is a parser
  change. The fixture in the tests is a trimmed real file.
- **d2pt's terms** may not welcome reuse of its data. The captain downloads
  it in their own browser for a non-commercial amateur tool; the decision is
  the user's and is recorded in the brief.
- **Search depth on a slow machine** → the 1500 ms budget bounds latency, and
  the reported depth says how far it looked; a captain on a slow laptop gets
  shallower, not later, answers.
- **Weights are unfitted.** The comfort constant, rank slope and clamp are
  argued, not measured. The calibration the brief describes (hit rate of
  real CM picks in the top five) needs drafts with known rosters, which the
  second delivery's profiles make possible.
- **A global sign-in limit** lets anyone lock the captain out for 15 minutes
  by sending wrong passwords. Accepted for one user; the alternative trusts
  forwarded addresses the proxy may not set.

## Migration Plan

Set `CM_PASSWORD` (12+ characters) in the host's `.env` before step 2
deploys, which is the step that passes it to the application; step 1 deploys
with the API closed. Without it the CM API answers 503 and nothing else
changes.
The `cm` volume is created by compose on first `up`. Rollback is redeploying
the previous image; the volume is left behind harmlessly.
