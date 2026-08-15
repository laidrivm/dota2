/**
 * What the model says (screens-spec §2): the per-role suggestion strips, and
 * the win estimate that replaces them once the draft carries one.
 */

import type {
	HeroEntry,
	HeroId,
	ModelOutput,
	WinEstimate,
} from "../../types.ts";
import { cx } from "../cx.ts";
import { ROLE_UI } from "../session-controls.tsx";
import s from "./board.module.css";
import {
	formatAdvantage,
	formatPhase,
	formatScore,
	formatWinProbability,
	scoreTone,
} from "./format.ts";
import { HeroTile } from "./hero-tile.tsx";
import panels from "./panels.module.css";
import { type Apply, ThinBadge } from "./pieces.tsx";
import readout from "./suggestions.module.css";

/** A draft that is behind must not be printed in the winning colour. */
const toneClass = (pp: number) =>
	scoreTone(pp) === "pos" ? readout.scorePos : readout.scoreMuted;

export function Suggestions({
	model,
	byId,
	apply,
}: {
	model: ModelOutput;
	byId: Map<HeroId, HeroEntry>;
	apply: Apply;
}) {
	return (
		<section class={panels.panel} aria-label="Suggestions">
			<h2 class={cx(panels.panelHead, panels.panelHeadRuled)}>
				<span class={s.sectionLabel}>Suggestions</span>
				<span class={readout.phase}>phase: {formatPhase(model.phase)}</span>
			</h2>
			{model.suggestions.map((block) => (
				<div
					class={cx(
						readout.suggestionRow,
						block.isMyRole ? readout.suggestionMine : undefined,
					)}
					key={block.role}
				>
					<h3 class={readout.suggestionRole}>
						<span class={s.roleStar}>{block.isMyRole ? "★" : ""}</span>
						{ROLE_UI[block.role].label}
					</h3>
					<div class={readout.suggestionStrip}>
						{block.entries.map((entry) => {
							const hero = byId.get(entry.hero);
							return (
								<button
									type="button"
									class={readout.suggestion}
									key={entry.hero}
									onClick={() =>
										apply({
											kind: "teamSet",
											role: block.role,
											hero: entry.hero,
										})
									}
								>
									<HeroTile
										hero={hero}
										size="sm"
										label={hero?.name ?? "Unknown hero"}
									/>
									<span class={cx(readout.score, toneClass(entry.score))}>
										{formatScore(entry.score)}
									</span>
									<ThinBadge hero={hero} />
								</button>
							);
						})}
					</div>
				</div>
			))}
		</section>
	);
}

export const Result = ({ estimate }: { estimate: WinEstimate }) => (
	<section class={panels.panel} aria-label="Result">
		<h2 class={cx(panels.panelHead, panels.panelHeadRuled)}>
			<span class={s.sectionLabel}>Result</span>
		</h2>
		<p class={readout.resultLine}>
			<span class={readout.resultLabel}>Draft advantage:</span>
			<span class={cx(readout.resultAdvantage, toneClass(estimate.advantage))}>
				{formatAdvantage(estimate.advantage)}
			</span>
			<span class={readout.resultArrow}>→</span>
			<span class={readout.resultWin}>
				{formatWinProbability(estimate.winProbability)}
			</span>
		</p>
	</section>
);
