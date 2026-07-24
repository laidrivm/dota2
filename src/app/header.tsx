import type { Session, SnapshotBundle } from "../types.ts";
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
		<header class="header">
			<div class="header-bar">
				{isSetUp && (
					<>
						<button
							type="button"
							class="header-button"
							aria-label="New draft"
							onClick={onNew}
						>
							New
						</button>
						{/* Lives exactly as long as the backup does (screens-spec §4). */}
						{onUndo !== undefined && (
							<button
								type="button"
								class="header-button"
								aria-label="Undo the reset"
								onClick={onUndo}
							>
								Undo
							</button>
						)}
						<button
							type="button"
							class="session-summary"
							aria-expanded={editorOpen}
							onClick={onToggleEditor}
						>
							<span class={`side-name side-${session.side}`}>
								{session.side === null ? "" : SIDE_LABEL[session.side]}
							</span>
							<span class="separator">·</span>
							<span class="role-name">
								{session.myRole === null ? "" : ROLE_UI[session.myRole].label}
							</span>
							<span class="edit-hint">edit</span>
						</button>
					</>
				)}
				<span class="brand">Dota 2 Pick Assistant</span>
				<span class="provenance">{formatProvenance(bundle)}</span>
			</div>

			{bundle.stabilizing && (
				<p class="banner">new patch — stats are still stabilizing</p>
			)}

			{isSetUp && editorOpen && (
				<div class="session-editor">
					<SessionControls session={session} apply={apply} />
					<button type="button" class="header-button" onClick={onToggleEditor}>
						done
					</button>
				</div>
			)}
		</header>
	);
}
