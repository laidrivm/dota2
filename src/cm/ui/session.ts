/**
 * The CM page's own state: the setup a captain enters and both rosters. The
 * draft's steps join it with the draft order; persistence comes after that.
 * A reducer, so every edit is a value in, a value out, and a test is a list
 * of actions.
 */
import type { HeroId, Role, Side } from "../../types.ts";

export type PickOrder = "first" | "second";
export type Team = "ours" | "theirs";
/** Herald (1) to Immortal (8). */
export type RankTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Medal names by tier: `RANK_NAMES[tier - 1]`. */
export const RANK_NAMES =
	"Herald Guardian Crusader Archon Legend Ancient Divine Immortal".split(" ");

/** cm-draft: *Rosters describe both teams*. */
export const SIGNATURE_LIMIT = 10;
export const NICKNAME_MAX = 24;

export interface Player {
	nickname: string;
	position: Role | null;
	rank: RankTier | null;
	signatures: HeroId[];
}

export interface CmSession {
	v: 1;
	side: Side | null;
	pickOrder: PickOrder | null;
	ours: Player[];
	theirs: Player[];
}

const player = (prefix: string, index: number): Player => ({
	nickname: `${prefix} ${index + 1}`,
	position: null,
	rank: null,
	signatures: [],
});

export const emptySession = (): CmSession => ({
	v: 1,
	side: null,
	pickOrder: null,
	ours: [0, 1, 2, 3, 4].map((i) => player("Player", i)),
	theirs: [0, 1, 2, 3, 4].map((i) => player("Enemy", i)),
});

export type CmAction =
	| { type: "side"; side: Side }
	| { type: "pickOrder"; pickOrder: PickOrder }
	| { type: "nickname"; team: Team; index: number; name: string }
	| { type: "position"; team: Team; index: number; position: Role | null }
	| { type: "rank"; team: Team; index: number; rank: RankTier | null }
	| { type: "addSignature"; team: Team; index: number; hero: HeroId }
	| { type: "removeSignature"; team: Team; index: number; hero: HeroId };

const isRank = (value: unknown): value is RankTier =>
	Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 8;

const isRole = (value: unknown): value is Role =>
	Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5;

/** `session` with player `index` of `team` replaced by `edit` of it. */
function editPlayer(
	session: CmSession,
	team: Team,
	index: number,
	edit: (player: Player) => Player,
): CmSession {
	const roster = session[team];
	const current = roster[index];
	if (current === undefined) return session;
	const next = edit(current);
	if (next === current) return session;
	return { ...session, [team]: roster.map((p, i) => (i === index ? next : p)) };
}

export function reduce(session: CmSession, action: CmAction): CmSession {
	switch (action.type) {
		case "side":
			return { ...session, side: action.side };
		case "pickOrder":
			return { ...session, pickOrder: action.pickOrder };
		case "nickname": {
			const name = action.name.trim();
			if (name === "" || name.length > NICKNAME_MAX) return session;
			return editPlayer(session, action.team, action.index, (p) => ({
				...p,
				nickname: name,
			}));
		}
		case "position": {
			const { team, index, position } = action;
			if (position !== null && !isRole(position)) return session;
			// A position held twice moves: the earlier holder becomes unknown, so
			// the team's known positions stay distinct at every step.
			const roster = session[team].map((p, i) =>
				i === index
					? { ...p, position }
					: position !== null && p.position === position
						? { ...p, position: null }
						: p,
			);
			return { ...session, [team]: roster };
		}
		case "rank":
			if (action.rank !== null && !isRank(action.rank)) return session;
			return editPlayer(session, action.team, action.index, (p) => ({
				...p,
				rank: action.rank,
			}));
		case "addSignature":
			return editPlayer(session, action.team, action.index, (p) =>
				p.signatures.includes(action.hero) ||
				p.signatures.length >= SIGNATURE_LIMIT
					? p
					: { ...p, signatures: [...p.signatures, action.hero] },
			);
		case "removeSignature":
			return editPlayer(session, action.team, action.index, (p) => ({
				...p,
				signatures: p.signatures.filter((hero) => hero !== action.hero),
			}));
	}
}

/** Whether `roster` holds each of the five positions exactly once. */
export const positionsComplete = (roster: Player[]): boolean =>
	[1, 2, 3, 4, 5].every(
		(role) => roster.filter((p) => p.position === role).length === 1,
	);

const isPlayer = (value: unknown): value is Player => {
	if (typeof value !== "object" || value === null) return false;
	const p = value as Record<string, unknown>;
	return (
		typeof p.nickname === "string" &&
		p.nickname.trim() !== "" &&
		p.nickname.length <= NICKNAME_MAX &&
		(p.position === null || isRole(p.position)) &&
		(p.rank === null || isRank(p.rank)) &&
		Array.isArray(p.signatures) &&
		p.signatures.length <= SIGNATURE_LIMIT &&
		p.signatures.every((hero) => Number.isInteger(hero))
	);
};

const isRoster = (value: unknown): value is Player[] =>
	Array.isArray(value) && value.length === 5 && value.every(isPlayer);

/**
 * A stored session read back whole, or an empty one: a copy from another
 * version, or one edited by hand into a shape this code never writes, is not
 * patched field by field.
 */
export function parseSession(stored: unknown): CmSession {
	if (typeof stored !== "object" || stored === null) return emptySession();
	const s = stored as Record<string, unknown>;
	const valid =
		s.v === 1 &&
		(s.side === null || s.side === "radiant" || s.side === "dire") &&
		(s.pickOrder === null ||
			s.pickOrder === "first" ||
			s.pickOrder === "second") &&
		isRoster(s.ours) &&
		isRoster(s.theirs);
	return valid ? (stored as CmSession) : emptySession();
}
