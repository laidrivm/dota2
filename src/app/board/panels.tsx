/**
 * The two team panels (screens-spec §2): my team by role, and the enemy team
 * by pick order with the roles the model infers for each.
 */

import type {
	HeroEntry,
	HeroId,
	ModelOutput,
	Session,
	Side,
} from "../../types.ts";
import { ROLES } from "../../types.ts";
import { cx } from "../cx.ts";
import { ROLE_UI, SIDE_LABEL } from "../session-controls.tsx";
import s from "./board.module.css";
import { topRoles } from "./format.ts";
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

/** A side's tint is the same token wherever it is named. */
const sideClass = (side: Side) =>
	cx(
		panels.sideName,
		side === "radiant" ? panels.sideRadiant : panels.sideDire,
	);

export function TeamPanel({
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

export function EnemyPanel({
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
