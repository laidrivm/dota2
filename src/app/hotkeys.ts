/**
 * The keyboard layer (screens-spec §5): what a keystroke means, and where.
 *
 * Nothing here touches the session — every function is a plain function of a
 * keystroke and the context it arrives in, so it is testable without a DOM.
 * `session.ts` is what turns the answer into a write.
 */

import {
	MAX_ENEMY_PICKS,
	type Role,
	type Session,
	type Side,
} from "../types.ts";
// Type-only, so nothing of `session.ts` survives into this module at runtime
// and the two do not form a cycle.
import type { Action, PickTarget } from "./session.ts";

/** The two actions a keystroke can produce. */
export type Hotkey = Extract<Action, { kind: "side" | "role" }>;

/** Just the parts of a keystroke the hotkey layer reads, so it is testable
 * without a DOM. */
export type Keystroke = Pick<
	KeyboardEvent,
	"key" | "ctrlKey" | "metaKey" | "altKey"
>;

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
 * Where a keystroke lands (screens-spec §5). Side and role keys belong to
 * Setup and to the header editor; on the board the same keys open the picker
 * for a slot instead, and while a modal is up nothing outside it fires.
 */
export type HotkeyContext = "modal" | "setup" | "editor" | "board";

/**
 * The topmost active context. A modal `<dialog>` still bubbles its keystrokes
 * to the document listener underneath, so it has to be asked about first.
 */
export function hotkeyContext(
	session: Session,
	editorOpen: boolean,
	modalOpen: boolean,
): HotkeyContext {
	if (modalOpen) return "modal";
	if (editorOpen) return "editor";
	return session.side === null || session.myRole === null ? "setup" : "board";
}

const unmodified = (event: Keystroke) =>
	!(event.ctrlKey || event.metaKey || event.altKey);

/**
 * A focused control that reads characters itself owns the keystroke — a
 * `<select>` types ahead, and the picker's search field in 2c will too.
 * Radios and checkboxes are excluded: the side and role chips are radios, and
 * they are the very controls these hotkeys exist to drive.
 */
export function ownsKeystroke(
	target: {
		tagName?: string;
		type?: string;
		isContentEditable?: boolean;
	} | null,
): boolean {
	if (target === null) return false;
	if (target.isContentEditable === true) return true;
	if (target.tagName === "SELECT" || target.tagName === "TEXTAREA") return true;
	const type = target.type?.toLowerCase();
	return target.tagName === "INPUT" && type !== "radio" && type !== "checkbox";
}

/** `Esc` leaves the header editor; 2c gives it the picker and the dialog. */
export const closesEditor = (event: Keystroke): boolean =>
	event.key === "Escape" && unmodified(event);

/**
 * A modified keystroke belongs to the browser, not to us — Cmd+R has to stay
 * a reload.
 */
export function hotkeyFor(
	event: Keystroke,
	context: HotkeyContext,
): Hotkey | null {
	if ((context !== "setup" && context !== "editor") || !unmodified(event)) {
		return null;
	}
	const key = event.key.toLowerCase();
	const side = SIDE_KEYS[key];
	if (side) return { kind: "side", side };
	const role = ROLE_KEYS[key];
	if (role) return { kind: "role", role };
	return null;
}

/**
 * What the board's own keys do (screens-spec §5): open the picker for a
 * position rather than change the session. A position that cannot take a hero
 * opens nothing — the picker would have no action to dispatch.
 *
 * A separate function from `hotkeyFor` rather than a branch inside it, because
 * a UI intent and a session mutation are different things; the caller picks
 * between them on the context.
 */
export function pickerHotkey(
	event: Keystroke,
	session: Session,
	banLimit: number,
): PickTarget | null {
	if (!unmodified(event)) return null;
	const key = event.key.toLowerCase();
	if (key === "b") {
		return session.bans.length >= banLimit ? null : { kind: "ban" };
	}
	if (key === "e") {
		return session.enemyPicks.length >= MAX_ENEMY_PICKS
			? null
			: { kind: "enemy" };
	}
	const role = ROLE_KEYS[key];
	return role ? { kind: "team", role } : null;
}
