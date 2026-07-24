import { useEffect, useState } from "preact/hooks";
import type { SnapshotBundle } from "../types.ts";
import { Header } from "./header.tsx";
import { useSession } from "./session.ts";
import { SessionControls } from "./session-controls.tsx";
import { loadSnapshot } from "./snapshot.ts";

export function App() {
	const [snapshot, setSnapshot] = useState<SnapshotBundle | null | "pending">(
		"pending",
	);
	const { session, apply } = useSession();

	// One automatic fetch per page; anything further is the user's retry.
	useEffect(() => {
		loadSnapshot().then(setSnapshot);
	}, []);

	// Nothing to show until the snapshot resolves — the design has no spinners.
	if (snapshot === "pending") return null;

	if (snapshot === null) {
		return (
			<SnapshotError
				onRetry={() => {
					setSnapshot("pending");
					loadSnapshot().then(setSnapshot);
				}}
			/>
		);
	}

	// The board expands as soon as both are chosen — no confirm step.
	const isSetUp = session.side !== null && session.myRole !== null;

	// Setup is the same controls as the header strip, only centered — so the
	// two states differ by a class, not by markup.
	return (
		<>
			<Header bundle={snapshot} />
			<main class={isSetUp ? "session-strip" : "setup"}>
				<SessionControls session={session} apply={apply} />
			</main>
		</>
	);
}

function SnapshotError({ onRetry }: { onRetry: () => void }) {
	return (
		<main class="snapshot-error">
			{/* role lives on the message, not on <main>, so the landmark survives */}
			<p role="status">
				No snapshot could be loaded, and nothing is cached from before.
			</p>
			<button type="button" onClick={onRetry}>
				Retry
			</button>
		</main>
	);
}
