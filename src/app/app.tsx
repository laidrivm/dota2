import { useEffect, useMemo, useState } from "preact/hooks";
import { computeModel } from "../model.ts";
import type { SnapshotBundle } from "../types.ts";
import { Board } from "./board/board.tsx";
import { Header } from "./header.tsx";
import { closesEditor, type PickTarget, useSession } from "./session.ts";
import { SessionControls } from "./session-controls.tsx";
import { loadSnapshot } from "./snapshot.ts";

export function App() {
	const [snapshot, setSnapshot] = useState<SnapshotBundle | null | "pending">(
		"pending",
	);
	const [editorOpen, setEditorOpen] = useState(false);
	// The picker is ephemeral: it lives here and never reaches the session or
	// storage, so a reload with it open comes back to the board (screens-spec §3).
	const [pickTarget, setPickTarget] = useState<PickTarget | null>(null);
	// No snapshot, no board, so no ban is possible — the limit is US-7's
	// "hero count minus the ten that get picked".
	const banLimit =
		snapshot === "pending" || snapshot === null
			? 0
			: snapshot.heroes.length - 10;
	const { session, apply } = useSession({
		banLimit,
		editorOpen,
		modalOpen: pickTarget !== null,
		openPicker: setPickTarget,
	});

	// The session is replaced whole on every change, so identity comparison is
	// exact and the whole model is recomputed synchronously — screens-spec §2.6
	// wants the new numbers in the same frame, and there are no spinners.
	// ponytail: recomputes everything every time; if a full 126-hero snapshot
	// misses the frame budget, a worker goes behind this same memo.
	const model = useMemo(
		() =>
			snapshot === "pending" || snapshot === null
				? null
				: computeModel(snapshot, session),
		[snapshot, session],
	);

	// One automatic fetch per page; anything further is the user's retry.
	useEffect(() => {
		loadSnapshot().then(setSnapshot);
	}, []);

	// The editor is the one modal state on this screen, so Esc leaves it. The
	// listener is unconditional — closing a closed editor is a no-op, and
	// subscribing only while it is open loses the first Esc after it opens.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (closesEditor(event)) setEditorOpen(false);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
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
			<Header
				bundle={snapshot}
				session={session}
				apply={apply}
				editorOpen={editorOpen}
				onToggleEditor={() => setEditorOpen((open) => !open)}
			/>
			{isSetUp && model !== null ? (
				<Board
					bundle={snapshot}
					session={session}
					model={model}
					banLimit={banLimit}
					apply={apply}
				/>
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
