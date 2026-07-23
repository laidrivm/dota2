/**
 * The draft session: the one piece of state the app owns.
 *
 * Everything here is a plain function of its arguments so it can be tested
 * without a DOM; `useSession` is the thin Preact wrapper around it.
 */

import { useEffect, useState } from "preact/hooks";
import { EMPTY_SESSION, type Role, type Session, type Side } from "../types.ts";
import { read, write } from "./storage.ts";

export const SESSION_KEY = "draft.session";

export type Hotkey =
	| { kind: "side"; side: Side }
	| { kind: "role"; role: Role };

/** Keystroke as the hotkey layer sees it — a KeyboardEvent satisfies it. */
export interface Keystroke {
	key: string;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
}

const SIDE_KEYS: Record<string, Side> = { r: "radiant", d: "dire" };

const ROLE_KEYS: Record<string, Role> = {
	"1": 1,
	"2": 2,
	"3": 3,
	"4": 4,
	"5": 5,
	c: 1,
	m: 2,
	o: 3,
	s: 4,
	f: 5,
};

/**
 * A modified keystroke belongs to the browser, not to us — Cmd+R has to stay
 * a reload.
 */
export function hotkeyFor(event: Keystroke): Hotkey | null {
	if (event.ctrlKey || event.metaKey || event.altKey) return null;
	const key = event.key.toLowerCase();
	const side = SIDE_KEYS[key];
	if (side) return { kind: "side", side };
	const role = ROLE_KEYS[key];
	if (role) return { kind: "role", role };
	return null;
}

export function applyHotkey(session: Session, hotkey: Hotkey): Session {
	return hotkey.kind === "side"
		? { ...session, side: hotkey.side }
		: { ...session, myRole: hotkey.role };
}

function isSession(value: unknown): value is Session {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		(value as Session).v === 1
	);
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

export function useSession() {
	const [session, setSession] = useState(restore);

	/** Every change is written through, so a reload loses nothing. */
	const apply = (hotkey: Hotkey) =>
		setSession((previous) => {
			const next = applyHotkey(previous, hotkey);
			persist(next);
			return next;
		});

	// Hotkeys are listened for on the document so they work without anything
	// being focused. The listener is installed once: `apply` only ever reads
	// the session through the state updater, so it needs no fresh closure.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const hotkey = hotkeyFor(event);
			if (hotkey) apply(hotkey);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	return { session, apply };
}
