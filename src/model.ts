/**
 * Draft model — pure function of SnapshotBundle + Session (model-spec.md).
 *
 * computeModel enumerates enemy role assignments (§1), derives the pick
 * phase (§2), scores suggestion candidates per open role (§3), and — only
 * at a full 10-pick draft — estimates win probability (§4). All constants
 * come from MODEL_CONSTANTS; the function reads nothing but its arguments.
 */

import {
	MODEL_CONSTANTS as C,
	type EnemyRoleInference,
	type HeroEntry,
	type HeroId,
	type ModelOutput,
	type PickPhase,
	ROLES,
	type Role,
	type Session,
	type Side,
	type SnapshotBundle,
	type SuggestionBlock,
	type SuggestionEntry,
} from "./types.ts";

// --- primitive accessors (insufficient heroes are neutral, §0) -------------

function share(hero: HeroEntry, role: Role): number {
	if (!hero.sufficient) {
		// Uniform over positions the hero has any picks on (§0).
		const keys = Object.keys(hero.positions);
		return keys.includes(String(role)) ? 1 / keys.length : 0;
	}
	return hero.positions[`${role}`]?.share ?? 0;
}

function meta(hero: HeroEntry, role: Role): number {
	if (!hero.sufficient) return 0;
	const pos = hero.positions[`${role}`];
	return pos?.sufficient ? pos.meta : 0;
}

function sideDelta(hero: HeroEntry, side: Side | null): number {
	if (!hero.sufficient || side === null) return 0;
	return hero.side[side];
}

function phaseDelta(hero: HeroEntry, phase: PickPhase): number {
	return hero.sufficient ? hero.phase[phase] : 0;
}

function adv(bundle: SnapshotBundle, a: HeroEntry, b: HeroEntry): number {
	if (!a.sufficient || !b.sufficient) return 0;
	return bundle.matchups[String(a.id)]?.[String(b.id)] ?? 0;
}

function syn(bundle: SnapshotBundle, a: HeroEntry, b: HeroEntry): number {
	if (!a.sufficient || !b.sufficient) return 0;
	return bundle.synergies[String(a.id)]?.[String(b.id)] ?? 0;
}

// --- §2 pick phase ---------------------------------------------------------

function pickPhase(teamPickCount: number): PickPhase {
	if (teamPickCount <= 1) return "p1";
	if (teamPickCount <= 3) return "p2";
	return "last";
}

// --- §1 enemy role inference -----------------------------------------------

interface EnemyMarginal {
	hero: HeroEntry;
	/** marginal.get(role) = P(this enemy plays role). */
	marginal: Map<Role, number>;
}

interface EnemyInference {
	enemies: EnemyMarginal[];
	/** open[role] = P(role still unoccupied by an enemy). */
	open: Record<`${Role}`, number>;
}

/** All injective assignments of `count` enemies to the 5 roles. */
function roleAssignments(count: number): Role[][] {
	const out: Role[][] = [];
	const used = new Set<Role>();
	const cur: Role[] = [];
	const recurse = (i: number) => {
		if (i === count) {
			out.push([...cur]);
			return;
		}
		for (const r of ROLES) {
			if (used.has(r)) continue;
			used.add(r);
			cur.push(r);
			recurse(i + 1);
			cur.pop();
			used.delete(r);
		}
	};
	recurse(0);
	return out;
}

function inferEnemyRoles(enemyHeroes: HeroEntry[]): EnemyInference {
	const open = { "1": 1, "2": 1, "3": 1, "4": 1, "5": 1 } as Record<
		`${Role}`,
		number
	>;
	if (enemyHeroes.length === 0) return { enemies: [], open };

	const marginals = enemyHeroes.map(() => new Map<Role, number>());
	const assignments = roleAssignments(enemyHeroes.length);
	let total = 0;
	const weighted = assignments.map((asg) => {
		let w = 1;
		asg.forEach((role, e) => {
			const hero = enemyHeroes[e];
			if (hero) w *= Math.max(share(hero, role), C.epsilon);
		});
		total += w;
		return { asg, w };
	});

	for (const { asg, w } of weighted) {
		const p = w / total;
		asg.forEach((role, e) => {
			const m = marginals[e];
			if (m) m.set(role, (m.get(role) ?? 0) + p);
		});
	}

	for (const r of ROLES) {
		let occupied = 0;
		for (const m of marginals) occupied += m.get(r) ?? 0;
		open[`${r}`] = 1 - occupied;
	}

	const enemies = enemyHeroes.map((hero, i) => ({
		hero,
		marginal: marginals[i] ?? new Map<Role, number>(),
	}));
	return { enemies, open };
}

// --- main ------------------------------------------------------------------

