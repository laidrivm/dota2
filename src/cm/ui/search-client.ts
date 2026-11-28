/**
 * The page's side of the search worker (design D6). Each draft state is sent
 * with a `stateId`; only a result carrying the latest id is shown. A state
 * that arrives while a search runs terminates that worker and starts another,
 * so the newest draft never waits behind an older one's search.
 */
import type { SnapshotBundle } from "../../types.ts";
import type { DraftState } from "../engine/draft.ts";
import type { SearchResult } from "../engine/search.ts";

/** The slice of `Worker` the client uses, so a test can stand in for it. */
export interface SearchWorker {
	postMessage(message: unknown): void;
	terminate(): void;
	onmessage: ((event: MessageEvent) => void) | null;
}

export type SearchRequest =
	| { type: "bundle"; bundle: SnapshotBundle }
	| { type: "search"; stateId: number; state: DraftState };

export interface SearchReply {
	stateId: number;
	result: SearchResult | null;
}

export class SearchClient {
	private worker: SearchWorker | null = null;
	private latest = 0;
	private busy = false;

	constructor(
		private readonly spawn: () => SearchWorker,
		private readonly bundle: SnapshotBundle,
		private readonly onResult: (result: SearchResult | null) => void,
	) {}

	request(state: DraftState): void {
		this.latest += 1;
		if (this.busy) this.stop();
		const worker = this.worker ?? this.start();
		this.busy = true;
		worker.postMessage({ type: "search", stateId: this.latest, state });
	}

	dispose(): void {
		this.stop();
	}

	private start(): SearchWorker {
		const worker = this.spawn();
		worker.onmessage = ({ data }: MessageEvent<SearchReply>) => {
			if (data.stateId !== this.latest) return;
			this.busy = false;
			this.onResult(data.result);
		};
		// The snapshot crosses once per worker; each search sends the draft alone.
		worker.postMessage({ type: "bundle", bundle: this.bundle });
		this.worker = worker;
		return worker;
	}

	private stop(): void {
		this.worker?.terminate();
		this.worker = null;
		this.busy = false;
	}
}
