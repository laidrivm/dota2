import { useEffect, useRef, useState } from "preact/hooks";
import { HeroTile } from "../../app/board/hero-tile.tsx";
import { focusAfterPick } from "../../app/picker/picker.tsx";
import type { HeroEntry, SnapshotBundle } from "../../types.ts";
import type { DraftState } from "../engine/draft.ts";
import type {
	Suggestion,
	Suggestions as SuggestionsResult,
} from "../engine/suggest.ts";
import b from "./board.module.css";
import s from "./cm.module.css";
import { SearchClient } from "./search-client.ts";
import {
	type CmAction,
	type CmSession,
	draftState,
	stepInProgress,
} from "./session.ts";

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
	const step = stepInProgress(session);
	const result = useSearch(bundle, draftState(session));
	if (step === null) return null;
	const byId = new Map(bundle.heroes.map((hero) => [hero.id, hero]));
	const heading = HEADING[step.team][step.action];

	return (
		<section class={b.suggestions} aria-label={`${heading}, step ${step.step}`}>
			<h2 class={s.label}>{heading}</h2>
			{result === null || result.step !== step.step ? (
				<p class={s.note} role="status">
					Searching…
				</p>
			) : (
				<Ranked result={result} byId={byId} apply={apply} />
			)}
		</section>
	);
}

/**
 * The search's latest result for `state`, run in a worker the snapshot is
 * handed to once; `null` until the first result for the current state, so a
 * ranking computed for an earlier draft is never on screen.
 */
function useSearch(
	bundle: SnapshotBundle,
	state: DraftState | null,
): SuggestionsResult | null {
	// Each result with the draft it was asked for, so one computed for an
	// earlier draft is never returned — not even in the render before the
	// effect below runs, which is after paint.
	const [shown, setShown] = useState<{
		key: string;
		result: SuggestionsResult | null;
	} | null>(null);
	const client = useRef<SearchClient | null>(null);
	const asked = useRef<string | null>(null);

	useEffect(() => {
		const search = new SearchClient(spawnSearch, bundle, (result) => {
			// The client hands on the latest request's result alone.
			if (asked.current !== null) setShown({ key: asked.current, result });
		});
		client.current = search;
		return () => search.dispose();
	}, [bundle]);

	// The draft as a value: a new session object with the same draft in it
	// (a renamed player, say) is still a new search, a re-render is not.
	// The effect reads the draft back out of its key, so the key is all it
	// depends on.
	const key = JSON.stringify(state);
	useEffect(() => {
		asked.current = key;
		const draft = JSON.parse(key) as DraftState | null;
		if (draft !== null) client.current?.request(draft);
	}, [key]);

	return shown !== null && shown.key === key ? shown.result : null;
}

/** The page's own bundle, started again as its search worker. */
const spawnSearch = () => new Worker(import.meta.url, { type: "module" });

function Ranked({
	result,
	byId,
	apply,
}: {
	result: SuggestionsResult;
	byId: Map<number, HeroEntry>;
	apply: (action: CmAction) => void;
}) {
	return (
		<ol
			class={b.suggestionList}
			// The step the ranking was computed for, which is not always the step
			// on screen: what stops one from showing under the other is checked.
			aria-label={`Ranked for step ${result.step}`}
		>
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
