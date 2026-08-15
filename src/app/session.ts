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
	MAX_ENEMY_PICKS,
	ROLES,
	type Role,
	type Session,
	type Side,
} from "../types.ts";
import {
	type HotkeyContext,
	hotkeyContext,
	hotkeyFor,
	ownsKeystroke,
	pickerHotkey,
} from "./hotkeys.ts";
import {
	clearBackup,
	persist,
	readBackup,
	restore,
	writeBackup,
} from "./session-storage.ts";

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

/** Where a hero sits, if anywhere — and the word the picker prints on it. */
export type Used = "ban" | "team" | "enemy" | null;

/**
 * Where a hero sits on the board, if anywhere. One lookup answers both the
 * reducer's single-occupancy guard and the label the picker puts on a tile it
 * will not let you choose.
 */
export function usedAs(session: Session, hero: HeroId): Used {
	if (session.bans.includes(hero)) return "ban";
	if (ROLES.some((role) => session.teamPicks[`${role}`] === hero))
		return "team";
	return session.enemyPicks.includes(hero) ? "enemy" : null;
}

/** A hero is on the board once — as a ban, on my team, or on theirs. */
export const isUsed = (session: Session, hero: HeroId): boolean =>
	usedAs(session, hero) !== null;

/** Which position the picker is being opened for (screens-spec §3). */
export type PickTarget =
	| { kind: "ban" }
	| { kind: "team"; role: Role }
	| { kind: "enemy" };

/**
 * How a position is named in the DOM, so the board's controls and the focus
 * redirect after a pick cannot drift into two spellings of the same slot.
 */
export type Position = "ban" | "enemy" | `team-${Role}`;

export const positionOf = (target: PickTarget): Position =>
	target.kind === "team" ? `team-${target.role}` : target.kind;

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

/**
 * Whether the undo window closes: a hero entered starts the next draft, and
 * only the reducer knows whether one was — a ban refused at the limit enters
 * nothing. A side or role change never closes it; a reset keeps the setup on
 * purpose.
 */
export const closesUndoWindow = (
	before: Session,
	after: Session,
	action: Action,
): boolean =>
	after !== before &&
	(action.kind === "banAdd" ||
		action.kind === "teamSet" ||
		action.kind === "enemyAdd");

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
