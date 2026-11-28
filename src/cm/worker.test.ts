/** The search worker answering the page, over a scope that records replies. */
import { expect, test } from "bun:test";
import type { DraftState } from "./engine/draft.ts";
import { bundle, everywhere, hero } from "./engine/engine.fixture.ts";
import { search } from "./engine/search.ts";
import type { SearchReply, SearchRequest } from "./ui/search-client.ts";
import { type SearchScope, serveSearch } from "./worker.ts";

const unplaced = { position: null, rank: null, signatures: [] };
const state: DraftState = {
	side: "radiant",
	pickOrder: "first",
	steps: [],
	ours: [unplaced, unplaced, unplaced, unplaced, unplaced],
	theirs: [unplaced, unplaced, unplaced, unplaced, unplaced],
};

function scope() {
	const replies: SearchReply[] = [];
	const it: SearchScope = {
		onmessage: null,
		postMessage: (reply) => replies.push(reply),
	};
	serveSearch(it);
	const send = (data: SearchRequest) =>
		it.onmessage?.({ data } as MessageEvent<SearchRequest>);
	return { replies, send };
}

test("a search after the snapshot is answered with its ranking and its id", () => {
	const b = bundle([hero(1, everywhere), hero(2, { "1": 1 })]);
	const { replies, send } = scope();
	send({ type: "bundle", bundle: b });
	send({ type: "search", stateId: 7, state });
	const result = search(b, state, { budgetMs: 0 });
	expect(replies).toHaveLength(1);
	expect(replies[0]).toMatchObject({
		stateId: 7,
		result: { step: 1, team: "ours" },
	});
	expect(replies[0]?.result?.entries.map((e) => e.hero)).toEqual(
		result?.entries.map((e) => e.hero),
	);
});

test("a search before any snapshot goes unanswered", () => {
	const { replies, send } = scope();
	send({ type: "search", stateId: 1, state });
	expect(replies).toEqual([]);
});
