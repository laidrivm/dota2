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
} from "../../types.ts";
import { ROLES } from "../../types.ts";
import { type Action, isUsed } from "../session.ts";
import { ROLE_UI } from "../session-controls.tsx";
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

/**
 * What every pick-entry control offers: the heroes not already banned or
 * picked, by name. The picker of proposal 2c filters this same list.
 */
export function availableHeroes(
	bundle: SnapshotBundle,
	session: Session,
): HeroEntry[] {
	return bundle.heroes
		.filter((hero) => !isUsed(session, hero.id))
		.sort((a, b) => a.name.localeCompare(b.name, "en"));
}

const SIDE_NAME: Record<Side, string> = { radiant: "Radiant", dire: "Dire" };

const other = (side: Side): Side => (side === "radiant" ? "dire" : "radiant");

/**
 * The stand-in for the hero picker of proposal 2c: a native select, so the
 * board can be used and tested before the overlay exists. 2c deletes this and
 * points the same actions at the overlay.
 */
function PickEntry({
	label,
	placeholder,
	heroes,
	onPick,
	disabled,
	title,
}: {
	label: string;
	placeholder: string;
	heroes: HeroEntry[];
	onPick: (hero: HeroId) => void;
	disabled?: boolean;
	title?: string;
}) {
	return (
		<label class="pick-entry">
			<span class="visually-hidden">{label}</span>
			<select
				disabled={disabled}
				title={title}
				onChange={(event) => {
					const chosen = event.currentTarget.value;
					// The select is a trigger, not a value: it always shows its
					// placeholder again so the same hero can be chosen for another slot.
					event.currentTarget.value = "";
					if (chosen !== "") onPick(Number(chosen));
				}}
			>
				<option value="">{placeholder}</option>
				{heroes.map((hero) => (
					<option key={hero.id} value={hero.id}>
						{hero.name}
					</option>
				))}
			</select>
		</label>
	);
}

/**
 * Removal unmounts the button that did it, which would drop focus onto the
 * body. Focus goes to the control that took its place instead: the slot's own
 * pick-entry where the row survives, the region's first one where it does not.
 */
function RemoveButton({
	label,
	onClick,
}: {
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			class="remove"
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
						(row?.isConnected ? row.querySelector("select") : null) ??
						region?.querySelector("select");
					next?.focus();
				}, 0);
			}}
		>
			✕
		</button>
	);
}

const ThinBadge = ({ hero }: { hero: HeroEntry | undefined }) =>
	hero?.sufficient === false ? (
		<span class="thin-badge">insufficient data</span>
	) : null;

function BansRow({
	session,
	byId,
	available,
	banLimit,
	apply,
}: {
	session: Session;
	byId: Map<HeroId, HeroEntry>;
	available: HeroEntry[];
	banLimit: number;
	apply: Apply;
}) {
	const atLimit = session.bans.length >= banLimit;

	return (
		<section class="bans" aria-label="Bans">
			<h2 class="section-label">Bans</h2>
			<div class="bans-strip">
				{session.bans.map((id, index) => {
					const hero = byId.get(id);
					return (
						<div class="ban" key={`${id}-${index}`}>
							<HeroTile
								hero={hero}
								size="lg"
								label={hero?.name ?? "Unknown hero"}
							/>
							<RemoveButton
								label={`Remove ban ${hero?.name ?? "unknown hero"}`}
								onClick={() => apply({ kind: "banRemove", index })}
							/>
						</div>
					);
				})}
				<PickEntry
					label="Add ban"
					placeholder="+ Add ban"
					heroes={available}
					disabled={atLimit}
					title={
						atLimit
							? `Ban limit reached — ${banLimit} for this snapshot`
							: undefined
					}
					onPick={(hero) => apply({ kind: "banAdd", hero })}
				/>
			</div>
		</section>
	);
}

