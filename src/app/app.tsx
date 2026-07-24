import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { computeModel } from "../model.ts";
import type { HeroId, SnapshotBundle } from "../types.ts";
import { Board } from "./board/board.tsx";
import { Header } from "./header.tsx";
import { Picker } from "./picker/picker.tsx";
import {
	type Action,
	closesEditor,
	confirmsReset,
	type PickTarget,
	positionOf,
	usedAs,
	useSession,
} from "./session.ts";
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
	const [confirming, setConfirming] = useState(false);
	const [toast, setToast] = useState(false);
	const { session, apply, reset, undo, canUndo } = useSession({
		banLimit,
		editorOpen,
		modalOpen: pickTarget !== null || confirming,
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

	// The toast is the transient half of the undo window; the header control is
	// the durable half, so this timer hides one and never touches the backup.
	useEffect(() => {
		if (!toast) return;
		const timer = setTimeout(() => setToast(false), 5000);
		return () => clearTimeout(timer);
	}, [toast]);

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

	/** A finished draft is reset on the spot; anything less is worth asking. */
	const onNew = () => {
		if (confirmsReset(session)) {
			setConfirming(true);
			return;
		}
		reset();
		setToast(true);
	};

	return (
		<>
			<Header
				bundle={snapshot}
				session={session}
				apply={apply}
				editorOpen={editorOpen}
				onToggleEditor={() => setEditorOpen((open) => !open)}
				onNew={onNew}
				onUndo={canUndo ? undo : undefined}
			/>
			{isSetUp && model !== null ? (
				<Board
					bundle={snapshot}
					session={session}
					model={model}
					banLimit={banLimit}
					apply={apply}
					onPick={setPickTarget}
				/>
			) : (
				<main class="setup">
					<SessionControls session={session} apply={apply} />
				</main>
			)}
			{confirming && (
				<ResetDialog
					onAnswer={(confirmed) => {
						setConfirming(false);
						if (!confirmed) return;
						reset();
						setToast(true);
					}}
				/>
			)}
			{toast && canUndo && (
				<p class="toast" role="status">
					Draft reset
					<span class="separator">·</span>
					<button
						type="button"
						class="link-button"
						onClick={() => {
							undo();
							setToast(false);
						}}
					>
						Undo
					</button>
				</p>
			)}
			{pickTarget !== null && (
				<Picker
					bundle={snapshot}
					target={pickTarget}
					usedOf={(hero) => usedAs(session, hero)}
					onPick={(hero) => {
						apply(pickAction(pickTarget, hero));
						setPickTarget(null);
						focusAfterPick(pickTarget);
					}}
					onClose={() => setPickTarget(null)}
				/>
			)}
		</>
	);
}

const pickAction = (target: PickTarget, hero: HeroId): Action =>
	target.kind === "ban"
		? { kind: "banAdd", hero }
		: target.kind === "enemy"
			? { kind: "enemyAdd", hero }
			: { kind: "teamSet", role: target.role, hero };

/**
 * The dialog hands focus back to the trigger that opened it, and a filled slot
 * no longer has one. The replacement is focused after Preact commits — a
 * macrotask, because `rAF` runs before the commit and never fires in a hidden
 * tab — preferring the trigger where it survives (bans and enemies keep one)
 * and the new entry's removal control where it does not.
 */
function focusAfterPick(target: PickTarget): void {
	const position = positionOf(target);
	setTimeout(() => {
		// The last removal control of the position is the entry just added — the
		// first would hand a keyboard user the ✕ of somebody else's hero.
		const removals = document.querySelectorAll(`[data-remove="${position}"]`);
		const next =
			document.querySelector(`[data-pick="${position}"]:not(:disabled)`) ??
			removals[removals.length - 1];
		if (next instanceof HTMLElement) next.focus();
	}, 0);
}

/**
 * `Reset draft?` (screens-spec §4). A `form method="dialog"` closes the dialog
 * with the pressed button's value, so `Esc` (a native cancel, empty value) and
 * `Cancel` land in the same branch; `Reset` holds focus, which is what makes
 * `Enter` confirm without a key handler of our own.
 */
function ResetDialog({ onAnswer }: { onAnswer: (confirmed: boolean) => void }) {
	const dialog = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		dialog.current?.showModal();
	}, []);

	return (
		<dialog
			class="confirm"
			ref={dialog}
			aria-labelledby="reset-title"
			onClose={() => onAnswer(dialog.current?.returnValue === "reset")}
		>
			<form method="dialog">
				<h2 id="reset-title">Reset draft?</h2>
				<p>Bans and all picks will be cleared. Side and role stay.</p>
				<div class="confirm-actions">
					<button type="submit" value="cancel">
						Cancel
					</button>
					{/* `showModal()` honours `autofocus`, which is what makes `Enter`
					    confirm — without it the first control, Cancel, would answer. */}
					<button type="submit" value="reset" class="danger" autofocus>
						Reset
					</button>
				</div>
			</form>
		</dialog>
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
