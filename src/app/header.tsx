import type { Session, SnapshotBundle } from "../types.ts";
import type { Action } from "./session.ts";
import { ROLE_UI, SessionControls } from "./session-controls.tsx";
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
}: {
	bundle: SnapshotBundle;
	session: Session;
	apply: (action: Action) => void;
	editorOpen: boolean;
	onToggleEditor: () => void;
}) {
	const isSetUp = session.side !== null && session.myRole !== null;

	return (
		<header class="header">
			<div class="header-bar">
				{isSetUp && (
					<>
						{/* Reset is proposal 2c's. The control sits here now because the
						    header is built now, and it says so rather than pretending. */}
						<button
							type="button"
							class="header-button"
							disabled
							title="Reset arrives with the hero picker"
						>
							New
						</button>
						<button
							type="button"
							class="session-summary"
							aria-expanded={editorOpen}
							onClick={onToggleEditor}
						>
							<span class={`side-name side-${session.side}`}>
								{session.side === "radiant" ? "Radiant" : "Dire"}
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
