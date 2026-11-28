import { HeroTile } from "../../app/board/hero-tile.tsx";
import { focusAfterPick } from "../../app/picker/picker.tsx";
import type { HeroEntry, SnapshotBundle } from "../../types.ts";
import { type Suggestion, suggest } from "../engine/suggest.ts";
import b from "./board.module.css";
import s from "./cm.module.css";
import { type CmAction, type CmSession, draftState } from "./session.ts";

const HEADING = {
	ours: { ban: "Suggested bans", pick: "Suggested picks" },
	theirs: { ban: "Enemy's expected bans", pick: "Enemy's expected picks" },
} as const;

const PART_LABEL: Record<keyof Suggestion["components"], string> = {
	meta: "meta",
	comfort: "signature",
	side: "side",
	phase: "phase",
	synergy: "synergy",
	matchups: "matchups",
	lookahead: "lookahead",
};

/** `+1.2`, `−0.4`: one decimal, signed, with a true minus. */
const pp = (value: number) =>
	`${value < 0 ? "−" : "+"}${Math.abs(value).toFixed(1)}`;

/** A value as shown: to one decimal. */
const tenth = (value: number) => Math.round(value * 10) / 10;

type Part = keyof Suggestion["components"];

/**
 * A suggestion's parts as shown: each rounded to one decimal and left out
 * when that is zero, with `lookahead` taking up whatever the rounding leaves,
 * so the parts shown add up to the score shown (cm-model, *Components add up
 * to the score*) — rounding each part alone can drift a tenth per part.
 */
export function shownParts(entry: Suggestion): [Part, number][] {
	const own = (Object.entries(entry.components) as [Part, number][])
		.filter(([part]) => part !== "lookahead")
		.map(([part, value]): [Part, number] => [part, tenth(value)])
		.filter(([, value]) => value !== 0);
	const counted = own.reduce((sum, [, value]) => sum + value, 0);
	const rest = tenth(tenth(entry.score) - counted);
	return rest === 0 ? own : [...own, ["lookahead", rest]];
}

/**
 * The ranked heroes for the step in progress, each with its score and the
 * parts it is made of. On the captain's steps a suggestion enters its hero;
 * on the enemy's it is what the search expects, and enters nothing.
 */
export function Suggestions({
	bundle,
	session,
	apply,
}: {
	bundle: SnapshotBundle;
	session: CmSession;
	apply: (action: CmAction) => void;
}) {
	const state = draftState(session);
	const result = state && suggest(bundle, state);
	if (result === null) return null;
	const byId = new Map(bundle.heroes.map((hero) => [hero.id, hero]));
	const heading = HEADING[result.team][result.action];

	return (
		<section class={b.suggestions} aria-label={heading}>
			<h2 class={s.label}>{heading}</h2>
			<ol class={b.suggestionList}>
				{result.entries.map((entry) => (
					<li key={entry.hero} class={b.suggestion}>
						{result.team === "ours" ? (
							<button
								type="button"
								class={b.suggestionHero}
								onClick={() => {
									apply({ type: "enter", hero: entry.hero });
									focusAfterPick("cm-step");
								}}
							>
								<Entry hero={byId.get(entry.hero)} entry={entry} />
							</button>
						) : (
							<div class={b.suggestionHero}>
								<Entry hero={byId.get(entry.hero)} entry={entry} />
							</div>
						)}
						<ul class={b.parts} aria-label="Score parts">
							{shownParts(entry).map(([part, value]) => (
								<li key={part} class={b.part}>
									{PART_LABEL[part]} {pp(value)}
								</li>
							))}
						</ul>
					</li>
				))}
			</ol>
		</section>
	);
}

function Entry({
	hero,
	entry,
}: {
	hero: HeroEntry | undefined;
	entry: Suggestion;
}) {
	const name = hero?.name ?? "a hero this snapshot does not carry";
	return (
		<>
			<HeroTile hero={hero} size="sm" label={name} />
			<span>{name}</span>
			<span class={entry.score < 0 ? b.scoreAgainst : b.score}>
				{pp(tenth(entry.score))}
			</span>
		</>
	);
}
