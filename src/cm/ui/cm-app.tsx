import { useEffect, useRef, useState } from "preact/hooks";
import { readSession, type SessionState, signOut } from "./api.ts";
import s from "./cm.module.css";
import { SignIn } from "./sign-in.tsx";

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
				// The draft board arrives with the setup step; until then a
				// signed-in captain sees the frame and the way out.
				return <p class={s.note}>Signed in.</p>;
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
						disabled={signingOut}
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
