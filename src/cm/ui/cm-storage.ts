/**
 * The CM session in localStorage (cm-draft, *The draft survives a reload*),
 * under a key of its own so the All Pick page's session is never read or
 * written here. Reads go through `parseSession`, which takes a stored copy
 * whole or falls back to an empty session.
 */
import { read, write } from "../../app/storage.ts";
import { type CmSession, emptySession, parseSession } from "./session.ts";

export const CM_SESSION_KEY = "cm.session";

export function restoreSession(): CmSession {
	const raw = read(CM_SESSION_KEY);
	if (raw === null) return emptySession();
	try {
		return parseSession(JSON.parse(raw));
	} catch {
		return emptySession();
	}
}

export function persistSession(session: CmSession): void {
	write(CM_SESSION_KEY, JSON.stringify(session));
}
