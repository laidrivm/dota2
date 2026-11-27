# captains-mode-assistant

## Why

The pick assistant answers one player's question in ranked All Pick: which
hero for my role. A captain in a Captains Mode lobby asks a different one —
what to ban and what to pick for five players at once, in a fixed order of
24 bans and picks, against an opponent who drafts back. Nothing in the
product reasons about bans, about the order, or about who on either team
plays what. The user plays amateur CM lobbies and wants a captain's
assistant for them; the full brief, with every decision the user settled,
is the Notion page *Dota 2 CM assistant new* on the D2ASS board card
*Captains Mode draft assistant v1 on `/cm`*.

This change is the first of three deliveries the brief orders: the board,
the rosters entered by hand and the suggestions. Importing player profiles
and the post-draft report from a language model follow as changes of their
own.

## What Changes

- A second page, `/cm`, beside the All Pick page at `/`, which stays as it
  is. `/cm` is desktop-only.
- A server API under `/api/cm/`, behind one password the deployment sets.
  The page asks for it before showing anything. With no password set the
  API refuses every request rather than serving open.
- A Captains Mode draft: the captain sets the side and whether the team picks
  first, enters both rosters — nickname, position, rank and signature heroes
  per player, the enemy's positions where known — and mirrors the 24-step
  draft as it happens.
- Suggestions for the step in progress: a ranked list of heroes to ban or
  pick, each with the parts its score is made of, and the heroes the model
  expects the enemy to take on the enemy's steps. They come from a lookahead
  search over the draft order that assumes the enemy drafts as rationally as
  the captain, and they are recomputed whenever the captain enters a step,
  followed or not.
- Hero strength from dota2protracker's *Pubs 7000+ MMR* meta, which the
  captain downloads in their own browser and uploads to the page; until a
  position is uploaded, the model uses the statistics snapshot the All Pick
  page already serves.

## Capabilities

### New Capabilities

- `cm-access`: the password, the session it starts, and what the CM API
  answers without one.
- `cm-draft`: the CM page's setup, rosters, the draft order and how a step is
  entered, undone and kept across reloads.
- `cm-model`: how a draft state is valued, how heroes are assigned to
  positions on both teams, and the search that ranks the candidates for the
  step in progress.
- `cm-meta-import`: the dota2protracker meta upload — what it accepts, where
  it is kept and what the model reads from it.

### Modified Capabilities

- `app-shell`: *Single screen, state derived from data* and *Static
  production build* assume one entry point; the build now has two, and only
  the All Pick one runs without the server.
- `module-boundaries`: *The prediction model never imports from the
  application layer* gains the CM engine.
- `deployment-topology`: a store the application keeps for itself, apart
  from the two volumes it shares with the job.

## Non-goals

- **Player profiles from OpenDota, STRATZ or Dotabuff.** The second delivery.
  Until it lands, a player's comfort is the list of signature heroes the
  captain types in.
- **The post-draft report and its chat.** The third delivery.
- **Fetching dota2protracker from the server.** Its pages sit behind
  Cloudflare's bot check, and a server-side fetch would have to defeat it.
  The captain's own browser downloads the data instead (see design.md).
- **A phone layout.** The brief settles on desktop only.
- **Win probability.** The brief drops it for CM.
- **Pinning a picked hero to a named player by hand.** The model assigns the
  team's heroes to its positions; the captain sees the assignment and can
  re-enter the draft, not override it.
- **Patch changes and letter patches.** The brief excludes them; the draft
  order is stored as one table so a future format change edits one place.
- **A spending cap or per-user accounts.** One password guards a tool with
  one user, and v1 spends nothing per request.

## Impact

- New: `cm.html` and its client under `src/cm/`, a pure engine under
  `src/cm/engine/`, a Web Worker for the search, and API routes under
  `src/server/`.
- Dependencies: `hono` for the API routes, `zod` for the request and
  response schemas the API design rules require, and `devalue` to read
  dota2protracker's data file; each goes through `/warm`.
- `package.json`'s build script gains the second entry point.
- `docker-compose.yml`: the application reads `CM_PASSWORD` and mounts a
  volume of its own for uploaded meta. `.env.example` names the variable.
- Existing behaviour at `/`, the snapshot pipeline and the job are untouched.
