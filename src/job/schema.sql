-- The whole schema (data-model §3), applied on every connect. `IF NOT EXISTS`
-- throughout, so applying it to a database that already carries it is a no-op
-- and the edge needs no "is it there yet" question of its own.
--
-- ponytail: one schema version, no migration ledger. The ceiling is a column
-- whose *shape* changes, which cannot be expressed by a `CREATE` that skips
-- itself; that is where a numbered-migration table arrives. An additive column
-- is still below it — `ADD COLUMN IF NOT EXISTS` is idempotent, so it stands
-- beside its own `CREATE` and both a fresh database and one already carrying
-- the table converge on the same shape. `snapshots` is the first to need it.
--
-- Columns stay `snake_case` because an unquoted Postgres identifier folds to
-- lowercase; the exporter renames at that boundary, which is the one exception
-- to the repository's camelCase constraint.

-- Reference (data-model §3.1) -------------------------------------------------

CREATE TABLE IF NOT EXISTS heroes (
  hero_id       int PRIMARY KEY,       -- Valve's own id, so not this project's to mint
  name          text NOT NULL,         -- canonical: "Clinkz"
  short_name    text NOT NULL,         -- slug: "clinkz"
  -- A path on this application's own origin ("/icons/clinkz.png"), never a URL
  -- to another one: `app-shell` forbids the running client a third-party
  -- request, so the ingest mirrors each image and stores where it landed. Named
  -- `icon` rather than data-model §3.1's `icon_url` for that reason, and to
  -- match the bundle key `src/types.ts` declares.
  icon          text NOT NULL,
  first_seen_at timestamptz NOT NULL   -- the run instant the hero was first seen under
);

-- Legacy names and abbreviations the picker searches by. Seeded by hand: no
-- source publishes them, and the ingest neither writes nor reads this table.
CREATE TABLE IF NOT EXISTS hero_aliases (
  hero_id int NOT NULL REFERENCES heroes,
  alias   text NOT NULL,               -- "bone fletcher", "am", "wk"
  kind    text NOT NULL CHECK (kind IN ('legacy', 'abbrev')),
  PRIMARY KEY (hero_id, alias)
);

CREATE TABLE IF NOT EXISTS patches (
  patch_id     text PRIMARY KEY,       -- "7.41d"
  base_version text NOT NULL,          -- "7.41"
  is_major     boolean NOT NULL,       -- 7.41 → 7.42 true; 7.41c → 7.41d false
  -- The release instant the patch source states, not the instant this project
  -- first saw the patch: what the blend decays over is how long players have
  -- had it, which is the reading `design.md` §*Patch detection leaves the
  -- statistics API* settles.
  detected_at  timestamptz NOT NULL
);

-- Snapshots (data-model §3.2) -------------------------------------------------

CREATE TABLE IF NOT EXISTS snapshots (
  -- An incremental integer rather than the UUIDv7 `docs/api-design.md`
  -- requires. It travels only inside the bundle: no endpoint accepts it and no
  -- consumer resolves it, the client reading it only to notice that the bundle
  -- changed — which is the exemption that rule states, carried here as it asks.
  snapshot_id    bigserial PRIMARY KEY,
  created_at     timestamptz NOT NULL,
  patch_id       text NOT NULL REFERENCES patches,
  prior_patch_id text REFERENCES patches,   -- NULL where the prior is zeroed
  prior_weight   real NOT NULL,
  status         text NOT NULL
                 CHECK (status IN ('building', 'published', 'failed')),
  -- Which components staging measured when this snapshot was built. A stored
  -- delta of 0 cannot afterwards say whether the component was measured and
  -- neutral or never measured at all, and the next patch's blend has to know:
  -- reading an unmeasured component back as a neutral 50 would pull real
  -- deltas towards a number nobody measured. `false` is right for every row
  -- written before these columns existed — no pull fills either table yet.
  side_measured  boolean NOT NULL DEFAULT false,
  phase_measured boolean NOT NULL DEFAULT false
);
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS
  side_measured boolean NOT NULL DEFAULT false;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS
  phase_measured boolean NOT NULL DEFAULT false;
