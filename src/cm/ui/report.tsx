/**
 * The draft report and the chat after it (v3). Asked for once the draft is
 * complete; the conversation is kept in the browser beside the draft it is
 * about, so a reset — a new draft — starts it empty.
 */
import { useEffect, useState } from "preact/hooks";
import type { HeroEntry, SnapshotBundle } from "../../types.ts";
import { stepAt } from "../engine/order.ts";
import s from "./cm.module.css";
import { type CmSession, type Player, RANK_NAMES } from "./session.ts";

const REPORT = "/api/cm/report";
const HISTORY_KEY = "d2ass-cm-report";
/** Opus can take a while on a whole draft. */
const REPORT_TIMEOUT_MS = 180_000;

interface Turn {
	role: "user" | "assistant";
	content: string;
}

const heroName = (byId: Map<number, HeroEntry>, id: number) =>
	byId.get(id)?.name ?? `hero ${id}`;

/** The finished draft as text the model reads. */
export function draftText(session: CmSession, bundle: SnapshotBundle): string {
	const byId = new Map(bundle.heroes.map((hero) => [hero.id, hero]));
	const pickOrder = session.pickOrder ?? "first";
	const roster = (players: Player[]) =>
		players
			.map(
				(p) =>
					`- ${p.nickname}: позиция ${p.position ?? "?"}, ранг ${p.rank ? RANK_NAMES[p.rank - 1] : "?"}, сигнатурки: ${p.signatures.map((h) => heroName(byId, h)).join(", ") || "нет"}`,
			)
			.join("\n");
	const steps = session.steps
		.map((hero, index) => {
			const at = stepAt(index, pickOrder);
			const who = at?.team === "ours" ? "мы" : "они";
			const what = at?.action === "ban" ? "бан" : "пик";
			return `${index + 1}. ${who} — ${what}: ${heroName(byId, hero)}`;
		})
		.join("\n");
	return [
		`Мы играем за ${session.side === "dire" ? "Dire" : "Radiant"}, ${pickOrder === "first" ? "первый" : "второй"} пик.`,
		`Наша команда:\n${roster(session.ours)}`,
		`Противник:\n${roster(session.theirs)}`,
		`Драфт по шагам:\n${steps}`,
	].join("\n\n");
}

function readHistory(draft: string): Turn[] {
	try {
		const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "null");
		return stored?.draft === draft && Array.isArray(stored.turns)
			? stored.turns
			: [];
	} catch {
		return [];
	}
}

async function ask(draft: string, messages: Turn[]): Promise<string> {
	try {
		const response = await fetch(REPORT, {
			method: "POST",
			credentials: "same-origin",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ draft, messages }),
			signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
		});
		const body = await response.json().catch(() => null);
		if (response.ok && typeof body?.text === "string") return body.text;
		throw new Error(body?.detail ?? "Отчёт не получился.");
	} catch (error) {
		throw error instanceof Error && error.name !== "TimeoutError"
			? error
			: new Error("Модель не ответила вовремя. Попробуйте ещё раз.");
	}
}

export function Report({
	session,
	bundle,
}: {
	session: CmSession;
	bundle: SnapshotBundle;
}) {
	const draft = draftText(session, bundle);
	const [turns, setTurns] = useState<Turn[]>(() => readHistory(draft));
	const [question, setQuestion] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// A different draft is a different conversation.
	useEffect(() => setTurns(readHistory(draft)), [draft]);
	useEffect(() => {
		localStorage.setItem(HISTORY_KEY, JSON.stringify({ draft, turns }));
	}, [draft, turns]);

	// The report is the reply to the draft itself; the chat follows it.
	const send = async (text: string | null) => {
		const asked: Turn[] =
			text === null ? [] : [...turns, { role: "user", content: text }];
		setBusy(true);
		setError(null);
		try {
			const reply = await ask(draft, asked);
			setTurns([...asked, { role: "assistant", content: reply }]);
			setQuestion("");
		} catch (failure) {
			setError((failure as Error).message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<section class={s.meta} aria-label="Draft report">
			<h2 class={s.label}>Отчёт по драфту</h2>
			{turns.length === 0 ? (
				<button
					type="button"
					class={s.button}
					disabled={busy}
					onClick={() => send(null)}
				>
					{busy ? "Пишу отчёт…" : "Получить отчёт"}
				</button>
			) : (
				<>
					<ol class={s.metaList} aria-label="Conversation">
						{turns.map((turn, index) => (
							<li key={index} style={{ whiteSpace: "pre-wrap" }}>
								<strong>{turn.role === "user" ? "Вы" : "Claude"}:</strong>{" "}
								{turn.content}
							</li>
						))}
					</ol>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							if (question.trim() !== "") send(question.trim());
						}}
					>
						<label class={s.field}>
							<span class={s.label}>Вопрос по драфту</span>
							<textarea
								class={s.input}
								rows={3}
								value={question}
								onInput={(event) => setQuestion(event.currentTarget.value)}
							/>
						</label>
						<button type="submit" class={s.button} disabled={busy}>
							{busy ? "Думаю…" : "Спросить"}
						</button>
					</form>
				</>
			)}
			{error !== null && (
				<p class={s.note} role="alert">
					{error}
				</p>
			)}
		</section>
	);
}
