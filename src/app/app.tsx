import { useEffect, useState } from "preact/hooks";
import { Header } from "./header.tsx";
import { useSession } from "./session.ts";
import { SessionControls } from "./session-controls.tsx";
import { loadSnapshot, type SnapshotResult } from "./snapshot.ts";

export function App() {
	const [result, setResult] = useState<SnapshotResult | null>(null);
	const { session, apply } = useSession();

	// One automatic fetch per page; anything further is the user's retry.
	useEffect(() => {
		loadSnapshot().then(setResult);
	}, []);

	// Nothing to show until the snapshot resolves — the design has no spinners.
	if (result === null) return null;

	if (!result.ok) {
		return (
			<SnapshotError
				onRetry={() => {
					setResult(null);
					loadSnapshot().then(setResult);
				}}
			/>
		);
	}

	// The board expands as soon as both are chosen — no confirm step.
	const isSetUp = session.side !== null && session.myRole !== null;

	return (
		<>
			<Header bundle={result.bundle} />
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