-- The pointer the export follows: the greatest `snapshot_id` at 'published'.

-- Every table below holds values the build has already processed: an `*_adj`
-- field is a winrate delta in percentage points against 50, and `sufficient`
-- is whether the sample cleared data-model §4.5's threshold. They cascade from
-- `snapshots` because retention drops all but the last thirty.

CREATE TABLE IF NOT EXISTS hero_position_stats (
  snapshot_id bigint NOT NULL REFERENCES snapshots ON DELETE CASCADE,
  hero_id     int NOT NULL REFERENCES heroes,
  position    smallint NOT NULL CHECK (position BETWEEN 1 AND 5),
  matches     int NOT NULL CHECK (matches >= 0),  -- the patch's own, no prior mixed in
  pick_share  real NOT NULL,           -- the hero's share of its own picks, summing to 1
  meta_adj    real NOT NULL,
  sufficient  boolean NOT NULL,
  PRIMARY KEY (snapshot_id, hero_id, position)
);

CREATE TABLE IF NOT EXISTS hero_stats (
  snapshot_id      bigint NOT NULL REFERENCES snapshots ON DELETE CASCADE,
  hero_id          int NOT NULL REFERENCES heroes,
  matches          int NOT NULL CHECK (matches >= 0),
  -- Nominally 0..1 and not bounded to it: `(picks + bans) / matches` takes
  -- its picks from an endpoint pinned to ranked All Pick and its bans from
  -- one that cannot be, so the two count different populations and the
  -- quotient can pass 1. It orders heroes by contest rather than stating a
  -- share (`design.md` §*The two endpoints do not agree*).
  contest_rate     real NOT NULL,
  side_adj_radiant real NOT NULL,
  side_adj_dire    real NOT NULL,
  phase_adj_1      real NOT NULL,
  phase_adj_2      real NOT NULL,
  phase_adj_last   real NOT NULL,
  sufficient       boolean NOT NULL,
  PRIMARY KEY (snapshot_id, hero_id)
);

CREATE TABLE IF NOT EXISTS hero_matchups (
  snapshot_id   bigint NOT NULL REFERENCES snapshots ON DELETE CASCADE,
  hero_id       int NOT NULL REFERENCES heroes,
  enemy_id      int NOT NULL REFERENCES heroes CHECK (enemy_id <> hero_id),
  matches       int NOT NULL CHECK (matches >= 0),
  advantage_adj real NOT NULL,         -- antisymmetric: (a,b) and (b,a) sum to 0
  PRIMARY KEY (snapshot_id, hero_id, enemy_id)
);

CREATE TABLE IF NOT EXISTS hero_synergies (
  snapshot_id bigint NOT NULL REFERENCES snapshots ON DELETE CASCADE,
  hero_id     int NOT NULL REFERENCES heroes,
  -- The symmetry is the constraint, not a convention the writer remembers: a
  -- mirrored row would be a second copy of one statistic, and the model reads
  -- whichever it found first.
  ally_id     int NOT NULL REFERENCES heroes CHECK (ally_id > hero_id),
  matches     int NOT NULL CHECK (matches >= 0),
  synergy_adj real NOT NULL,           -- symmetric, so stored once for hero_id < ally_id
  PRIMARY KEY (snapshot_id, hero_id, ally_id)
);

-- Staging (data-model §3.3) ---------------------------------------------------

-- The ingest's output and the build's input: raw counts per patch, mirroring
-- the tables above but keyed by `patch_id` rather than `snapshot_id` and
-- holding what the source returned rather than what the build derives from it.
-- A run drops the rows of every patch released before the one preceding it,
-- and nothing else — stated against the previous patch's release rather than
-- as "the last two are kept", because a count would also drop what is newer
-- and a run taken at an earlier instant would then destroy it. Every row is
-- written and replaced inside one transaction, so no version column or
-- partial-pull ledger is needed to tell a whole run from an abandoned one.
--
-- Every count is bounded where it is declared. A negative match count, or more
-- wins than matches, is not a number the build refuses — it is one the build
-- divides by, so it leaves as a winrate past 100 and reaches the client as a
-- ranked suggestion. Nothing downstream re-checks it, so this is the edge that
-- has to.

