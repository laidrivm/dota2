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

	return (
		<>
			<Header bundle={snapshot} />
			{isSetUp ? (
				<div class="session-strip">
					<SessionControls session={session} apply={apply} />
				</div>
			) : (
				<main class="setup">
					<SessionControls session={session} apply={apply} />
				</main>
			)}
		</>
	);
}

function SnapshotError({ onRetry }: { onRetry: () => void }) {
	return (
		<div class="snapshot-error" role="status">
			<p>No snapshot could be loaded, and nothing is cached from before.</p>
			<button type="button" onClick={onRetry}>
				Retry
			</button>
		</div>
	);
}
