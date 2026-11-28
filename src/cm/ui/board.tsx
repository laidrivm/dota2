import { useState } from "preact/hooks";
import { HeroTile } from "../../app/board/hero-tile.tsx";
import { cx } from "../../app/cx.ts";
import { focusAfterPick, Picker } from "../../app/picker/picker.tsx";
import type { HeroEntry, HeroId, SnapshotBundle } from "../../types.ts";
import { teamsOf } from "../engine/draft.ts";
import { ORDER, type StepAction, stepAt, type Team } from "../engine/order.ts";
import b from "./board.module.css";
import s from "./cm.module.css";
import {
	type CmAction,
	type CmSession,
	draftState,
	reduce,
	stepInProgress,
	takenAt,
} from "./session.ts";

const WHOSE: Record<Team, string> = { ours: "your", theirs: "enemy" };
const ROW_NAME: Record<Team, string> = { ours: "Your", theirs: "Enemy" };

/** A tile's accessible name: the hero, or what stands in for one the snapshot lost. */
const nameOf = (byId: Map<number, HeroEntry>, hero: HeroId): string =>
	byId.get(hero)?.name ?? "a hero this snapshot does not carry";

/**
 * The draft: the step in progress, the order as a strip of 24 cells, each
 * team's bans and picks, and the controls entering a hero and undoing one.
 * `cm-step` marks both controls, so focus survives the picker closing.
 */
export function DraftBoard({
	bundle,
	session,
	apply,
}: {
	bundle: SnapshotBundle;
	session: CmSession;
	apply: (action: CmAction) => void;
}) {
	const [entering, setEntering] = useState(false);
	const byId = new Map(bundle.heroes.map((hero) => [hero.id, hero]));
	const current = stepInProgress(session);
	const pickOrder = session.pickOrder ?? "first";
	const what = current && `${WHOSE[current.team]} ${current.action}`;

	const undo = () => {
		// Undoing step 1 disables the button holding focus; focus moves to entry.
		if (reduce(session, { type: "undo" }).steps.length === 0)
			focusAfterPick("cm-step");
		apply({ type: "undo" });
	};

	// A reset loses every step at once and undo cannot bring them back, so it
	// asks first — the browser's own dialog, which keyboard and screen readers
	// already handle. Its button disables itself; focus moves to entry.
	const reset = () => {
		if (!confirm("Reset the draft? The setup and rosters stay.")) return;
		if (reduce(session, { type: "reset" }) !== session)
			focusAfterPick("cm-step");
		apply({ type: "reset" });
	};

	// Each pick's position as the assignment places it, and who holds it.
	const state = draftState(session);
	const teams = state && teamsOf(bundle, state);
	const captionsOf = (team: Team) =>
		new Map(
			(teams?.[team].slots ?? []).map((slot) => {
				const holder = session[team].find((p) => p === slot.player);
				const who = holder?.nickname ?? "no player";
				return [slot.hero, `pos ${slot.position} · ${who}`];
			}),
		);

	const heroesOf = (team: Team, action: StepAction): HeroId[] =>
		session.steps.filter((_, index) => {
			const at = stepAt(index, pickOrder);
			return at?.team === team && at.action === action;
		});

	return (
		<section class={b.draft} aria-label="Draft">
			<p class={s.step} aria-live="polite">
				{current ? `Step ${current.step} · ${what}` : "Draft complete"}
			</p>
			<div class={b.actions}>
				<button
					type="button"
					class={s.button}
					data-pick="cm-step"
					disabled={current === null}
					onClick={() => setEntering(true)}
				>
					{current ? `Enter ${what}` : "Draft complete"}
				</button>
				<button
					type="button"
					class={s.button}
					data-remove="cm-step"
					disabled={session.steps.length === 0}
					onClick={undo}
				>
					Undo
				</button>
				<button
					type="button"
					class={s.button}
					disabled={session.steps.length === 0}
					onClick={reset}
				>
					Reset draft
				</button>
			</div>
			<ol class={b.strip} aria-label="Draft order">
				{ORDER.map(({ step, action }) => {
					const ours = stepAt(step - 1, pickOrder)?.team === "ours";
					const hero = session.steps[step - 1];
					return (
						<li
							key={step}
							class={cx(b.cell, ours ? b.ours : undefined)}
							aria-current={
								step === session.steps.length + 1 ? "step" : undefined
							}
						>
							<span class={s.label}>
								{step} {action}
							</span>
							{hero !== undefined && (
								<HeroTile
									hero={byId.get(hero)}
									size="sm"
									label={nameOf(byId, hero)}
								/>
							)}
						</li>
					);
				})}
			</ol>
			<div class={s.rosters}>
				{(["ours", "theirs"] as const).map((team) => (
					<div key={team} class={s.roster}>
						{(["ban", "pick"] as const).map((action) => (
							<HeroRow
								key={action}
								name={`${ROW_NAME[team]} ${action}s`}
								heroes={heroesOf(team, action)}
								byId={byId}
								captions={action === "pick" ? captionsOf(team) : undefined}
							/>
						))}
					</div>
				))}
			</div>
			{entering && current && (
				<Picker
					bundle={bundle}
					label={`step ${current.step}, ${what}`}
					usedOf={(hero) => (takenAt(session, hero) === null ? null : "taken")}
					onPick={(hero) => {
						apply({ type: "enter", hero });
						setEntering(false);
						focusAfterPick("cm-step");
					}}
					onClose={() => setEntering(false)}
				/>
			)}
		</section>
	);
}

function HeroRow({
	name,
	heroes,
	byId,
	captions,
}: {
	name: string;
	heroes: HeroId[];
	byId: Map<number, HeroEntry>;
	/** A pick's position and player, read under its tile. */
	captions?: Map<HeroId, string>;
}) {
	return (
		<ul class={s.signatures} aria-label={name}>
			{heroes.map((hero) => (
				<li key={hero} class={b.pick}>
					<HeroTile
						hero={byId.get(hero)}
						size="sm"
						label={nameOf(byId, hero)}
					/>
					{captions?.has(hero) && (
						<span class={b.caption}>{captions.get(hero)}</span>
					)}
				</li>
			))}
		</ul>
	);
}
