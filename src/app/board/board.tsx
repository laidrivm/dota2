/**
 * The draft board (screens-spec §2): which panels are on screen, in what
 * order, and which of the three the model's state calls for. Each panel is
 * markup over `(session, model)` in a module of its own.
 */

import type { ModelOutput, Session, SnapshotBundle } from "../../types.ts";
import { cx } from "../cx.ts";
import { BansRow } from "./bans.tsx";
import s from "./board.module.css";
import panels from "./panels.module.css";
import { EnemyPanel, TeamPanel } from "./panels.tsx";
import type { Apply, OpenPicker } from "./pieces.tsx";
import { Result, Suggestions } from "./suggestions.tsx";

export function Board({
	bundle,
	session,
	model,
	banLimit,
	apply,
	onPick,
}: {
	bundle: SnapshotBundle;
	session: Session;
	model: ModelOutput;
	banLimit: number;
	apply: Apply;
	onPick: OpenPicker;
}) {
	const byId = new Map(bundle.heroes.map((hero) => [hero.id, hero]));

	// My team reads left on Radiant and right on Dire, as the game client puts it.
	const teams = cx(
		panels.teams,
		session.side === "dire" ? panels.teamsMirrored : undefined,
	);

	return (
		<main class={s.board}>
			<BansRow
				session={session}
				byId={byId}
				banLimit={banLimit}
				apply={apply}
				onPick={onPick}
			/>
			<div class={teams}>
				<TeamPanel
					session={session}
					byId={byId}
					apply={apply}
					onPick={onPick}
				/>
				<EnemyPanel
					session={session}
					model={model}
					byId={byId}
					apply={apply}
					onPick={onPick}
				/>
			</div>
			{model.winEstimate !== null ? (
				<Result estimate={model.winEstimate} />
			) : model.suggestions.length === 0 ? (
				<p class={s.boardHint} role="status">
					Add enemy picks to see win probability
				</p>
			) : (
				<Suggestions model={model} byId={byId} apply={apply} />
			)}
		</main>
	);
}
