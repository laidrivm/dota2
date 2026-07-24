/**
 * The hero picker (screens-spec §3).
 *
 * A native `<dialog>`: the focus trap, the inert board behind it, `Esc` and
 * focus restoration are the platform's, so what is written here is the search,
 * the grid, and the arrow keys the platform has no opinion about.
 */

import { useEffect, useRef, useState } from "preact/hooks";
import type { HeroEntry, HeroId, SnapshotBundle } from "../../types.ts";
import { HeroTile } from "../board/hero-tile.tsx";
import type { PickTarget } from "../session.ts";
import { ROLE_UI } from "../session-controls.tsx";
import { firstSelectable, matchHeroes } from "./search.ts";

/** What the header says we are picking for. */
export function targetLabel(target: PickTarget): string {
	if (target.kind === "ban") return "ban";
	if (target.kind === "enemy") return "enemy";
	return `${ROLE_UI[target.role].label} (my team)`;
}

const USED_LABEL = { ban: "ban", team: "team", enemy: "enemy" } as const;

type Used = keyof typeof USED_LABEL | null;

/** How many tiles a row holds, straight from the grid that lays them out —
 * eight on the desktop, fewer on a phone, and no breakpoint restated here. */
function columns(grid: HTMLElement): number {
	return getComputedStyle(grid).gridTemplateColumns.split(/\s+/).length;
}

export function Picker({
	bundle,
	target,
	usedOf,
	onPick,
	onClose,
}: {
	bundle: SnapshotBundle;
	target: PickTarget;
	usedOf: (hero: HeroId) => Used;
	onPick: (hero: HeroId) => void;
	onClose: () => void;
}) {
	const [query, setQuery] = useState("");
	const dialog = useRef<HTMLDialogElement>(null);
	const search = useRef<HTMLInputElement>(null);
	const grid = useRef<HTMLDivElement>(null);

	// Mounting is opening: the component only exists while a target does. The
	// backdrop click and the grid's arrow keys are listened for on the dialog
	// itself — they belong to the element, not to any one child of it, and the
	// grid is remounted whenever the query empties it.
	useEffect(() => {
		const element = dialog.current;
		if (element === null) return;

		element.showModal();
		search.current?.focus();

		// The backdrop is the dialog's own box, so a click that reaches no child
		// is a click outside the panel.
		const onClick = (event: MouseEvent) => {
			if (event.target === element) element.close();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			const tile = event.target;
			if (tile instanceof HTMLElement && grid.current?.contains(tile)) {
				fromGrid(event, tile);
			}
		};

		element.addEventListener("click", onClick);
		element.addEventListener("keydown", onKeyDown);
		return () => {
			element.removeEventListener("click", onClick);
			element.removeEventListener("keydown", onKeyDown);
		};
	}, []);

	// ponytail: the whole grid re-renders per keystroke — 126 static buttons,
	// well inside a frame. A `useMemo` goes here if a profile ever says otherwise.
	const matches = matchHeroes(bundle.heroes, query);
	const first = firstSelectable(matches, (hero) => usedOf(hero) !== null);

	const choose = (hero: HeroEntry) => {
		if (usedOf(hero.id) !== null) return;
		onPick(hero.id);
	};

	/** Arrows walk the grid; anything printable goes back to the search field,
	 * which is where screens-spec §5 sends every keystroke the picker gets. */
	function fromGrid(event: KeyboardEvent, tile: HTMLElement) {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		const container = grid.current;
		if (container === null) return;

		const step = {
			ArrowLeft: -1,
			ArrowRight: 1,
			ArrowUp: -columns(container),
			ArrowDown: columns(container),
		}[event.key];

		if (step !== undefined) {
			const tiles = [...container.querySelectorAll("button")];
			tiles[tiles.indexOf(tile as HTMLButtonElement) + step]?.focus();
			event.preventDefault();
			return;
		}

		// Space is a character everywhere except on a button, where it is how the
		// button is pressed — typing it here would swallow the tile's activation.
		if (event.key.length === 1 && event.key !== " ") {
			// The keystroke that moved focus here cannot land in the field by
			// itself, so it is carried over by hand.
			setQuery((current) => current + event.key);
			search.current?.focus();
			event.preventDefault();
		}
	}

	return (
		<dialog
			class="picker"
			ref={dialog}
			// `close` covers every way out — `Esc`, the ✕, the backdrop, a pick.
			onClose={onClose}
		>
			<div class="picker-head">
				<h2 class="picker-title">Pick for: {targetLabel(target)}</h2>
				<button
					type="button"
					class="picker-close"
					aria-label="Close the picker"
					onClick={() => dialog.current?.close()}
				>
					✕
				</button>
			</div>

			<label class="picker-search">
				<span class="visually-hidden">Search heroes</span>
				<input
					ref={search}
					type="search"
					value={query}
					placeholder="Search heroes — try 'bone' or 'wk'"
					onInput={(event) => setQuery(event.currentTarget.value)}
					onKeyDown={(event) => {
						if (event.key !== "Enter" || first === undefined) return;
						event.preventDefault();
						choose(first);
					}}
				/>
			</label>

			{matches.length === 0 ? (
				<p class="picker-empty" role="status">
					No hero matches “{query.trim()}”
				</p>
			) : (
				<div class="picker-grid" ref={grid}>
					{matches.map((hero) => {
						const used = usedOf(hero.id);
						return (
							<button
								type="button"
								key={hero.id}
								class={`picker-tile${hero.id === first?.id ? " picker-first" : ""}`}
								// Taken heroes stay focusable so the arrow keys keep the grid's
								// geometry; `aria-disabled` is what tells everyone they are out.
								aria-disabled={used !== null}
								onClick={() => choose(hero)}
							>
								<HeroTile hero={hero} size="lg" />
								<span class="picker-name">{hero.name}</span>
								{used !== null && (
									<span class="picker-used">{USED_LABEL[used]}</span>
								)}
							</button>
						);
					})}
				</div>
			)}

			<p class="picker-hints">
				<span>type to filter</span>
				<span>Enter — pick first</span>
				<span>← ↑ ↓ → — move</span>
				<span>Esc — close</span>
			</p>
		</dialog>
	);
}
