# Implementation plan — agent working file

Read at session start; updated in the same turn a decision is made (rule in
CLAUDE.md). This file holds the sources still feeding the work and the
constraints still in force — what a future session needs in order not to reopen
settled work, **and that is not a status**. What a completed change decided
lives in its archived proposal under `openspec/changes/archive/`.

## Where the work is

The queue is not here. Every task with a status is a card on one of three
boards in the Notion workspace, read through the saved view named `Board view`
and never through a SQL query:

- `D2ASS` — this repository's product work.
- `Harness` — the agent scaffolding, which is to leave for a repository of its
  own. Its cards stay whether or not that work is still carried out here.
- `mellon` — the second project that will sit on that scaffolding. Named by the
  routing rule; the board is made when the repository is.

Named rather than linked: this repository is public and the boards are not, so
a board or view URL is an identifier for private content and does not belong in
a tracked file. `scripts/board-state.ts` derives `proposing`, `ready` and
`done` for `D2ASS` from the file tree alone, and reports nothing for the other
five statuses or the other two boards — those move by whoever does the work, in
the turn the work moves.

## Growth protocol

- **What lives here**: the requirement sources still feeding the work, and the
  standing constraints no single file owns. Not a task, which has a status and
  is finished exactly once.
- **Where an entry goes**, tested in this order, because an entry can satisfy
  more than one: a task, something that will be finished and whose being
  finished somebody will want to read → a card, at the status the tree derives
  or at `suggested`; then a fence a reader would otherwise remove → a comment
  at that line, unless one already stands; then a fact the archive records →
  deleted; then a standing constraint no single site owns → kept below.
- An archived change is never edited to receive an evicted entry. The archive
  records what was proposed and applied; a fact discovered later is written
  where it is enforced instead.
- A kept constraint that is later overtaken — the dependency dropped, the
  approach replaced — is deleted rather than left standing, on the terms
  `CLAUDE.md` already applies to a stale rule.
- This file counts against the always-on budget stated in `CLAUDE.md`
  §*Maintenance & growth*.

## Requirement sources

- The `tasks/task-5.md` card on `D2ASS` — error tracking, the infrastructure
  task still open. The brief it is named for has left the tree; the card holds
  its scope.
- `spec-inbox/` (gitignored, see its README) — unsorted product specs; the data
  model and model spec still feed Phase 3.
- Design: the private claude.ai/design project "Draft board screen design",
  accessed via DesignSync.

## Standing constraints

Kept because no single file in the tree is where a reader would look for them.

- **Preact** — the UI runtime, and the first runtime dependency.
- **camelCase in every JSON payload and every identifier that can hold it** —
  `types.ts`, the fixture, the generator and the bundle contract all take
  renamed keys on import. Postgres is the exception `data-model.md` records
  and the one place it cannot hold: an unquoted identifier folds to lowercase,
  so columns stay `snake_case` and the exporter renames at that boundary.
- **The client fetches one snapshot URL** — `snapshot-delivery` allows exactly
  one request, so the version lives in the payload's `snapshotId` and in
  Postgres, never in the path. The URL is revalidated by ETag; the versioned
  file `data-model.md` §5 proposes, and its `latest` pointer, are not built.
- **STRATZ, not OpenDota** — OpenDota gives hero winrates by rank bracket and
  the hero reference with icons, but no lane position: `lane_role` exists only
  on its parsed-match sample. `hero_position_stats` is what enemy-role
  inference and the per-role suggestions both rest on, so a source without
  positions cannot feed this model. Dotabuff and dota2protracker publish no
  API; the latter's role here is the manual spot-check only.
- **Hero icons are served from this origin** — `app-shell` forbids a
  third-party runtime request, so the job mirrors each hero's icon when it
  first appears and the bundle's `icon` field names the local copy.
- **Bun's native bundler, no Vite** — `bun run build` is `bun build
  ./index.html --outdir=dist` plus the copy steps; `bun run dev` is
  `scripts/dev.ts`, which runs the same build unminified, watches it and
  serves it.
  Bun's HTML dev server is not used: it never defines a CSS module's
  class-name mapping (oven-sh/bun#18258).
- **Dependabot, not Renovate** — first-party, so no third-party GitHub App
  gets write access to a hardening-focused repository. The trade is no
  dependency dashboard and no lockfile maintenance; the nightly `bun audit`
  covers the latter.
- **Two `overrides` nothing raises** — `qs` and `fast-uri` reach this tree only
  under `@stryker-mutator/core`, the first because `typed-rest-client` pins it
  exactly and the second because `ajv` asks a range nothing had re-resolved.
  Dependabot's `bun` ecosystem reads `dependencies` and `devDependencies`, so
  neither value is raised by anything: the nightly `bun audit` is what says one
  has aged into an advisory's range — as `qs` did, at the 6.15.3 it was pinned
  to for the previous advisory — and raising it is a hand edit prompted by that
  job. Exact, as `bunfig.toml`'s `exact = true` requires of this manifest.
- **Docker on a VPS** — the deployment target.
- **The design project's swatch pages are derived, not authored.**
  `guidelines/colors-hero-palette.html` and `guidelines/component-hero-tile.html`
  are written from `src/app/styles/tokens/colors.css`: one swatch per token in
  file order, background `var(--hero-<slug>)`, label the slug verbatim, letters
  `heroAbbr` of the hero's display name, ink `var(--tile-ink-dark)` or
  `var(--tile-ink-light)` by the 0.18 luminance threshold. The display name is
  not in `colors.css`, which holds slugs and colours alone: it comes from the
  same place the slugs do, `heroes.name` in the deployed database, or
  `heroes[].name` in the published bundle for the subset that carries stats.
  The fallback's swatch has no hero and so no letters. The project's own
  `tokens/colors.css` carries the same hero block and nothing else of it is
  the repository's to touch. Regenerating them is part of regenerating the
  palette: CSS cannot pick an ink by its background's luminance, so a hero
  that crosses 0.18 keeps the old ink on the page until somebody runs it
  again.
- **Context7 is documentation, not a source of truth.** Its library pages are
  community-contributed and its authors warrant neither accuracy nor safety,
  so the review instruction treats retrieved text as evidence about whether an
  API exists and never as instructions. `.coderabbit.yaml` can only deny an
  MCP server (`knowledge_base.mcp.disabled_servers`), never allow one: which
  servers are connected is CodeRabbit dashboard state, outside this
  repository. Release age, downloads and install scripts stay with `/warm` and
  `bun info` — Context7 says nothing about any of them.
