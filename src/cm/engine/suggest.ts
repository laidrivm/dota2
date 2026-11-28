/**
 * The immediate ranking for the step in progress (cm-model, *The step in
 * progress gets ranked suggestions*), one step deep: each eligible hero is
 * scored by how the evaluation moves if the team that would pick it does.
 *
 * - A pick's score is the evaluation's change when the drafting team takes
 *   the hero.
 * - A ban's score is the change it prevents: the other team taking the hero,
 *   undone.
 *
 * Scores are in the captain's terms throughout, so on an enemy step the
 * heroes best for the enemy are the most negative, and they come first.
 */
import { share } from "../../model-terms.ts";
import type { HeroId, Role, SnapshotBundle } from "../../types.ts";
import { type DraftState, picksOf, teamsOf, valued } from "./draft.ts";
import { type StepAction, stepAt, type Team } from "./order.ts";
import { PLAYABLE_SHARE, type ValueParts } from "./value.ts";

export const SUGGESTIONS = 5;

export interface Suggestion {
	hero: HeroId;
	score: number;
	/**
	 * The hero's own contribution by part, for whichever team would pick it,
	 * signed as it moves the score; `lookahead` is the rest of the score — at
	 * one step deep, how the other team's value moves.
	 */
	components: ValueParts & { lookahead: number };
}

export interface Suggestions {
	step: number;
	action: StepAction;
	team: Team;
	entries: Suggestion[];
}

const opposite = (team: Team): Team => (team === "ours" ? "theirs" : "ours");
const ROLES: Role[] = [1, 2, 3, 4, 5];

export function suggest(
	bundle: SnapshotBundle,
	state: DraftState,
	limit = SUGGESTIONS,
): Suggestions | null {
	const at = stepAt(state.steps.length, state.pickOrder);
	if (at === null) return null;

	const picks = picksOf(state);
	const teams = teamsOf(bundle, state, picks);
	const now = valued(bundle, teams);
	// Who would take the hero: the drafting team for a pick, the other for a ban.
	const picker = at.action === "pick" ? at.team : opposite(at.team);
	const rest = opposite(picker);
	const sign = picker === "ours" ? 1 : -1;
	const drafting = at.team === "ours" ? 1 : -1;
	// A ban scores the change it prevents, so its parts are signed the other way.
	const signed = at.action === "pick" ? sign : -sign;

	const taken = new Set(state.steps);
	const filled = new Set(teams[picker].slots.map((slot) => slot.position));
	const open = ROLES.filter((position) => !filled.has(position));

	const entries = bundle.heroes
		.filter(
			(hero) =>
				hero.sufficient &&
				!taken.has(hero.id) &&
				open.some((position) => share(hero, position) >= PLAYABLE_SHARE),
		)
		.map((hero): Suggestion => {
			const next = { ...picks, [picker]: [...picks[picker], hero.id] };
			const after = valued(bundle, teamsOf(bundle, state, next));
			const own = after[picker].parts;
			const was = now[picker].parts;
			const change =
				sign *
				(after[picker].total -
					now[picker].total -
					(after[rest].total - now[rest].total));
			const score = at.action === "pick" ? change : -change;
			const parts: ValueParts = {
				meta: signed * (own.meta - was.meta),
				comfort: signed * (own.comfort - was.comfort),
				side: signed * (own.side - was.side),
				phase: signed * (own.phase - was.phase),
				synergy: signed * (own.synergy - was.synergy),
				matchups: signed * (own.matchups - was.matchups),
			};
			const counted = Object.values(parts).reduce((a, b) => a + b, 0);
			return {
				hero: hero.id,
				score,
				components: { ...parts, lookahead: score - counted },
			};
		})
		// The lower id first, then — the sort being stable — best for the
		// drafting team: the highest score for the captain, the lowest for the
		// enemy, so a tie keeps the lower id ahead.
		.sort((a, b) => a.hero - b.hero)
		.sort((a, b) => drafting * (b.score - a.score))
		.slice(0, limit);

	return { step: state.steps.length + 1, ...at, entries };
}
