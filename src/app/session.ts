/**
 * The draft session: the one piece of state the app owns.
 *
 * Everything here is a plain function of its arguments so it can be tested
 * without a DOM; `useSession` is the thin Preact wrapper around it.
 */

import { useEffect, useRef, useState } from "preact/hooks";
import {
	EMPTY_SESSION,
	type HeroId,
	ROLES,
	type Role,
	type Session,
	type Side,
} from "../types.ts";
import { read, remove, write } from "./storage.ts";

export const SESSION_KEY = "draft.session";
export const BACKUP_KEY = "draft.backup";

/** Every way the draft can change. The picker in proposal 2c dispatches
 * these same actions, so it adds a trigger and not a second write path. */
export type Action =
	| { kind: "side"; side: Side }
	| { kind: "role"; role: Role }
	| { kind: "banAdd"; hero: HeroId }
	| { kind: "banRemove"; index: number }
	| { kind: "teamSet"; role: Role; hero: HeroId }
	| { kind: "teamClear"; role: Role }
	| { kind: "enemyAdd"; hero: HeroId }
	| { kind: "enemyRemove"; index: number };

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
 * Where a hero sits on the board, if anywhere. One lookup answers both the
 * reducer's single-occupancy guard and the label the picker puts on a tile it
 * will not let you choose.
 */
export function usedAs(
	session: Session,
	hero: HeroId,
): "ban" | "team" | "enemy" | null {
	if (session.bans.includes(hero)) return "ban";
	if (ROLES.some((role) => session.teamPicks[`${role}`] === hero))
		return "team";
	return session.enemyPicks.includes(hero) ? "enemy" : null;
}

/** A hero is on the board once — as a ban, on my team, or on theirs. */
export const isUsed = (session: Session, hero: HeroId): boolean =>
	usedAs(session, hero) !== null;

const MAX_ENEMY_PICKS = 5;

/** Which position the picker is being opened for (screens-spec §3). */
export type PickTarget =
	| { kind: "ban" }
	| { kind: "team"; role: Role }
	| { kind: "enemy" };

/**
 * What the board's own keys do (screens-spec §5): open the picker for a
 * position rather than change the session. A position that cannot take a hero
 * opens nothing — the picker would have no action to dispatch.
 *
 * Kept apart from `hotkeyFor` because a UI intent and a session mutation are
 * different things; the caller picks between them on the context.
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

const removeAt = <T>(list: T[], index: number): T[] =>
	index < 0 || index >= list.length ? list : list.filter((_, i) => i !== index);

/**
 * The single write path for the draft. Every refusal returns the session
 * unchanged rather than throwing: the UI disables what cannot be done, and a
 * race against that is not worth an error path.
 *
 * `banLimit` is `snapshot.heroes.length - 10` (US-7) — the caller holds the
 * snapshot, this function does not.
 */
export function applyAction(
	session: Session,
	action: Action,
	banLimit: number,
): Session {
	switch (action.kind) {
		case "side":
			return { ...session, side: action.side };
		case "role":
			return { ...session, myRole: action.role };
		case "banAdd":
			return session.bans.length >= banLimit || isUsed(session, action.hero)
				? session
				: { ...session, bans: [...session.bans, action.hero] };
		case "banRemove":
			return { ...session, bans: removeAt(session.bans, action.index) };
		case "teamSet":
			return isUsed(session, action.hero)
				? session
				: {
						...session,
						teamPicks: {
							...session.teamPicks,
							[`${action.role}`]: action.hero,
						},
					};
		case "teamClear":
			return {
				...session,
				teamPicks: { ...session.teamPicks, [`${action.role}`]: null },
			};
		case "enemyAdd":
			return session.enemyPicks.length >= MAX_ENEMY_PICKS ||
				isUsed(session, action.hero)
				? session
				: { ...session, enemyPicks: [...session.enemyPicks, action.hero] };
		case "enemyRemove":
			return {
				...session,
				enemyPicks: removeAt(session.enemyPicks, action.index),
			};
	}
}

/**
 * What `New` leaves behind (screens-spec §4): the draft is gone, the setup
 * stays — which is what the confirmation dialog promises, and what the next
 * game needs.
 */
export const resetDraft = (session: Session): Session => ({
	...EMPTY_SESSION(),
	side: session.side,
	myRole: session.myRole,
});

const PICKS_IN_A_DRAFT = 10;

/** A finished draft resets without asking; an unfinished one is worth a
 * dialog, because it is work the user cannot get back except through undo. */
export function confirmsReset(session: Session): boolean {
	const mine = ROLES.filter(
		(role) => session.teamPicks[`${role}`] !== null,
	).length;
	return mine + session.enemyPicks.length < PICKS_IN_A_DRAFT;
}

/** The actions that start the next draft, and so close the undo window. A
 * side or role change does not: a reset keeps the setup on purpose. */
export const endsUndoWindow = (action: Action): boolean =>
	action.kind === "banAdd" ||
	action.kind === "teamSet" ||
	action.kind === "enemyAdd";

/**
 * Whether the undo window closes — which is decided by what the reducer did,
 * not by what was asked. A ban refused at the limit enters no hero, so it must
 * leave the backup alone.
 */
export const closesUndoWindow = (
	before: Session,
	after: Session,
	action: Action,
): boolean => after !== before && endsUndoWindow(action);

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

export function useSession({
	banLimit,
	editorOpen,
	modalOpen,
	openPicker,
}: {
	banLimit: number;
	editorOpen: boolean;
	modalOpen: boolean;
	openPicker: (target: PickTarget) => void;
}) {
	const [session, setSession] = useState(restore);
	// Read back at startup, so a reload inside the undo window still offers it.
	const [backup, setBackup] = useState(readBackup);

	const forget = () => {
		clearBackup();
		setBackup(null);
	};

	/** Every change is written through, so a reload loses nothing. */
	const apply = (action: Action) =>
		setSession((previous) => {
			const next = applyAction(previous, action, banLimit);
			if (next === previous) return previous;
			persist(next);
			if (backup !== null && closesUndoWindow(previous, next, action)) forget();
			return next;
		});

	/** The outgoing draft becomes the one thing `Undo` can bring back. */
	const reset = () =>
		setSession((previous) => {
			const next = resetDraft(previous);
			writeBackup(previous);
			setBackup(previous);
			persist(next);
			return next;
		});

	const undo = () => {
		if (backup === null) return;
		persist(backup);
		setSession(backup);
		forget();
	};

	// What the listener below needs and cannot capture: re-subscribing on every
	// context change loses the first keystroke after the editor opens, because
	// effects flush a frame late and the key arrives before the new listener.
	const latest = useRef({
		context: "setup" as HotkeyContext,
		apply,
		session,
		banLimit,
		openPicker,
	});
	latest.current = {
		context: hotkeyContext(session, editorOpen, modalOpen),
		apply,
		session,
		banLimit,
		openPicker,
	};

	// Hotkeys are listened for on the document so they work without anything
	// being focused. Installed once, reading both the context and the current
	// `apply` through the ref above.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (ownsKeystroke(event.target as HTMLElement | null)) return;
			const current = latest.current;
			if (current.context === "board") {
				const target = pickerHotkey(event, current.session, current.banLimit);
				if (target) current.openPicker(target);
				return;
			}
			const hotkey = hotkeyFor(event, current.context);
			if (hotkey) current.apply(hotkey);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	return { session, apply, reset, undo, canUndo: backup !== null };
}