CREATE TABLE IF NOT EXISTS staging_hero_position_stats (
  patch_id text NOT NULL REFERENCES patches,
  hero_id  int NOT NULL REFERENCES heroes,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 5),
  matches  int NOT NULL,
  wins     int NOT NULL,
  CHECK (matches >= 0 AND wins BETWEEN 0 AND matches),
  PRIMARY KEY (patch_id, hero_id, position)
);

CREATE TABLE IF NOT EXISTS staging_hero_stats (
  patch_id     text NOT NULL REFERENCES patches,
  hero_id      int NOT NULL REFERENCES heroes,
  -- The sums over this hero's position rows, stored rather than derived
  -- because the contest formula computes the pick count anyway and the side
  -- and phase baselines are read against a hero total. Should the two ever
  -- disagree, the position rows are what the source returned.
  matches      int NOT NULL,
  wins         int NOT NULL,
  CHECK (matches >= 0 AND wins BETWEEN 0 AND matches),
  -- Already a ratio where its neighbours are counts: the ingest computes
  -- `(picks + bans) / matches` because `bans` comes from a request of its own
  -- and nothing downstream has a second use for the ban count on its own.
  contest_rate real NOT NULL,
  PRIMARY KEY (patch_id, hero_id)
);

-- Both directions, unlike `hero_synergies` above: the pair endpoint answers
-- per hero, and folding the two into one row is the build's symmetry step.
CREATE TABLE IF NOT EXISTS staging_hero_matchups (
  patch_id text NOT NULL REFERENCES patches,
  hero_id  int NOT NULL REFERENCES heroes,
  enemy_id int NOT NULL REFERENCES heroes CHECK (enemy_id <> hero_id),
  matches  int NOT NULL,
  wins     int NOT NULL,
  CHECK (matches >= 0 AND wins BETWEEN 0 AND matches),
  PRIMARY KEY (patch_id, hero_id, enemy_id)
);

CREATE TABLE IF NOT EXISTS staging_hero_synergies (
  patch_id text NOT NULL REFERENCES patches,
  hero_id  int NOT NULL REFERENCES heroes,
  ally_id  int NOT NULL REFERENCES heroes CHECK (ally_id <> hero_id),
  matches  int NOT NULL,
  wins     int NOT NULL,
  CHECK (matches >= 0 AND wins BETWEEN 0 AND matches),
  PRIMARY KEY (patch_id, hero_id, ally_id)
);

-- No pull fills these two: side and phase are this change's stated non-goals.
-- They exist because the build decides a component measured by whether staging
-- holds any row for it, and a table it cannot query at all is not the same
-- answer as one holding none.
CREATE TABLE IF NOT EXISTS staging_hero_sides (
  patch_id text NOT NULL REFERENCES patches,
  hero_id  int NOT NULL REFERENCES heroes,
  side     text NOT NULL CHECK (side IN ('radiant', 'dire')),
  matches  int NOT NULL,
  wins     int NOT NULL,
  CHECK (matches >= 0 AND wins BETWEEN 0 AND matches),
  PRIMARY KEY (patch_id, hero_id, side)
);

CREATE TABLE IF NOT EXISTS staging_hero_phases (
  patch_id text NOT NULL REFERENCES patches,
  hero_id  int NOT NULL REFERENCES heroes,
  phase    text NOT NULL CHECK (phase IN ('1', '2', 'last')),
  matches  int NOT NULL,
  wins     int NOT NULL,
  CHECK (matches >= 0 AND wins BETWEEN 0 AND matches),
  PRIMARY KEY (patch_id, hero_id, phase)
);
