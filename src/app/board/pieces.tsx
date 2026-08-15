/**
 * The controls and badges more than one board panel is built from.
 *
 * Their own module rather than `board.tsx`'s, which is where the decomposition
 * would otherwise have left them: `board.tsx` imports every panel, so a panel
 * importing a piece back out of it is the cycle `noImportCycles` refuses.
 */

import type { HeroEntry } from "../../types.ts";
import type { Action, PickTarget, Position } from "../session.ts";
import s from "./board.module.css";
// The re-pick marker is the tile's other half: it stands in for a hero the
// snapshot dropped, so its rule lives beside the tile it replaces.
import tile from "./hero-tile.module.css";

export type Apply = (action: Action) => void;
export type OpenPicker = (target: PickTarget) => void;

/**
 * The one way a hero enters the draft: a button that opens the picker for this
 * position. `position` is what the focus redirect after a pick looks for.
 */
export function PickEntry({
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
			class={s.pickEntry}
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
export function RemoveButton({
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
			class={s.remove}
			data-remove={position}
			aria-label={label}
			onClick={(event) => {
				// The bundler owns the class names now, so the walk up to the row and
				// the region reads the markers instead — the same `data-` attributes
				// the post-pick focus redirect in `app.tsx` already navigates by.
				const row = event.currentTarget.closest("[data-row]");
				const region = event.currentTarget.closest("[data-region]");
				onClick();
				// After Preact commits: it renders on a microtask, so a macrotask is
				// the first point the replacement control exists. `rAF` is not — it
				// runs before the commit, and never at all in a hidden tab.
				setTimeout(() => {
					const next =
						(row?.isConnected ? row.querySelector("[data-pick]") : null) ??
						region?.querySelector("[data-pick]");
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
export const RepickBadge = ({ hero }: { hero: HeroEntry | undefined }) =>
	hero === undefined ? <span class={tile.repickBadge}>re-pick</span> : null;

export const ThinBadge = ({ hero }: { hero: HeroEntry | undefined }) =>
	hero?.sufficient === false ? (
		<span class={s.thinBadge}>insufficient data</span>
	) : null;
