/**
 * One run: the patch, the reference, the three pulls, and the staging write
 * that either lands whole or leaves staging as it was.
 *
 * The run instant is an argument rather than a clock reading, which is what
 * makes "the same inputs" a state anyone can arrange. Every window is a
 * function of it and of the current patch, so a repeat over the same instant
 * recomputes the same days and weeks — and a repeat over a later one
 * deliberately does not, the window itself having moved.
 *
 * How the rows land is `staging.ts`; this file knows only what produces them.
 */
import type { SQL } from "bun";
import { heroTotals, pullBans } from "./contest.ts";
import { heldHeroIds, readHeroes, upsertHeroes } from "./heroes.ts";
import { mirrorIcons } from "./icons.ts";
import { type MetaWindow, metaWindow, pullMeta } from "./meta.ts";
import { pairWeeks, pullPairs } from "./pairs.ts";
import { detectPatch } from "./patches.ts";
import { writeStaging } from "./staging.ts";
import type { Query } from "./stratz.ts";
/** What a run needs from outside itself. */
export type Deps = {
	sql: SQL;
	query: Query;
	/** For the patch list and the hero images; the statistics API has its own. */
	fetch?: typeof globalThis.fetch;
	/** Where the mirrored images land. */
	iconsDir: string;
};

/** What a run covered, for whoever reports it. */
export type Covered = {
	patchId: string;
	window: MetaWindow;
	weeks: Date[];
};

/**
 * Carry one run to staging, or fail leaving staging untouched.
 *
 * The reference rows and the mirrored files are outside that guarantee by
 * construction: both are operations a repeat performs identically, which is
 * why they need no rollback rather than why they have none. Everything after
 * them is pulled before anything is written, so a pull that fails has written
 * no staging row to undo.
 */
export async function ingest(deps: Deps, at: Date): Promise<Covered> {
	const patch = await detectPatch(deps.sql, at, deps.fetch);
	const heroes = await readHeroes(deps.query);
	await mirrorIcons(heroes, deps.iconsDir, deps.fetch);
	await upsertHeroes(deps.sql, heroes, at);

	const span = metaWindow(patch.detectedAt, at);
	const weeks = pairWeeks(patch.detectedAt, at);
	const positions = await pullMeta(deps.query, span);
	const bans = await pullBans(deps.query, span);
	const { matchups, synergies } = await pullPairs(
		deps.query,
		heroes.map((hero) => hero.heroId),
		weeks,
	);

	// Every staged row is keyed to a hero the reference holds, checked here
	// rather than left to the foreign key: the two come from different calls to
	// the same API, and a hero one names before the other reaches the insert as
	// a constraint violation naming a column instead of a source.
	//
	// Read from the tables rather than from `heroes`, the response just
	// upserted: the tables are what the requirement names, and they hold every
	// hero a response has ever carried where the response holds only today's.
	const known = new Set(await heldHeroIds(deps.sql));
	for (const row of positions)
		if (!known.has(row.heroId))
			throw new Error(
				`the meta source returned hero ${row.heroId}, which the reference does not hold`,
			);

	await writeStaging(deps.sql, patch.patchId, {
		positions,
		// `known` is the row set as well as the guard above: every reference
		// hero gets a total, whether or not the window held a pick for it.
		heroes: heroTotals(known, positions, bans),
		matchups,
		synergies,
	});
	return { patchId: patch.patchId, window: span, weeks };
}
