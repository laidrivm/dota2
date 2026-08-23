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
import {
	iconPath,
	isSlug,
	type MirroredHero,
	sourceImageUrl,
} from "./icons.ts";
import type { Query } from "./stratz.ts";

/** The largest value `heroes.hero_id` holds, `int` being signed 32-bit. */
const MAX_HERO_ID = 2_147_483_647;

/**
 * Whether `id` is one Valve could have minted. Checked against what the column
 * accepts rather than against `number`: `NaN`, `1.5`, `-1` and `2 ** 31` are
 * each a number that reaches Postgres as an error rather than a row, and the
 * ceiling belongs with the other three rather than being the one left out.
 *
 * Exported because every pull keys its rows on this id, and each reads it from
 * a response it did not write.
 */
export const isHeroId = (id: unknown): id is number =>
	typeof id === "number" && Number.isInteger(id) && id > 0 && id <= MAX_HERO_ID;

/** A hero as `heroes` holds it, `first_seen_at` excepted. */
export type HeroReference = {
	heroId: number;
	name: string;
	shortName: string;
	/** A path on this origin, which is the mirror's to supply, never a URL. */
	icon: string;
};

/** A hero as the source describes it, and as both later steps need it. */
export type SourcedHero = HeroReference & MirroredHero;

/** The whole reference, or a throw. Nothing partial is returned. */
export async function readHeroes(query: Query): Promise<SourcedHero[]> {
	// `id`, `displayName` and `shortName` are every field either step needs;
	// the API publishes no image field at all, which is why the fourth comes
	// from the slug rather than from the response.
	const body = (await query(
		"{ constants { heroes { id displayName shortName } } }",
	)) as { data?: { constants?: { heroes?: unknown } } } | null;
	// Optionally chained from `body` itself: a body of literal `null` parses to
	// one, and this function takes any `Query` rather than only the client's.
	const listed = body?.data?.constants?.heroes;
	if (!Array.isArray(listed) || listed.length === 0)
		throw new Error("the hero source listed no hero");
	return listed.map((entry, index) => {
		const { id, displayName, shortName } = (entry ?? {}) as {
			id?: unknown;
			displayName?: unknown;
			shortName?: unknown;
		};
		// The slug names a file and a URL, and the id keys every staging row, so
		// an entry missing either is not a hero this run can carry. Checked here
		// rather than where it would first hurt: the mirror would write a file
		// called `undefined.png`, and the upsert would key a row to `null`.
		// The slug is checked against the rule the mirror writes files under, so
		// a name that would be refused there is refused here instead — before
		// two locations are derived from it and before any of it is upserted.
		if (!isHeroId(id) || !isSlug(shortName))
			throw new Error(
				`the hero source described entry ${index} without an id or a slug`,
			);
		return {
			heroId: id,
			// A missing display name falls back to the slug rather than failing
			// the run: the column is NOT NULL and the name is what a tile shows,
			// so a hero named `clinkz` is worse than `Clinkz` and better than a
			// night with no snapshot. The id and the slug get no such fallback —
			// nothing could stand in for either.
			name:
				typeof displayName === "string" && displayName
					? displayName
					: shortName,
			shortName,
			icon: iconPath(shortName),
			imageUrl: sourceImageUrl(shortName),
		};
	});
}

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
