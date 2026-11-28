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
							{Object.entries(entry.components)
								// What rounds to nothing at one decimal is left out.
								.filter(([, value]) => Math.abs(value) >= 0.05)
								.map(([part, value]) => (
									<li key={part} class={b.part}>
										{PART_LABEL[part as keyof Suggestion["components"]]}{" "}
										{pp(value)}
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
	return (
		<>
			<HeroTile hero={hero} size="sm" />
			<span>{hero?.name ?? "a hero this snapshot does not carry"}</span>
			<span class={entry.score < 0 ? b.scoreAgainst : b.score}>
				{pp(entry.score)}
			</span>
		</>
	);
}
