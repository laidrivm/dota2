/**
 * The search past the step in progress (design D8). Each node is a draft
 * state; on the captain's steps the search maximises the evaluation, on the
 * enemy's it minimises it. A node's moves are its top heroes by the immediate
 * ranking (`suggest`), eight at the root and five below. At the depth limit
 * the remaining picks are completed greedily and the evaluation read there.
 * Alpha-beta prunes the tree; iterative deepening from depth 1 keeps the last
 * depth it completed within the budget.
 */
import { phaseDelta, sideDelta } from "../../model-terms.ts";
import type { HeroId, Role, SnapshotBundle } from "../../types.ts";
import { type DraftState, picksOf, teamsOf, valued } from "./draft.ts";
import { stepAt, type Team } from "./order.ts";
import {
	SUGGESTIONS,
	type Suggestion,
	type Suggestions,
	suggest,
} from "./suggest.ts";
import { cmPhase, comfort, metaAt, rankWeight } from "./value.ts";

export const ROOT_WIDTH = 8;
export const WIDTH = 5;
export const BUDGET_MS = 1500;

export interface SearchOptions {
	budgetMs?: number;
	now?: () => number;
	/** The deepest depth to try; the draft's remaining steps bound it anyway. */
	maxDepth?: number;
}

export interface SearchResult extends Suggestions {
	/** The deepest depth the search completed. */
	depth: number;
}

/** Thrown inside a depth the budget ran out on, so that depth is discarded. */
class OutOfTime extends Error {}

const ROLES: Role[] = [1, 2, 3, 4, 5];

/** The captain's team's value minus the enemy's. */
function evaluation(bundle: SnapshotBundle, state: DraftState): number {
	const { ours, theirs } = valued(bundle, teamsOf(bundle, state));
	return ours.total - theirs.total;
}

const entered = (state: DraftState, hero: HeroId): DraftState => ({
	...state,
	steps: [...state.steps, hero],
});

/**
 * `state` with its remaining picks made greedily and its remaining bans
 * skipped (design D8). Each pick is the untaken sufficient hero worth most in
 * one slot — rank-weighted meta and signature at the best position the team
 * still has open, plus its side and phase deltas — a cheaper reading than a
 * full re-evaluation per hero, which a leaf would need hundreds of; the
 * evaluation of the finished draft is still the full one.
 */
export function completed(
	bundle: SnapshotBundle,
	state: DraftState,
): DraftState {
	const teams = teamsOf(bundle, state);
	const open: Record<Team, Set<Role>> = {
		ours: new Set(
			ROLES.filter((k) => !teams.ours.slots.some((s) => s.position === k)),
		),
		theirs: new Set(
			ROLES.filter((k) => !teams.theirs.slots.some((s) => s.position === k)),
		),
	};
	const count = {
		ours: picksOf(state).ours.length,
		theirs: picksOf(state).theirs.length,
	};
	const taken = new Set(state.steps);
	const steps = [...state.steps];
	for (
		let at = stepAt(steps.length, state.pickOrder);
		at;
		at = stepAt(steps.length, state.pickOrder)
	) {
		if (at.action === "ban") {
			// A skipped ban holds its place with an id no hero has.
			steps.push(-steps.length - 1);
			continue;
		}
		const team = teams[at.team];
		let best: { hero: HeroId; position: Role; worth: number } | null = null;
		for (const hero of bundle.heroes) {
			if (!hero.sufficient || taken.has(hero.id)) continue;
			for (const position of open[at.team]) {
				const player =
					state[at.team].find((p) => p.position === position) ?? null;
				const worth =
					rankWeight(player, team.players) *
						(metaAt(hero, position) + comfort(player, hero.id)) +
					sideDelta(hero, team.side) +
					phaseDelta(hero, cmPhase(count[at.team]));
				if (best === null || worth > best.worth)
					best = { hero: hero.id, position, worth };
			}
		}
		if (best === null) {
			steps.push(-steps.length - 1);
			continue;
		}
		steps.push(best.hero);
		taken.add(best.hero);
		open[at.team].delete(best.position);
		count[at.team] += 1;
	}
	return { ...state, steps };
}

