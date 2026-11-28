import {
	useEffect,
	useLayoutEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "preact/hooks";
import { loadSnapshot } from "../../app/snapshot.ts";
import type { SnapshotBundle } from "../../types.ts";
import { withUploads } from "../engine/meta.ts";
import { readSession, type SessionState, signOut } from "./api.ts";
import { DraftBoard } from "./board.tsx";
import s from "./cm.module.css";
import { persistSession, restoreSession } from "./cm-storage.ts";
import { type MetaPositions, NO_META, readMeta } from "./meta-api.ts";
import { MetaPanel } from "./meta-panel.tsx";
import { Rosters } from "./rosters.tsx";
import { reduce } from "./session.ts";
import { Setup } from "./setup.tsx";
import { SignIn } from "./sign-in.tsx";
import { Suggestions } from "./suggestions.tsx";

/**
 * The signed-in screen: setup until the side and pick order are both set, then
 * the board — the step in progress and both rosters — with setup still above
 * it, editable until a step is entered. Every change is kept in the browser
 * and read back on the next load.
 */
function Draft() {
	const [snapshot, setSnapshot] = useState<SnapshotBundle | null | undefined>();
	const [meta, setMeta] = useState<MetaPositions>(NO_META);
	const [session, apply] = useReducer(reduce, undefined, restoreSession);

	useEffect(() => {
		loadSnapshot().then(setSnapshot);
		readMeta().then(setMeta);
	}, []);

	// The snapshot as the model reads it: uploaded positions take their meta
	// from d2pt (design D9). Kept by reference while neither changes, since a
	// new bundle is a new search worker.
	const bundle = useMemo(
		() => (snapshot ? withUploads(snapshot, meta) : snapshot),
		[snapshot, meta],
	);

	// Before paint, so a change the screen shows is already stored when a
	// reload reads it back — a reset confirmed then reloaded stays reset.
	useLayoutEffect(() => {
		persistSession(session);
	}, [session]);

	if (bundle === undefined) return <p class={s.note}>Loading heroes…</p>;
	if (bundle === null)
		return (
			<p class={s.note} role="status">
				The hero snapshot could not be loaded.
			</p>
		);

	const ready = session.side !== null && session.pickOrder !== null;
	return (
		<>
			<Setup session={session} apply={apply} />
			<MetaPanel positions={meta} onUploaded={() => readMeta().then(setMeta)} />
			{ready && (
				<>
					<DraftBoard bundle={bundle} session={session} apply={apply} />
					<Suggestions bundle={bundle} session={session} apply={apply} />
					<Rosters bundle={bundle} session={session} apply={apply} />
				</>
			)}
		</>
	);
}

/**
 * The Captains Mode page: one screen whose content follows the session the
 * API reports. Nothing here navigates — signing in and out swap what the
 * screen shows under the same `/cm`.
 */
export function CmApp() {
	const [state, setState] = useState<SessionState | null>(null);
	const [signOutError, setSignOutError] = useState<string | null>(null);
	const signOutButton = useRef<HTMLButtonElement>(null);
	const [signingOut, setSigningOut] = useState(false);

	useEffect(() => {
		readSession().then(setState);
	}, []);

	const afterSignIn = async () => {
		const next = await readSession();
		setState(next);
		// The form, and the field that held focus, unmount with this render; the
		// way out is where focus lands, in a macrotask so the button exists.
		if (next.kind === "signed-in")
			setTimeout(() => signOutButton.current?.focus(), 0);
	};

	const doSignOut = async () => {
		// One request at a time: a second one finishing after the first could
		// report a failure over a sign-out that went through.
		if (signingOut) return;
		setSigningOut(true);
		const result = await signOut();
		setSigningOut(false);
		if (result.kind === "error") {
			setSignOutError(result.message);
			return;
		}
		setSignOutError(null);
		setState(result);
	};

	const content = (() => {
		switch (state?.kind) {
			case undefined:
				return <p class={s.note}>Checking your session…</p>;
			case "signed-out":
				return (
					<SignIn
						onResult={(result) =>
							result.kind === "signed-in" ? afterSignIn() : setState(result)
						}
					/>
				);
			case "not-configured":
				return (
					<p class={s.note} role="status">
						The CM page is not configured on this server.
					</p>
				);
			case "unavailable":
				return (
					<p class={s.note} role="status">
						The CM service is unavailable.
					</p>
				);
			case "signed-in":
				return <Draft />;
		}
	})();

	return (
		<main class={s.page}>
			<header class={s.header}>
				<h1 class={s.title}>Captains Mode</h1>
				{state?.kind === "signed-in" && (
					<button
						ref={signOutButton}
						class={s.button}
						type="button"
						// Not disabled while signing out: disabling the focused button
						// drops focus, and the guard in doSignOut already stops a repeat.
						aria-busy={signingOut}
						onClick={doSignOut}
					>
						Sign out
					</button>
				)}
			</header>
			{signOutError !== null && (
				<p class={s.error} role="status">
					{signOutError}
				</p>
			)}
			{content}
		</main>
	);
}
