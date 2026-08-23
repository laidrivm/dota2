/**
 * The hero reference: inserted, renamed, and never removed.
 *
 * There is no delete path at all rather than a guarded one, which is what
 * `hero-reference` §*A hero is upserted and never removed* asks for: a session
 * the client is holding may name a hero the next response omits, and
 * `snapshot-build` fails a snapshot whose hero count falls below the previous
 * one, so a hero dropped for a single bad response would end the run failed
 * rather than merely narrowing the grid.
 *
 * These rows are written outside the staging transaction. That is safe because
 * the only operations here are an insert and a name update, both of which a
 * repeat performs identically and neither of which a later step depends on
 * having been rolled back.
 */
import type { SQL } from "bun";

/** A hero as `heroes` holds it, `first_seen_at` excepted. */
export type HeroReference = {
	heroId: number;
	name: string;
	shortName: string;
	/** A path on this origin, which is the mirror's to supply, never a URL. */
	icon: string;
};

/**
 * Insert every hero the tables lack and update the names of every one they
 * hold. `at` is the run instant, written to `first_seen_at` on an insert and
 * left alone on an update — a hero's first appearance is not something a later
 * run gets to restate.
 *
 * One statement per hero: 127 of them a night, where the bulk form would want
 * the empty list guarded and the columns spelled twice.
 */
export async function upsertHeroes(
	sql: SQL,
	heroes: HeroReference[],
	at: Date,
): Promise<void> {
	for (const hero of heroes)
		await sql`INSERT INTO heroes (hero_id, name, short_name, icon, first_seen_at)
			VALUES (${hero.heroId}, ${hero.name}, ${hero.shortName}, ${hero.icon},
				${at})
			ON CONFLICT (hero_id) DO UPDATE SET
				name = EXCLUDED.name,
				short_name = EXCLUDED.short_name,
				-- The mirror names the file after the short name, so a rename
				-- that moves one moves the other; the caller has already
				-- mirrored what it passes here.
				icon = EXCLUDED.icon`;
}