/** The evaluation the search reaches below `state`, `depth` moves deep. */
function reach(
	bundle: SnapshotBundle,
	state: DraftState,
	depth: number,
	alpha: number,
	beta: number,
	deadline: () => void,
): number {
	deadline();
	const at = stepAt(state.steps.length, state.pickOrder);
	if (at === null) return evaluation(bundle, state);
	// `suggest` answers null only past step 24, which the line above returns
	// before; the cast states that rather than a fallback no draft reaches.
	const moves =
		depth === 0 ? [] : (suggest(bundle, state, WIDTH) as Suggestions).entries;
	if (moves.length === 0) return evaluation(bundle, completed(bundle, state));

	const maximising = at.team === "ours";
	let best = maximising ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
	for (const move of moves) {
		const value = reach(
			bundle,
			entered(state, move.hero),
			depth - 1,
			alpha,
			beta,
			deadline,
		);
		if (maximising) {
			best = Math.max(best, value);
			// Stryker disable next-line MethodExpression: a bound that never tightens only stops pruning, which changes how long the search takes, not what it returns
			alpha = Math.max(alpha, value);
		} else {
			best = Math.min(best, value);
			// Stryker disable next-line MethodExpression: a bound that never tightens only stops pruning, which changes how long the search takes, not what it returns
			beta = Math.min(beta, value);
		}
		// Stryker disable next-line EqualityOperator: pruning on equal bounds or only past them skips branches that cannot change the value returned
		if (alpha >= beta) break;
	}
	return best;
}

/** The root's moves at `depth`, each scored by the evaluation reached. */
function ranked(
	bundle: SnapshotBundle,
	state: DraftState,
	roots: Suggestion[],
	depth: number,
	team: Team,
	deadline: () => void,
): Suggestion[] {
	const now = evaluation(bundle, state);
	const scored = roots.map((root) => {
		// Each root move gets a full window: its exact value ranks it.
		const reached = reach(
			bundle,
			entered(state, root.hero),
			depth - 1,
			Number.NEGATIVE_INFINITY,
			Number.POSITIVE_INFINITY,
			deadline,
		);
		const score = reached - now;
		const { lookahead, ...own } = root.components;
		const counted = Object.values(own).reduce((a, b) => a + b, 0);
		return {
			...root,
			score,
			components: { ...own, lookahead: score - counted },
		};
	});
	const drafting = team === "ours" ? 1 : -1;
	return scored
		.sort((a, b) => a.hero - b.hero)
		.sort((a, b) => drafting * (b.score - a.score));
}

/** The suggestions for the step in progress, from the deepest depth done. */
export function search(
	bundle: SnapshotBundle,
	state: DraftState,
	{
		budgetMs = BUDGET_MS,
		now = () => performance.now(),
		maxDepth = 24,
	}: SearchOptions = {},
): SearchResult | null {
	const root = suggest(bundle, state, ROOT_WIDTH);
	if (root === null) return null;
	const start = now();
	const deepest = Math.min(maxDepth, 24 - state.steps.length);

	let done: SearchResult | null = null;
	for (let depth = 1; depth <= deepest; depth++) {
		// Depth 1 always runs, so there is a ranking to show however tight the
		// budget; a deeper one is thrown away as soon as the budget runs out in
		// it — its first node checks, so a spent budget costs no more than that.
		const over = () => now() - start >= budgetMs;
		const deadline =
			depth === 1
				? () => {}
				: () => {
						if (over()) throw new OutOfTime();
					};
		try {
			const entries = ranked(
				bundle,
				state,
				root.entries,
				depth,
				root.team,
				deadline,
			);
			done = {
				...root,
				entries: entries.slice(0, SUGGESTIONS),
				depth,
			};
		} catch (error) {
			if (error instanceof OutOfTime) break;
			throw error;
		}
	}
	return done;
}
