/**
 * What the draft looks like on the way to and from localStorage: the two keys,
 * the shape check a stored value has to pass, and the backup an undo restores.
 *
 * `storage.ts` below this owns the failure modes of the browser API; this file
 * owns what counts as a session once one comes back. Nothing here knows the
 * reducer, so it imports nothing from `session.ts`.
 */

import { EMPTY_SESSION, ROLES, type Session } from "../types.ts";
import { read, remove, write } from "./storage.ts";

export const SESSION_KEY = "draft.session";
export const BACKUP_KEY = "draft.backup";

/**
 * A stored session is only usable if every field the UI indexes is there —
 * a `{"v":1}` fragment would restore fine and then break the first slot
 * that reads `teamPicks`.
 */
function isSession(value: unknown): value is Session {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const s = value as Partial<Session>;
	if (s.v !== 1) return false;
	if (!Array.isArray(s.bans) || !Array.isArray(s.enemyPicks)) return false;
	const picks: unknown = s.teamPicks;
	if (typeof picks !== "object" || picks === null) return false;
	return ROLES.every((role) => `${role}` in picks);
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
