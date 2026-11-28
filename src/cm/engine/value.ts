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
	// A player outside `players` with no known rank among them has no mean
	// to stand against; 0/0 would carry NaN into every total.
	if (known.length === 0) return 1;
	const mean = known.reduce((sum, rank) => sum + rank, 0) / known.length;
	const weight = 1 + RANK_STEP * (player.rank - mean);
	return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, weight));
}

/** A signature hero's lift for the player holding its slot, before the weight. */
export const comfort = (player: Player | null, hero: HeroId): number =>
	player?.signatures.includes(hero) ? SIGNATURE_BONUS : 0;

/**
 * The snapshot's meta at `position`, or the off-role cost where it rarely
 * plays. A position the hero is played at but too thin to judge is neutral
 * (model-spec §0), not off-role — `share()` reads it as 0, which would
 * otherwise land it on the cost.
 */
export function metaAt(hero: HeroEntry, position: Role): number {
	if (hero.positions[`${position}`]?.sufficient === false) return 0;
	return share(hero, position) >= PLAYABLE_SHARE
		? meta(hero, position)
		: OFF_ROLE_META;
}

/** `team`'s value against `enemy`'s slots, in parts and in total. */
export function teamValue(
	bundle: SnapshotBundle,
	team: Team,
	enemy: readonly Slot[],
): { total: number; parts: ValueParts } {
	const { picked, enemies } = read(bundle, team, enemy);
	const parts: ValueParts = {
		meta: 0,
		comfort: 0,
		side: 0,
		phase: 0,
		synergy: 0,
		matchups: 0,
	};
	for (const pick of picked) {
		const own = slotParts(bundle, team, enemies, pick);
		parts.meta += own.meta;
		parts.comfort += own.comfort;
		parts.side += own.side;
		parts.phase += own.phase;
		parts.matchups += own.matchups;
	}
	for (const [i, a] of picked.entries())
		for (const b of picked.slice(i + 1))
			parts.synergy += syn(bundle, a.entry, b.entry);

	const total = Object.values(parts).reduce((sum, part) => sum + part, 0);
	return { total, parts };
}

/**
 * What `hero` alone brings `team` at the position it holds there: its own
 * slot's parts, and its synergy with each teammate. Zero for a hero the team
 * does not hold or the snapshot does not carry.
 */
export function ownParts(
	bundle: SnapshotBundle,
	team: Team,
	enemy: readonly Slot[],
	hero: HeroId,
): ValueParts {
	const { picked, enemies } = read(bundle, team, enemy);
	const pick = picked.find((p) => p.entry.id === hero);
	if (pick === undefined)
		return { meta: 0, comfort: 0, side: 0, phase: 0, synergy: 0, matchups: 0 };
	let synergy = 0;
	for (const other of picked)
		if (other !== pick) synergy += syn(bundle, pick.entry, other.entry);
	return { ...slotParts(bundle, team, enemies, pick), synergy };
}

interface Pick extends Slot {
	entry: HeroEntry;
	order: number;
}

/** One pick's parts other than synergy, which belongs to a pair. */
function slotParts(
	bundle: SnapshotBundle,
	team: Team,
	enemies: EnemyMarginal[],
	{ entry, position, player, order }: Pick,
): Omit<ValueParts, "synergy"> {
	const weight = rankWeight(player, team.players);
	return {
		meta: weight * metaAt(entry, position),
		comfort: weight * comfort(player, entry.id),
		side: sideDelta(entry, team.side),
		phase: phaseDelta(entry, cmPhase(order)),
		matchups: laneMatchup(bundle, entry, position, enemies),
	};
}

/** `team`'s picks the snapshot carries, and `enemy`'s as matchup marginals. */
function read(bundle: SnapshotBundle, team: Team, enemy: readonly Slot[]) {
	const byId = new Map(bundle.heroes.map((h) => [h.id, h]));
	// `order` is the pick's place among all the team's picks, a lost hero's included,
	// so a pick after one still reads its own phase.
	const picked = team.slots.flatMap((slot, order) => {
		const hero = byId.get(slot.hero);
		return hero === undefined ? [] : [{ ...slot, entry: hero, order }];
	});
	// Each enemy's position is known from its assignment: a marginal of 1.
	const enemies: EnemyMarginal[] = enemy.flatMap((slot) => {
		const hero = byId.get(slot.hero);
		return hero === undefined
			? []
			: [{ hero, marginal: new Map([[slot.position, 1]]) }];
	});
	return { picked, enemies };
}

/** E: the captain's team's value minus the enemy's, each against the other. */
export const evaluate = (
	bundle: SnapshotBundle,
	ours: Team,
	theirs: Team,
): number =>
	teamValue(bundle, ours, theirs.slots).total -
	teamValue(bundle, theirs, ours.slots).total;
