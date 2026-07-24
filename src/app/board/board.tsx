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
import type { Action, PickTarget, Position } from "../session.ts";
import { ROLE_UI, SIDE_LABEL } from "../session-controls.tsx";
import {
	formatAdvantage,
	formatPhase,
	formatScore,
	formatWinProbability,
	scoreTone,
	topRoles,
} from "./format.ts";
import { HeroTile } from "./hero-tile.tsx";

type Apply = (action: Action) => void;
type OpenPicker = (target: PickTarget) => void;

/**
 * The one way a hero enters the draft: a button that opens the picker for this
 * position. `position` is what the focus redirect after a pick looks for.
 */
function PickEntry({
	label,
	placeholder,
	position,
	onOpen,
	disabled,
	title,
}: {
	label: string;
	placeholder: string;
	position: Position;
	onOpen: () => void;
	disabled?: boolean;
	title?: string;
}) {
	return (
		<button
			type="button"
			class="pick-entry"
			data-pick={position}
			aria-label={label}
			disabled={disabled}
			title={title}
			onClick={onOpen}
		>
			{placeholder}
		</button>
	);
}

/**
 * Removal unmounts the button that did it, which would drop focus onto the
 * body. Focus goes to the control that took its place instead: the slot's own
 * pick-entry where the row survives, the region's first one where it does not.
 */
function RemoveButton({
	label,
	position,
	onClick,
}: {
	label: string;
	position: Position;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			class="remove"
			data-remove={position}
			aria-label={label}
			onClick={(event) => {
				const row = event.currentTarget.closest(".slot, .ban");
				const region = event.currentTarget.closest(".panel, .bans");
				onClick();
				// After Preact commits: it renders on a microtask, so a macrotask is
				// the first point the replacement control exists. `rAF` is not — it
				// runs before the commit, and never at all in a hidden tab.
				setTimeout(() => {
					const next =
						(row?.isConnected ? row.querySelector(".pick-entry") : null) ??
						region?.querySelector(".pick-entry");
					if (next instanceof HTMLElement) next.focus();
				}, 0);
			}}
		>
			✕
		</button>
	);
}

/** A hero the loaded snapshot no longer carries (screens-spec §6.4): the entry
 * stays put, says so, and waits to be replaced. */
const RepickBadge = ({ hero }: { hero: HeroEntry | undefined }) =>
	hero === undefined ? <span class="repick-badge">re-pick</span> : null;

const ThinBadge = ({ hero }: { hero: HeroEntry | undefined }) =>
	hero?.sufficient === false ? (
		<span class="thin-badge">insufficient data</span>
	) : null;

function BansRow({
	session,
	byId,
	banLimit,
	apply,
	onPick,
}: {
	session: Session;
	byId: Map<HeroId, HeroEntry>;
	banLimit: number;
	apply: Apply;
	onPick: OpenPicker;
}) {
	const atLimit = session.bans.length >= banLimit;

	return (
		<section class="bans" aria-label="Bans">
			<h2 class="section-label">Bans</h2>
			<div class="bans-strip">
				{session.bans.map((id, index) => {
					const hero = byId.get(id);
					return (
						<div class="ban" key={id}>
							<HeroTile
								hero={hero}
								size="lg"
								label={hero?.name ?? "Unknown hero"}
							/>
							<RepickBadge hero={hero} />
							<RemoveButton
								label={`Remove ban ${hero?.name ?? "unknown hero"}`}
								position="ban"
								onClick={() => apply({ kind: "banRemove", index })}
							/>
						</div>
					);
				})}
				<PickEntry
					// A disabled control's `title` is not announced, so the reason
					// rides along in the name a screen reader does read.
					label={
						atLimit
							? `Add ban — limit reached, ${banLimit} for this snapshot`
							: "Add ban"
					}
					placeholder="+ Add ban"
					position="ban"
					disabled={atLimit}
					title={
						atLimit
							? `Ban limit reached — ${banLimit} for this snapshot`
							: undefined
					}
					onOpen={() => onPick({ kind: "ban" })}
				/>
			</div>
		</section>
	);
}

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
		<section class="panel my-team" aria-label="My team">
			<h2 class="panel-head">
				<span class="section-label">My team</span>
				<span class={`side-name side-${side}`}>{SIDE_LABEL[side]}</span>
			</h2>
			{ROLES.map((role) => {
				const id = session.teamPicks[`${role}`];
				const hero = id === null ? undefined : byId.get(id);
				const mine = session.myRole === role;

				return (
					<div class={`slot${mine ? " slot-mine" : ""}`} key={role}>
						<span class="slot-number">{role}</span>
						<span class="slot-star">{mine ? "★" : ""}</span>
						<span class="slot-role">{ROLE_UI[role].label}</span>
						<div class="slot-hero">
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
									<span class="hero-name">{hero?.name ?? ""}</span>
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
		<section class="panel enemy-team" aria-label="Enemy team">
			<h2 class="panel-head">
				<span class="section-label">Enemy team</span>
				<span class={`side-name side-${side}`}>{SIDE_LABEL[side]}</span>
			</h2>
			{session.enemyPicks.map((id, index) => {
				const hero = byId.get(id);
				const probs = roles.get(id);

				return (
					<div class="slot" key={id}>
						<div class="slot-hero">
							<HeroTile hero={hero} size="md" />
							<div class="enemy-text">
								<span class="hero-name">{hero?.name ?? ""}</span>
								<span class="enemy-roles">
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
				<div class="slot" key={`free-${i}`}>
					<div class="slot-hero">
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
		<section class="panel suggestions" aria-label="Suggestions">
			<h2 class="panel-head">
				<span class="section-label">Suggestions</span>
				<span class="phase">phase: {formatPhase(model.phase)}</span>
			</h2>
			{model.suggestions.map((block) => (
				<div
					class={`suggestion-row${block.isMyRole ? " suggestion-mine" : ""}`}
					key={block.role}
				>
					<h3 class="suggestion-role">
						<span class="slot-star">{block.isMyRole ? "★" : ""}</span>
						{ROLE_UI[block.role].label}
					</h3>
					<div class="suggestion-strip">
						{block.entries.map((entry) => {
							const hero = byId.get(entry.hero);
							return (
								<button
									type="button"
									class="suggestion"
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
									<span class={`score score-${scoreTone(entry.score)}`}>
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
	<section class="panel result" aria-label="Result">
		<h2 class="panel-head">
			<span class="section-label">Result</span>
		</h2>
		<p class="result-line">
			<span class="result-label">Draft advantage:</span>
			{/* A draft that is behind must not be printed in the winning colour. */}
			<span class={`result-advantage score-${scoreTone(estimate.advantage)}`}>
				{formatAdvantage(estimate.advantage)}
			</span>
			<span class="result-arrow">→</span>
			<span class="result-win">
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
	const teams = `teams${session.side === "dire" ? " teams-mirrored" : ""}`;

	return (
		<main class="board">
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
				<p class="board-hint" role="status">
					Add enemy picks to see win probability
				</p>
			) : (
				<Suggestions model={model} byId={byId} apply={apply} />
			)}
		</main>
	);
}
