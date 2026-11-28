/**
 * The search worker's side (design D6). The page's own bundle, started as a
 * worker, runs this instead of rendering (`main.tsx`): it keeps the snapshot
 * it is sent and answers each search with the ranking for that state, tagged
 * with the state's id so the page can drop anything it no longer wants.
 */
import type { SnapshotBundle } from "../types.ts";
import { suggest } from "./engine/suggest.ts";
import type { SearchReply, SearchRequest } from "./ui/search-client.ts";

/** The slice of a worker's global scope the search uses. */
export interface SearchScope {
	onmessage: ((event: MessageEvent<SearchRequest>) => void) | null;
	postMessage(reply: SearchReply): void;
}

export function serveSearch(scope: SearchScope): void {
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
			result: suggest(bundle, data.state),
		});
	};
}
