import { useState } from "preact/hooks";
import s from "./cm.module.css";
import { type MetaPositions, uploadMeta } from "./meta-api.ts";

const POSITIONS = ["1", "2", "3", "4", "5"] as const;

/** d2pt's Pubs 7000+ meta data file for a position, opened in the captain's browser. */
export const d2ptUrl = (position: string) =>
	`https://dota2protracker.com/meta/__data.json?mmr=7000&position=pos+${position}&period=patch&meta_period=patch`;

const DAY = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
});

/**
 * Where each position's hero strength comes from — the upload's patch and
 * date, or the snapshot — with the link each data file is saved from and the
 * control that uploads the saved files (cm-meta-import, *The page names where
 * its meta comes from*; design D5).
 */
export function MetaPanel({
	positions,
	onUploaded,
}: {
	positions: MetaPositions;
	onUploaded: () => void;
}) {
	const [messages, setMessages] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);

	const upload = async (input: HTMLInputElement) => {
		const files = [...(input.files ?? [])];
		// Cleared at once, so choosing the same file again is a change again.
		input.value = "";
		if (files.length === 0) return;
		setBusy(true);
		const said: string[] = [];
		try {
			for (const file of files) {
				const text = await file.text().catch(() => null);
				said.push(
					`${file.name}: ${text === null ? "That file could not be read." : await uploadMeta(text)}`,
				);
			}
		} finally {
			setMessages(said);
			setBusy(false);
			onUploaded();
		}
	};

	return (
		<section class={s.meta} aria-label="Hero meta">
			<h2 class={s.label}>Hero meta</h2>
			<ul class={s.metaList}>
				{POSITIONS.map((position) => {
					const stored = positions[position];
					return (
						<li key={position}>
							pos {position}:{" "}
							{stored === null
								? "the snapshot"
								: `d2pt ${stored.patch}, uploaded ${DAY.format(new Date(stored.uploadedAt))}`}{" "}
							·{" "}
							<a href={d2ptUrl(position)} target="_blank" rel="noreferrer">
								d2pt data file
							</a>
						</li>
					);
				})}
			</ul>
			<label class={s.field}>
				<span class={s.label}>Upload saved d2pt files</span>
				<input
					type="file"
					accept="application/json,.json"
					multiple
					aria-busy={busy}
					onChange={(event) => upload(event.currentTarget)}
				/>
			</label>
			{messages.length > 0 && (
				<ul class={s.metaList} role="status">
					{messages.map((message) => (
						<li key={message}>{message}</li>
					))}
				</ul>
			)}
		</section>
	);
}
