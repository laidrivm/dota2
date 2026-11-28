/**
 * The snapshot terms both drafting models read: the accessors that keep an
 * insufficient hero neutral (model-spec.md §0) and the lane-weighted matchup
 * (§3.1). All Pick's `computeModel` and the CM engine import them from here, so
 * the two pages share one definition of each.
 */

import {
	MODEL_CONSTANTS as C,
	type HeroEntry,
	type PickPhase,
	ROLES,
	type Role,
	type Side,
	type SnapshotBundle,
} from "./types.ts";

// --- primitive accessors (insufficient heroes are neutral, §0) -------------

export function share(hero: HeroEntry, role: Role): number {
	if (!hero.sufficient) {
		// Uniform over positions the hero has any picks on (§0).
		const keys = Object.keys(hero.positions);
		return keys.includes(String(role)) ? 1 / keys.length : 0;
	}
	// An insufficient position contributes no share (§0), matching meta().
	const pos = hero.positions[`${role}`];
	return pos?.sufficient ? pos.share : 0;
}

export function meta(hero: HeroEntry, role: Role): number {
	if (!hero.sufficient) return 0;
	const pos = hero.positions[`${role}`];
	return pos?.sufficient ? pos.meta : 0;
}

export function sideDelta(hero: HeroEntry, side: Side | null): number {
	if (!hero.sufficient || side === null) return 0;
	return hero.side[side];
}

export function phaseDelta(hero: HeroEntry, phase: PickPhase): number {
	return hero.sufficient ? hero.phase[phase] : 0;
}

export function adv(
	bundle: SnapshotBundle,
	a: HeroEntry,
	b: HeroEntry,
): number {
	if (!a.sufficient || !b.sufficient) return 0;
	return bundle.matchups[String(a.id)]?.[String(b.id)] ?? 0;
}

export function syn(
	bundle: SnapshotBundle,
	a: HeroEntry,
	b: HeroEntry,
): number {
	if (!a.sufficient || !b.sufficient) return 0;
	return bundle.synergies[String(a.id)]?.[String(b.id)] ?? 0;
}

export interface EnemyMarginal {
	hero: HeroEntry;
	/** marginal.get(role) = P(this enemy plays role). */
	marginal: Map<Role, number>;
}

// --- §3.1 lane-weighted matchup ----------------------------------------------

/**
 * matchup(h, r) = Σ_e adv(h,e) · (Σ_r' P(e,r')·L[r][r']) / L̄(r); 0 when E=∅.
 * All Pick passes the inferred marginals; the CM engine passes each enemy's
 * assigned position as a marginal of 1.
 */
export function laneMatchup(
	bundle: SnapshotBundle,
	h: HeroEntry,
	r: Role,
	enemies: EnemyMarginal[],
): number {
	if (enemies.length === 0) return 0;
	let num = 0;
	let lbarNum = 0;
	for (const { hero: enemy, marginal: m } of enemies) {
		let laneW = 0;
		for (const rp of ROLES) {
			laneW += (m.get(rp) ?? 0) * C.laneWeights[r][rp];
		}
		num += adv(bundle, h, enemy) * laneW;
		lbarNum += laneW;
	}
	const lbar = lbarNum / enemies.length;
	return lbar === 0 ? 0 : num / lbar;
}
