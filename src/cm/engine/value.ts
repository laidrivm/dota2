/**
 * A Captains Mode team's value in percentage points (design D7):
 *
 *   V = Σ_h ρ(p) · (meta(h, k) + comfort(p, h)) + Σ_h side(h) + Σ_h phase(h)
 *     + Σ_{pairs} syn + lane-weighted matchups against the enemy's slots
 *
 * where each pick sits at a position `k` held by player `p` — the assignment
 * that places them is the caller's. The snapshot accessors and the matchup
 * are the All Pick model's own, so both pages read one definition of each.
 */
import {
	type EnemyMarginal,
	laneMatchup,
	meta,
	phaseDelta,
	share,
	sideDelta,
	syn,
} from "../../model-terms.ts";
import type {
	HeroEntry,
	HeroId,
	PickPhase,
	Role,
	Side,
	SnapshotBundle,
} from "../../types.ts";

/** A signature hero's lift at its player's slot, before the rank weight. */
export const SIGNATURE_BONUS = 3.0;
/** What a hero played where its share is under `PLAYABLE_SHARE` costs. */
export const OFF_ROLE_META = -10;
export const PLAYABLE_SHARE = 0.05;
const RANK_STEP = 0.1;
const WEIGHT_MIN = 0.75;
const WEIGHT_MAX = 1.25;

/** What the engine reads of a player: the page's own type satisfies it. */
export interface Player {
	rank: number | null;
	signatures: readonly HeroId[];
}

/** A pick at the position it is assigned, and the player holding that slot. */
export interface Slot {
	hero: HeroId;
	position: Role;
	player: Player | null;
}

export interface Team {
	side: Side;
	/** All five players, for the mean rank the weight is taken against. */
	players: readonly Player[];
	/** The team's picks in the order it made them. */
	slots: readonly Slot[];
}

export interface ValueParts {
	meta: number;
	comfort: number;
	side: number;
	phase: number;
	synergy: number;
	matchups: number;
}

/** A team's picks 1 / 2–4 / 5 read the snapshot's `p1` / `p2` / `last`. */
export const cmPhase = (index: number): PickPhase =>
	index === 0 ? "p1" : index < 4 ? "p2" : "last";

/**
 * ρ: 1 + 0.1 per rank tier above the mean of the team's known ranks, clamped
 * to [0.75, 1.25]; 1 for a player of unknown rank or no player at all.
 */
export function rankWeight(
	player: Player | null,
	players: readonly Player[],
): number {
	if (player === null || player.rank === null) return 1;
	const known = players.flatMap((p) => (p.rank === null ? [] : [p.rank]));
	const mean = known.reduce((sum, rank) => sum + rank, 0) / known.length;
	const weight = 1 + RANK_STEP * (player.rank - mean);
	return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, weight));
}

/** The snapshot's meta at `position`, or the off-role cost where it rarely plays. */
const metaAt = (hero: HeroEntry, position: Role): number =>
	share(hero, position) >= PLAYABLE_SHARE
		? meta(hero, position)
		: OFF_ROLE_META;

/** `team`'s value against `enemy`'s slots, in parts and in total. */
export function teamValue(
	bundle: SnapshotBundle,
	team: Team,
	enemy: readonly Slot[],
): { total: number; parts: ValueParts } {
	const byId = new Map(bundle.heroes.map((h) => [h.id, h]));
	const picked = team.slots.flatMap((slot) => {
		const hero = byId.get(slot.hero);
		return hero === undefined ? [] : [{ ...slot, entry: hero }];
	});
	// Each enemy's position is known from its assignment: a marginal of 1.
	const enemies: EnemyMarginal[] = enemy.flatMap((slot) => {
		const hero = byId.get(slot.hero);
		return hero === undefined
			? []
			: [{ hero, marginal: new Map([[slot.position, 1]]) }];
	});

	const parts: ValueParts = {
		meta: 0,
		comfort: 0,
		side: 0,
		phase: 0,
		synergy: 0,
		matchups: 0,
	};
	picked.forEach(({ entry, position, player }, index) => {
		const weight = rankWeight(player, team.players);
		const signature = player?.signatures.includes(entry.id) ?? false;
		parts.meta += weight * metaAt(entry, position);
		parts.comfort += weight * (signature ? SIGNATURE_BONUS : 0);
		parts.side += sideDelta(entry, team.side);
		parts.phase += phaseDelta(entry, cmPhase(index));
		parts.matchups += laneMatchup(bundle, entry, position, enemies);
	});
	for (const [i, a] of picked.entries())
		for (const b of picked.slice(i + 1))
			parts.synergy += syn(bundle, a.entry, b.entry);

	const total = Object.values(parts).reduce((sum, part) => sum + part, 0);
	return { total, parts };
}

/** E: the captain's team's value minus the enemy's, each against the other. */
export const evaluate = (
	bundle: SnapshotBundle,
	ours: Team,
	theirs: Team,
): number =>
	teamValue(bundle, ours, theirs.slots).total -
	teamValue(bundle, theirs, ours.slots).total;
