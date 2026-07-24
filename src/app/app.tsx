import { useEffect, useState } from "preact/hooks";
import type { SnapshotBundle } from "../types.ts";
import { Header } from "./header.tsx";
import { closesEditor, useSession } from "./session.ts";
import { SessionControls } from "./session-controls.tsx";
import { loadSnapshot } from "./snapshot.ts";

export function App() {
	const [snapshot, setSnapshot] = useState<SnapshotBundle | null | "pending">(
		"pending",
	);
	const [editorOpen, setEditorOpen] = useState(false);
	// No snapshot, no board, so no ban is possible — the limit is US-7's
	// "hero count minus the ten that get picked".
	const banLimit =
		snapshot === "pending" || snapshot === null
			? 0
			: snapshot.heroes.length - 10;
	const { session, apply } = useSession(banLimit, editorOpen);

	// One automatic fetch per page; anything further is the user's retry.
	useEffect(() => {
		loadSnapshot().then(setSnapshot);
	}, []);

	// The editor is the one modal state on this screen, so Esc leaves it.
	useEffect(() => {
		if (!editorOpen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (closesEditor(event)) setEditorOpen(false);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [editorOpen]);

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
			<Header
				bundle={snapshot}
				session={session}
				apply={apply}
				editorOpen={editorOpen}
				onToggleEditor={() => setEditorOpen((open) => !open)}
			/>
			{isSetUp ? null : (
				<main class="setup">
					<SessionControls session={session} apply={apply} />
				</main>
			)}
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
