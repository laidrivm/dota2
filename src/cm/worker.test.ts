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

/** A clock that never moves, so every search runs to the draft's end. */
const still = { budgetMs: Number.POSITIVE_INFINITY, now: () => 0 };

function scope() {
	const replies: SearchReply[] = [];
	const it: SearchScope = {
		onmessage: null,
		postMessage: (reply) => replies.push(reply),
	};
	serveSearch(it, still);
	const send = (data: SearchRequest) =>
		it.onmessage?.({ data } as MessageEvent<SearchRequest>);
	return { replies, send };
}

test("a search after the snapshot is answered with its ranking and its id", () => {
	const b = bundle([hero(1, everywhere), hero(2, { "1": 1 })]);
	const { replies, send } = scope();
	send({ type: "bundle", bundle: b });
	send({ type: "search", stateId: 7, state });
	// The call the worker makes, on the same clock: the whole reply, its depth
	// and scores included.
	expect(replies).toEqual([{ stateId: 7, result: search(b, state, still) }]);
	expect(replies[0]?.result).toMatchObject({ step: 1, team: "ours" });
});

test("a search before any snapshot goes unanswered", () => {
	const { replies, send } = scope();
	send({ type: "search", stateId: 1, state });
	expect(replies).toEqual([]);
});
