/**
 * The draft report and the chat after it (v3): the page sends the finished
 * draft as text and the conversation so far, and Claude answers in Russian.
 * Nothing is kept here — the page holds the history until the draft is reset.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const ReportRequest = z.object({
	draft: z.string().min(1).max(20_000),
	messages: z
		.array(
			z.object({
				role: z.enum(["user", "assistant"]),
				content: z.string().min(1).max(8_000),
			}),
		)
		.max(60),
});

export type ReportRequest = z.infer<typeof ReportRequest>;

/** Answers one turn: the report itself when `messages` is empty. */
export type Ask = (request: ReportRequest) => Promise<string>;

const SYSTEM = `Ты — аналитик драфтов Dota 2 в режиме Captains Mode. Тебе дают завершённый драфт: стороны, порядок пиков, баны, пики, составы игроков с позициями, рангами и сигнатурными героями.
Пиши по-русски, коротко и по делу, для капитана перед игрой. Структура отчёта:
1. Сильные и слабые стороны нашего драфта.
2. Чего ждать от противника: их план на игру, опасные связки, ключевые герои.
3. План на линии: кто против кого стоит и как играть каждую линию.
4. Тайминги и цели: когда наш драфт сильнее, когда давать бой, что делать, если отстаём.
5. Ключевые предметы и контр-предметы против их героев.
На вопросы после отчёта отвечай в том же контексте драфта.`;

/** The real `Ask`, or `null` when the deployment sets no API key. */
export function claudeAsk(apiKey: string | undefined): Ask | null {
	if (!apiKey) return null;
	const client = new Anthropic({ apiKey });
	return async ({ draft, messages }) => {
		const history: Anthropic.Beta.BetaMessageParam[] = [
			{ role: "user", content: `Драфт:\n${draft}\n\nСделай отчёт.` },
			...messages,
		];
		const response = await client.beta.messages.create({
			model: "claude-opus-5-5",
			max_tokens: 16000,
			betas: ["server-side-fallback-2026-07-01"],
			fallbacks: "default",
			output_config: { effort: "medium" },
			system: SYSTEM,
			messages: history,
		});
		if (response.stop_reason === "refusal")
			return "Модель отказалась отвечать на этот запрос.";
		return response.content
			.flatMap((block) => (block.type === "text" ? [block.text] : []))
			.join("\n")
			.trim();
	};
}
