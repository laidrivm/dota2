import type { Session, SnapshotBundle } from "../types.ts";
import s from "./header.module.css";
import type { Action } from "./session.ts";
import { ROLE_UI, SessionControls, SIDE_LABEL } from "./session-controls.tsx";
import { formatProvenance } from "./snapshot.ts";

/**
 * No logo asset exists yet, so the product name is set in plain type.
 *
 * Once side and role are chosen the pair collapses to text with an `edit`
 * affordance; the same controls Setup uses come back in the editor panel
 * below (screens-spec §2.2).
 */
export function Header({
	bundle,
	session,
	apply,
	editorOpen,
	onToggleEditor,
	onNew,
	onUndo,
}: {
	bundle: SnapshotBundle;
	session: Session;
	apply: (action: Action) => void;
	editorOpen: boolean;
	onToggleEditor: () => void;
	onNew: () => void;
	/** Absent while there is nothing to undo — the control goes with it. */
	onUndo?: () => void;
}) {
	const isSetUp = session.side !== null && session.myRole !== null;

	return (
		<header class={s.header}>
			<div class={s.headerBar}>
				{isSetUp && (
					<>
						<button
							type="button"
							class={s.headerButton}
							aria-label="New draft"
							onClick={onNew}
						>
							New
						</button>
						{/* Lives exactly as long as the backup does (screens-spec §4). */}
						{onUndo !== undefined && (
							<button
								type="button"
								class={s.headerButton}
								aria-label="Undo the reset"
								onClick={onUndo}
							>
								Undo
							</button>
						)}
						<button
							type="button"
							class={s.sessionSummary}
							aria-expanded={editorOpen}
							onClick={onToggleEditor}
						>
							<span
								class={session.side === "dire" ? s.sideDire : s.sideRadiant}
							>
								{session.side === null ? "" : SIDE_LABEL[session.side]}
							</span>
							<span class={s.separator}>·</span>
							<span>
								{session.myRole === null ? "" : ROLE_UI[session.myRole].label}
							</span>
							<span class={s.editHint}>edit</span>
						</button>
					</>
				)}
				{/* The page's one h1: the product names this screen, and the
				    panels' h2s have nothing else above them. */}
				<h1 class={s.brand}>Dota 2 Pick Assistant</h1>
				<span class={s.provenance}>{formatProvenance(bundle)}</span>
			</div>

			{bundle.stabilizing && (
				<p class={s.banner}>new patch — stats are still stabilizing</p>
			)}

			{isSetUp && editorOpen && (
				<div class={s.sessionEditor}>
					<SessionControls session={session} apply={apply} />
					<button type="button" class={s.headerButton} onClick={onToggleEditor}>
						done
					</button>
				</div>
			)}
		</header>
	);
}
