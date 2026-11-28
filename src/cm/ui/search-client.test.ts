/**
 * The page's side of the search worker (design D6): every draft state gets a
 * `stateId`, a result for any but the latest is dropped, and a newer state
 * that arrives mid-search replaces the worker rather than queueing behind it.
 */
import { expect, test } from "bun:test";
import type { SnapshotBundle } from "../../types.ts";
import type { DraftState } from "../engine/draft.ts";
import type { SearchResult } from "../engine/search.ts";
import { SearchClient, type SearchWorker } from "./search-client.ts";

/** A worker that records what it is sent and answers only when told to. */
class FakeWorker implements SearchWorker {
	sent: unknown[] = [];
	terminated = false;
	onmessage: ((event: MessageEvent) => void) | null = null;
	postMessage(message: unknown) {
		this.sent.push(message);
	}
	terminate() {
		this.terminated = true;
	}
	answer(stateId: number, result: SearchResult | null) {
		this.onmessage?.({ data: { stateId, result } } as MessageEvent);
	}
}

const bundle = { heroes: [] } as unknown as SnapshotBundle;
const state = (steps: number[]) =>
	({ steps, side: "radiant", pickOrder: "first" }) as unknown as DraftState;
const result = (step: number) =>
	({
		step,
		action: "ban",
		team: "ours",
		entries: [],
		depth: 1,
	}) as SearchResult;

function client() {
	const workers: FakeWorker[] = [];
	const shown: (SearchResult | null)[] = [];
	const search = new SearchClient(
		() => {
			const worker = new FakeWorker();
			workers.push(worker);
			return worker;
		},
		bundle,
		(r) => shown.push(r),
	);
	return { search, workers, shown };
}

test("a worker receives the snapshot once, then each state with its id", () => {
	const { search, workers } = client();
	search.request(state([]));
	expect(workers).toHaveLength(1);
	expect(workers[0]?.sent).toEqual([
		{ type: "bundle", bundle },
		{ type: "search", stateId: 1, state: state([]) },
	]);
});

test("a result for the latest state is shown, and the idle worker is reused", () => {
	const { search, workers, shown } = client();
	search.request(state([]));
	workers[0]?.answer(1, result(1));
	search.request(state([14]));
	expect(shown).toEqual([result(1)]);
	expect(workers).toHaveLength(1);
	expect(workers[0]?.sent.at(-1)).toEqual({
		type: "search",
		stateId: 2,
		state: state([14]),
	});
});

test("a newer state mid-search replaces the worker, and the older result never shows", () => {
	const { search, workers, shown } = client();
	search.request(state([]));
	search.request(state([14]));
	expect(workers[0]?.terminated).toBe(true);
	expect(workers[1]?.sent).toEqual([
		{ type: "bundle", bundle },
		{ type: "search", stateId: 2, state: state([14]) },
	]);
	// A result the old worker had already posted arrives late: dropped.
	workers[0]?.answer(1, result(1));
	workers[1]?.answer(2, result(2));
	expect(shown).toEqual([result(2)]);
});

test("a result for an older id is dropped even from the current worker", () => {
	const { search, workers, shown } = client();
	search.request(state([]));
	workers[0]?.answer(1, result(1));
	search.request(state([14]));
	workers[0]?.answer(1, result(1));
	expect(shown).toEqual([result(1)]);
});

test("disposing ends the worker", () => {
	const { search, workers } = client();
	search.request(state([]));
	search.dispose();
	expect(workers[0]?.terminated).toBe(true);
});