// Trusts a well-formed session (the UI is the validation boundary): a hero
// id appearing in two sets — both teams, or picked and banned — is undefined
// behavior, not defended against.
export function computeModel(
	bundle: SnapshotBundle,
	session: Session,
): ModelOutput {
	const byId = new Map<HeroId, HeroEntry>(bundle.heroes.map((h) => [h.id, h]));
	const heroOrNull = (id: HeroId | null) =>
		id === null ? null : (byId.get(id) ?? null);

	// Team picks as [role, hero] for filled slots.
	const teamSlots: { role: Role; hero: HeroEntry }[] = [];
	for (const r of ROLES) {
		const hero = heroOrNull(session.teamPicks[`${r}`]);
		if (hero) teamSlots.push({ role: r, hero });
	}
	const allies = teamSlots.map((s) => s.hero);
	const enemyHeroes = session.enemyPicks
		.map((id) => byId.get(id))
		.filter((h): h is HeroEntry => h !== undefined);

	const phase = pickPhase(teamSlots.length);
	const { enemies, open } = inferEnemyRoles(enemyHeroes);

	// Ids taken out of the candidate pool: allies, enemies, bans (§3).
	const taken = new Set<HeroId>([
		...allies.map((h) => h.id),
		...enemyHeroes.map((h) => h.id),
		...session.bans,
	]);

	// --- §3.2 counter-risk: pop/P̂ over enemy-pick candidates, computed once.
	const nOpenEnemy = 5 - enemyHeroes.length;
	const candPop = bundle.heroes
		.filter((h) => h.sufficient && !taken.has(h.id))
		.map((c) => {
			let s = 0;
			for (const r of ROLES) s += open[`${r}`] * share(c, r);
			return { hero: c, pop: c.contest * s };
		});
	const totalPop = candPop.reduce((a, b) => a + b.pop, 0);
	const counterRisk = (h: HeroEntry): number => {
		if (totalPop === 0 || nOpenEnemy === 0) return 0;
		let acc = 0;
		for (const { hero: c, pop } of candPop) {
			acc += (pop / totalPop) * Math.max(0, adv(bundle, c, h));
		}
		return -nOpenEnemy * acc;
	};

	// --- §3.1 lane-weighted matchup component for candidate h at my role r.
	// matchup(h, r) = Σ_e adv(h,e) · (Σ_r' P(e,r')·L[r][r']) / L̄(r); 0 when E=∅.
	const matchupComponent = (h: HeroEntry, r: Role): number => {
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
	};

	const scoreEntry = (h: HeroEntry, r: Role): SuggestionEntry => {
		const components = {
			meta: C.weights.meta * meta(h, r),
			side: C.weights.side * sideDelta(h, session.side),
			phase: C.weights.phase * phaseDelta(h, phase),
			synergy:
				C.weights.synergy * allies.reduce((s, a) => s + syn(bundle, h, a), 0),
			matchups: C.weights.matchups * matchupComponent(h, r),
			counterRisk: C.weights.counterRisk * counterRisk(h),
		};
		const score =
			components.meta +
			components.side +
			components.phase +
			components.synergy +
			components.matchups +
			components.counterRisk;
		return { hero: h.id, score, components };
	};

	// --- §3.4 one block per still-open role, my role first.
	const openRoles = ROLES.filter((r) => session.teamPicks[`${r}`] === null);
	const ordered =
		session.myRole !== null && openRoles.includes(session.myRole)
			? [session.myRole, ...openRoles.filter((r) => r !== session.myRole)]
			: openRoles;
	const suggestions: SuggestionBlock[] = ordered.map((r) => {
		const entries = bundle.heroes
			.filter((h) => h.sufficient && !taken.has(h.id) && share(h, r) > 0)
			.map((h) => scoreEntry(h, r))
			// Descending by score; hero id breaks ties for determinism.
			.sort((a, b) => b.score - a.score || a.hero - b.hero)
			.slice(0, C.suggestionsPerRole);
		return { role: r, isMyRole: r === session.myRole, entries };
	});

	const enemyRoles: EnemyRoleInference[] = enemies.map(
		({ hero, marginal: m }) => {
			const probs = {} as Record<`${Role}`, number>;
			for (const r of ROLES) probs[`${r}`] = m.get(r) ?? 0;
			return { hero: hero.id, probs };
		},
	);

	// --- §4 win estimate: only at a full 5v5 draft.
	let winEstimate: ModelOutput["winEstimate"] = null;
	if (teamSlots.length === 5 && enemyHeroes.length === 5) {
		const enemySide: Side | null =
			session.side === null
				? null
				: session.side === "radiant"
					? "dire"
					: "radiant";

		let delta = 0;
		for (const { role, hero } of teamSlots) {
			delta += meta(hero, role) + sideDelta(hero, session.side);
		}
		for (const { hero: enemy, marginal: m } of enemies) {
			let expectedMeta = 0;
			for (const r of ROLES) expectedMeta += (m.get(r) ?? 0) * meta(enemy, r);
			delta -= expectedMeta + sideDelta(enemy, enemySide);
		}
		for (const [i, a] of allies.entries())
			for (const b of allies.slice(i + 1)) delta += syn(bundle, a, b);
		for (const [i, { hero: e1 }] of enemies.entries())
			for (const { hero: e2 } of enemies.slice(i + 1))
				delta -= syn(bundle, e1, e2);
		for (const { role, hero } of teamSlots) {
			delta += matchupComponent(hero, role);
		}

		winEstimate = {
			advantage: delta,
			winProbability: 1 / (1 + Math.exp(-C.beta * delta)),
		};
	}

	return { phase, enemyRoles, enemyOpenRoles: open, suggestions, winEstimate };
}
