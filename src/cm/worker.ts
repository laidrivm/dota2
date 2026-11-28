/**
 * The search worker's side (design D6). The page's own bundle, started as a
 * worker, runs this instead of rendering (`main.tsx`): it keeps the snapshot
 * it is sent and answers each search with the deepest ranking the budget
 * allows for that state (design D8), tagged
 * with the state's id so the page can drop anything it no longer wants.
 */
import type { SnapshotBundle } from "../types.ts";
import { type SearchOptions, search } from "./engine/search.ts";
import type { SearchReply, SearchRequest } from "./ui/search-client.ts";

/** The slice of a worker's global scope the search uses. */
export interface SearchScope {
	onmessage: ((event: MessageEvent<SearchRequest>) => void) | null;
	postMessage(reply: SearchReply): void;
}

export function serveSearch(
	scope: SearchScope,
	// The search's budget and clock: the page's defaults, a case's own.
	options: SearchOptions = {},
): void {
	let bundle: SnapshotBundle | null = null;
	scope.onmessage = ({ data }) => {
		if (data.type === "bundle") {
			bundle = data.bundle;
			return;
		}
		// The client sends the snapshot before any search; one without it is
		// a request this worker cannot answer, and it stays unanswered.
		if (bundle === null) return;
		scope.postMessage({
			stateId: data.stateId,
			result: search(bundle, data.state, options),
		});
	};
}
