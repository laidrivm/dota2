import { useEffect, useState } from "preact/hooks";
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

	useEffect(() => {
		readSession().then(setState);
	}, []);

	const content = (() => {
		switch (state?.kind) {
			case undefined:
				return <p class={s.note}>Checking your session…</p>;
			case "signed-out":
				return (
					<SignIn
						onResult={(result) =>
							result.kind === "signed-in"
								? readSession().then(setState)
								: setState(result)
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
						class={s.button}
						type="button"
						onClick={() => signOut().then(setState)}
					>
						Sign out
					</button>
				)}
			</header>
			{content}
		</main>
	);
}
