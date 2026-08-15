/**
 * What the draft looks like on the way to and from localStorage: the two keys,
 * the shape check a stored value has to pass, and the backup an undo restores.
 *
 * `storage.ts` below this owns the failure modes of the browser API; this file
 * owns what counts as a session once one comes back. Nothing here knows the
 * reducer, so it imports nothing from `session.ts`.
 */

import {
	EMPTY_SESSION,
	type HeroId,
	MAX_ENEMY_PICKS,
	ROLES,
	type Role,
	type Session,
} from "../types.ts";
import { read, remove, write } from "./storage.ts";

export const SESSION_KEY = "draft.session";
export const BACKUP_KEY = "draft.backup";

/**
 * A stored session is only usable if every field the UI reads holds a value the
 * UI's own comparisons recognise. Presence is not enough: a fragment without
 * `side` restores it as `undefined`, and the screen choice asks `side === null`,
 * so the board opens over a session that never chose a side.
 *
 * Hence every scalar is checked against its own domain and every list against
 * its members, and `teamPicks` is rejected when it is an array — indices `1` to
 * `5` answer `in` exactly as the role keys do.
 */
const isHeroId = (value: unknown): value is HeroId => typeof value === "number";

function isSession(value: unknown): value is Session {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const s = value as Partial<Session>;
	if (s.v !== 1) return false;
	if (typeof s.createdAt !== "string") return false;
	if (s.side !== null && s.side !== "radiant" && s.side !== "dire")
		return false;
	if (s.myRole !== null && !ROLES.includes(s.myRole as Role)) return false;
	if (!Array.isArray(s.bans) || !s.bans.every(isHeroId)) return false;
	if (
		!Array.isArray(s.enemyPicks) ||
		s.enemyPicks.length > MAX_ENEMY_PICKS ||
		!s.enemyPicks.every(isHeroId)
	) {
		return false;
	}
	const picks: unknown = s.teamPicks;
	if (typeof picks !== "object" || picks === null || Array.isArray(picks)) {
		return false;
	}
	return ROLES.every((role) => {
		const slot = (picks as Record<string, unknown>)[`${role}`];
		return `${role}` in picks && (slot === null || isHeroId(slot));
	});
}

/** Anything we cannot read back as a v1 session is treated as no session. */
export function restore(): Session {
	const raw = read(SESSION_KEY);
	if (raw === null) return EMPTY_SESSION();
	try {
		const parsed: unknown = JSON.parse(raw);
		return isSession(parsed) ? parsed : EMPTY_SESSION();
	} catch {
		return EMPTY_SESSION();
	}
}

export function persist(session: Session): void {
	write(SESSION_KEY, JSON.stringify(session));
}

/**
 * The one draft an undo can bring back (US-24). Persisted rather than held in
 * memory so a reload inside the toast window does not strand the draft; read
 * back through the same check as the session, because an undo offering a
 * broken draft is worse than no undo.
 */
export function readBackup(): Session | null {
	const raw = read(BACKUP_KEY);
	if (raw === null) return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		return isSession(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

export const writeBackup = (session: Session): void =>
	write(BACKUP_KEY, JSON.stringify(session));

export const clearBackup = (): void => remove(BACKUP_KEY);
