import { useState } from "preact/hooks";
import { HeroTile } from "../../app/board/hero-tile.tsx";
import { focusAfterPick, Picker } from "../../app/picker/picker.tsx";
import { ROLE_UI } from "../../app/session-controls.tsx";
import type { HeroEntry, Role, SnapshotBundle } from "../../types.ts";
import s from "./cm.module.css";
import { accountId, type Imported, importProfile } from "./profile-import.ts";
import {
	type CmAction,
	type CmSession,
	NICKNAME_MAX,
	positionsComplete,
	RANK_NAMES,
	type RankTier,
	SIGNATURE_LIMIT,
	type Team,
} from "./session.ts";

const TEAM_NAME: Record<Team, string> = {
	ours: "Your team",
	theirs: "Enemy team",
};

/** Both rosters, and the picker for whichever player is choosing a signature. */
export function Rosters({
	bundle,
	session,
	apply,
}: {
	bundle: SnapshotBundle;
	session: CmSession;
	apply: (action: CmAction) => void;
}) {
	const [choosing, setChoosing] = useState<{
		team: Team;
		index: number;
	} | null>(null);
	const byId = new Map(bundle.heroes.map((hero) => [hero.id, hero]));
	const chooser =
		choosing === null ? undefined : session[choosing.team][choosing.index];

	return (
		<div class={s.rosters}>
			{(["ours", "theirs"] as const).map((team) => (
				<Roster
					key={team}
					team={team}
					session={session}
					byId={byId}
					apply={apply}
					onAddSignature={(index) => setChoosing({ team, index })}
				/>
			))}
			{choosing !== null && chooser !== undefined && (
				<Picker
					bundle={bundle}
					label={`signature of ${chooser.nickname}`}
					usedOf={(hero) =>
						chooser.signatures.includes(hero) ? "added" : null
					}
					onPick={(hero) => {
						apply({ type: "addSignature", ...choosing, hero });
						setChoosing(null);
						focusAfterPick(`cm-${choosing.team}-${choosing.index}`);
					}}
					onClose={() => setChoosing(null)}
				/>
			)}
		</div>
	);
}

/** An account id or profile link, read from OpenDota into the player (v2). */
function ProfileImport({
	known,
	onImported,
}: {
	known: Map<number, HeroEntry>;
	onImported: (found: Imported) => void;
}) {
	const [text, setText] = useState("");
	const [said, setSaid] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const run = async () => {
		const id = accountId(text);
		if (id === null) {
			setSaid("Give an account id or a Dotabuff, STRATZ or OpenDota link.");
			return;
		}
		setBusy(true);
		const found = await importProfile(id, new Set(known.keys()));
		setBusy(false);
		if (found === null) {
			setSaid("OpenDota did not answer for that account.");
			return;
		}
		onImported(found);
		setSaid(
			`Imported ${found.nickname ?? "the profile"}: ${found.signatures.length} heroes${found.rank === null ? ", medal hidden" : ""}.`,
		);
	};

	return (
		<div class={s.field}>
			<label class={s.field}>
				<span class={s.label}>Account id or profile link</span>
				<input
					class={s.input}
					value={text}
					onInput={(event) => setText(event.currentTarget.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							run();
						}
					}}
				/>
			</label>
			<button type="button" class={s.button} disabled={busy} onClick={run}>
				{busy ? "Importing…" : "Import from OpenDota"}
			</button>
			{said !== null && (
				<p class={s.note} role="status">
					{said}
				</p>
			)}
		</div>
	);
}

function Roster({
	team,
	session,
	byId,
	apply,
	onAddSignature,
}: {
	team: Team;
	session: CmSession;
	byId: Map<number, HeroEntry>;
	apply: (action: CmAction) => void;
	onAddSignature: (index: number) => void;
}) {
	const roster = session[team];
	const heading = `cm-roster-${team}`;
	return (
		<section class={s.roster} aria-labelledby={heading}>
			<h2 class={s.label} id={heading}>
				{TEAM_NAME[team]}
			</h2>
			{team === "ours" && !positionsComplete(roster) && (
				<p class={s.note} role="status">
					Give each of positions 1–5 to one player.
				</p>
			)}
			{roster.map((player, index) => {
				const id = `cm-${team}-${index}`;
				const full = player.signatures.length >= SIGNATURE_LIMIT;
				return (
					<fieldset key={id} class={s.player}>
						<legend class={s.visuallyHidden}>{player.nickname}</legend>
						<ProfileImport
							known={byId}
							onImported={(found) =>
								apply({ type: "import", team, index, ...found })
							}
						/>
						<label class={s.field}>
							<span class={s.label}>Nickname</span>
							<input
								class={s.input}
								value={player.nickname}
								maxLength={NICKNAME_MAX}
								onChange={(event) => {
									const name = event.currentTarget.value;
									// Back to the stored name: an accepted one re-renders over it,
									// and a refused one (blank) renders nothing to restore it.
									event.currentTarget.value = player.nickname;
									apply({ type: "nickname", team, index, name });
								}}
							/>
						</label>
						<label class={s.field}>
							<span class={s.label}>Position</span>
							<select
								class={s.input}
								value={player.position ?? ""}
								onChange={(event) => {
									const value = event.currentTarget.value;
									apply({
										type: "position",
										team,
										index,
										position: value === "" ? null : (Number(value) as Role),
									});
								}}
							>
								<option value="">unknown</option>
								{([1, 2, 3, 4, 5] as const).map((role) => (
									<option key={role} value={role}>
										{role} · {ROLE_UI[role].label}
									</option>
								))}
							</select>
						</label>
						<label class={s.field}>
							<span class={s.label}>Rank</span>
							<select
								class={s.input}
								value={player.rank ?? ""}
								onChange={(event) => {
									const value = event.currentTarget.value;
									apply({
										type: "rank",
										team,
										index,
										rank: value === "" ? null : (Number(value) as RankTier),
									});
								}}
							>
								<option value="">unknown</option>
								{([1, 2, 3, 4, 5, 6, 7, 8] as const).map((rank) => (
									<option key={rank} value={rank}>
										{RANK_NAMES[rank - 1]}
									</option>
								))}
							</select>
						</label>
						<ul
							class={s.signatures}
							aria-label={`${player.nickname} signatures`}
						>
							{player.signatures.map((hero) => (
								<li key={hero}>
									<button
										type="button"
										class={s.signature}
										data-remove={id}
										aria-label={`Remove ${byId.get(hero)?.name ?? "hero"}`}
										onClick={() => {
											// The tile unmounts with the focus it holds; the add
											// control, enabled again below ten, takes it.
											apply({ type: "removeSignature", team, index, hero });
											focusAfterPick(id);
										}}
									>
										<HeroTile hero={byId.get(hero)} size="sm" />
									</button>
								</li>
							))}
						</ul>
						<button
							type="button"
							class={s.button}
							disabled={full}
							data-pick={id}
							onClick={() => onAddSignature(index)}
						>
							{full
								? `${SIGNATURE_LIMIT} signatures, the limit`
								: "Add signature"}
						</button>
					</fieldset>
				);
			})}
		</section>
	);
}
