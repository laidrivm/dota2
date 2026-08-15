/**
 * The draft board (screens-spec §2).
 *
 * Every panel is markup over `(session, model)` — the branches live in
 * `format.ts`, and the only writes go through the `apply` this is handed.
 */

import type {
	HeroEntry,
	HeroId,
	ModelOutput,
	Session,
	Side,
	SnapshotBundle,
	WinEstimate,
} from "../../types.ts";
import { ROLES } from "../../types.ts";
import { cx } from "../cx.ts";
import { ROLE_UI, SIDE_LABEL } from "../session-controls.tsx";
import { BansRow } from "./bans.tsx";
import s from "./board.module.css";
import {
	formatAdvantage,
	formatPhase,
	formatScore,
	formatWinProbability,
	scoreTone,
	topRoles,
} from "./format.ts";
import { HeroTile } from "./hero-tile.tsx";
import panels from "./panels.module.css";
import {
	type Apply,
	type OpenPicker,
	PickEntry,
	RemoveButton,
	RepickBadge,
	ThinBadge,
} from "./pieces.tsx";
import readout from "./suggestions.module.css";

/** A side's tint is the same token wherever it is named. */
const sideClass = (side: Side) =>
	cx(
		panels.sideName,
		side === "radiant" ? panels.sideRadiant : panels.sideDire,
	);

/** A draft that is behind must not be printed in the winning colour. */
const toneClass = (pp: number) =>
	scoreTone(pp) === "pos" ? readout.scorePos : readout.scoreMuted;

function TeamPanel({
	session,
	byId,
	apply,
	onPick,
}: {
	session: Session;
	byId: Map<HeroId, HeroEntry>;
	apply: Apply;
	onPick: OpenPicker;
}) {
	const side = session.side as Side;

	return (
		<section class={panels.panel} data-region="my-team" aria-label="My team">
			<h2 class={panels.panelHead}>
				<span class={s.sectionLabel}>My team</span>
				<span class={sideClass(side)}>{SIDE_LABEL[side]}</span>
			</h2>
			{ROLES.map((role) => {
				const id = session.teamPicks[`${role}`];
				const hero = id === null ? undefined : byId.get(id);
				const mine = session.myRole === role;

				return (
					<div
						class={cx(panels.slot, mine ? panels.slotMine : undefined)}
						data-row={`team-${role}`}
						key={role}
					>
						<span class={panels.slotNumber}>{role}</span>
						<span class={s.roleStar}>{mine ? "★" : ""}</span>
						<span class={panels.slotRole}>{ROLE_UI[role].label}</span>
						<div class={panels.slotHero}>
							{id === null ? (
								<PickEntry
									label={`Pick for ${ROLE_UI[role].label}`}
									placeholder="+ pick"
									position={`team-${role}`}
									onOpen={() => onPick({ kind: "team", role })}
								/>
							) : (
								<>
									<HeroTile hero={hero} size="md" />
									<span class={panels.heroName}>{hero?.name ?? ""}</span>
									<ThinBadge hero={hero} />
									<RepickBadge hero={hero} />
								</>
							)}
						</div>
						{id !== null && (
							<RemoveButton
								label={`Remove ${hero?.name ?? "unknown hero"} from ${ROLE_UI[role].label}`}
								position={`team-${role}`}
								onClick={() => apply({ kind: "teamClear", role })}
							/>
						)}
					</div>
				);
			})}
		</section>
	);
}

function EnemyPanel({
	session,
	model,
	byId,
	apply,
	onPick,
}: {
	session: Session;
	model: ModelOutput;
	byId: Map<HeroId, HeroEntry>;
	apply: Apply;
	onPick: OpenPicker;
}) {
	const side: Side = session.side === "radiant" ? "dire" : "radiant";
	const roles = new Map(
		model.enemyRoles.map((entry) => [entry.hero, entry.probs]),
	);
	// Five slots always: the filled ones, then one entry control per free seat.
	const free = 5 - session.enemyPicks.length;

	return (
		<section class={panels.panel} data-region="enemy" aria-label="Enemy team">
			<h2 class={panels.panelHead}>
				<span class={s.sectionLabel}>Enemy team</span>
				<span class={sideClass(side)}>{SIDE_LABEL[side]}</span>
			</h2>
			{session.enemyPicks.map((id, index) => {
				const hero = byId.get(id);
				const probs = roles.get(id);

				return (
					<div class={panels.slot} data-row="enemy" key={id}>
						<div class={panels.slotHero}>
							<HeroTile hero={hero} size="md" />
							<div class={panels.enemyText}>
								<span class={panels.heroName}>{hero?.name ?? ""}</span>
								<span class={panels.enemyRoles}>
									{probs === undefined ? "" : topRoles(probs)}
								</span>
								<RepickBadge hero={hero} />
							</div>
						</div>
						<RemoveButton
							label={`Remove enemy pick ${hero?.name ?? "unknown hero"}`}
							position="enemy"
							onClick={() => apply({ kind: "enemyRemove", index })}
						/>
					</div>
				);
			})}
			{Array.from({ length: free }, (_, i) => (
				<div class={panels.slot} data-row="enemy" key={`free-${i}`}>
					<div class={panels.slotHero}>
						<PickEntry
							label="Enemy pick"
							placeholder="+ pick"
							position="enemy"
							onOpen={() => onPick({ kind: "enemy" })}
						/>
					</div>
				</div>
			))}
		</section>
	);
}

function Suggestions({
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

const Result = ({ estimate }: { estimate: WinEstimate }) => (
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