function TeamPanel({
	session,
	byId,
	available,
	apply,
}: {
	session: Session;
	byId: Map<HeroId, HeroEntry>;
	available: HeroEntry[];
	apply: Apply;
}) {
	const side = session.side as Side;

	return (
		<section class="panel my-team" aria-label="My team">
			<h2 class="panel-head">
				<span class="section-label">My team</span>
				<span class={`side-name side-${side}`}>{SIDE_NAME[side]}</span>
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
									heroes={available}
									onPick={(picked) =>
										apply({ kind: "teamSet", role, hero: picked })
									}
								/>
							) : (
								<>
									<HeroTile hero={hero} size="md" />
									<span class="hero-name">{hero?.name ?? ""}</span>
									<ThinBadge hero={hero} />
								</>
							)}
						</div>
						{id !== null && (
							<RemoveButton
								label={`Remove ${hero?.name ?? "unknown hero"} from ${ROLE_UI[role].label}`}
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
	available,
	apply,
}: {
	session: Session;
	model: ModelOutput;
	byId: Map<HeroId, HeroEntry>;
	available: HeroEntry[];
	apply: Apply;
}) {
	const side = other(session.side as Side);
	const roles = new Map(
		model.enemyRoles.map((entry) => [entry.hero, entry.probs]),
	);
	// Five slots always: the filled ones, then one entry control per free seat.
	const free = 5 - session.enemyPicks.length;

	return (
		<section class="panel enemy-team" aria-label="Enemy team">
			<h2 class="panel-head">
				<span class="section-label">Enemy team</span>
				<span class={`side-name side-${side}`}>{SIDE_NAME[side]}</span>
			</h2>
			{session.enemyPicks.map((id, index) => {
				const hero = byId.get(id);
				const probs = roles.get(id);

				return (
					<div class="slot" key={`${id}-${index}`}>
						<div class="slot-hero">
							<HeroTile hero={hero} size="md" />
							<div class="enemy-text">
								<span class="hero-name">{hero?.name ?? ""}</span>
								<span class="enemy-roles">
									{probs === undefined ? "" : topRoles(probs)}
								</span>
							</div>
						</div>
						<RemoveButton
							label={`Remove enemy pick ${hero?.name ?? "unknown hero"}`}
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
							heroes={available}
							onPick={(hero) => apply({ kind: "enemyAdd", hero })}
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

const Result = ({ model }: { model: ModelOutput }) => (
	<section class="panel result" aria-label="Result">
		<h2 class="panel-head">
			<span class="section-label">Result</span>
		</h2>
		<p class="result-line">
			<span class="result-label">Draft advantage:</span>
			{/* A draft that is behind must not be printed in the winning colour. */}
			<span
				class={`result-advantage score-${scoreTone(model.winEstimate?.advantage ?? 0)}`}
			>
				{formatAdvantage(model.winEstimate?.advantage ?? 0)}
			</span>
			<span class="result-arrow">→</span>
			<span class="result-win">
				{formatWinProbability(model.winEstimate?.winProbability ?? 0)}
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
}: {
	bundle: SnapshotBundle;
	session: Session;
	model: ModelOutput;
	banLimit: number;
	apply: Apply;
}) {
	const byId = new Map(bundle.heroes.map((hero) => [hero.id, hero]));
	const available = availableHeroes(bundle, session);

	// My team reads left on Radiant and right on Dire, as the game client puts it.
	const teams = `teams${session.side === "dire" ? " teams-mirrored" : ""}`;

	return (
		<main class="board">
			<BansRow
				session={session}
				byId={byId}
				available={available}
				banLimit={banLimit}
				apply={apply}
			/>
			<div class={teams}>
				<TeamPanel
					session={session}
					byId={byId}
					available={available}
					apply={apply}
				/>
				<EnemyPanel
					session={session}
					model={model}
					byId={byId}
					available={available}
					apply={apply}
				/>
			</div>
			{model.winEstimate !== null ? (
				<Result model={model} />
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
