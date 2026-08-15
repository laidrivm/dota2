/**
 * The bans row (screens-spec §2): every ban in the draft, and the control that
 * adds the next one until the snapshot's limit is reached.
 */

import type { HeroEntry, HeroId, Session } from "../../types.ts";
import s from "./board.module.css";
import { HeroTile } from "./hero-tile.tsx";
import {
	type Apply,
	type OpenPicker,
	PickEntry,
	RemoveButton,
	RepickBadge,
} from "./pieces.tsx";

export function BansRow({
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
		<section class={s.bans} data-region="bans" aria-label="Bans">
			<h2 class={s.sectionLabel}>Bans</h2>
			<div class={s.bansStrip}>
				{session.bans.map((id, index) => {
					const hero = byId.get(id);
					return (
						<div class={s.ban} data-row="ban" key={id}>
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
