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
import { iconPath, type MirroredHero, sourceImageUrl } from "./icons.ts";
import type { Query } from "./stratz.ts";

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
	)) as { data?: { constants?: { heroes?: unknown } } };
	const listed = body.data?.constants?.heroes;
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
		// The id is checked as a positive integer rather than as a number:
		// Valve mints them, the column is `int`, and `NaN`, `1.5` and `-1` are
		// each a number that reaches Postgres as an error rather than a row.
		if (
			typeof id !== "number" ||
			!Number.isInteger(id) ||
			id <= 0 ||
			typeof shortName !== "string" ||
			shortName === ""
		)
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
