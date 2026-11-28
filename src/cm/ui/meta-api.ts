/**
 * The CM page's calls to `/api/cm/meta`: the d2pt meta the captain uploaded,
 * read once signed in, and each saved data file posted. Nothing here throws:
 * an answer the page cannot use reads as no meta, or as a message.
 */
import { call, type Fetcher } from "./api.ts";

const META = "/api/cm/meta";

export interface StoredPosition {
	patch: string;
	uploadedAt: string;
	heroes: Record<string, { rating: number | null }>;
}

export type MetaPositions = Record<
	"1" | "2" | "3" | "4" | "5",
	StoredPosition | null
>;

export const NO_META: MetaPositions = {
	"1": null,
	"2": null,
	"3": null,
	"4": null,
	"5": null,
};

/** The stored meta, or every position empty when it cannot be read. */
export async function readMeta(
	fetcher: Fetcher = fetch,
): Promise<MetaPositions> {
	const response = await call(fetcher, undefined, META);
	if (response?.status !== 200) return NO_META;
	const body = await response.json().catch(() => null);
	const positions = body?.positions;
	if (typeof positions !== "object" || positions === null) return NO_META;
	return { ...NO_META, ...positions };
}

/** What the server said about one uploaded file, in words for the page. */
export async function uploadMeta(
	text: string,
	fetcher: Fetcher = fetch,
): Promise<string> {
	const response = await call(fetcher, { method: "POST", body: text }, META);
	switch (response?.status) {
		case 200: {
			const body = await response.json().catch(() => null);
			return `Stored pos ${body?.position}: ${body?.heroes} heroes, patch ${body?.patch}.`;
		}
		case 413:
			return "That file is larger than 5 MB, so it is not a d2pt meta file.";
		case 422:
			return "That file is not a d2pt meta file for one position.";
		case 401:
			return "Your session has ended. Sign in again to upload.";
		default:
			return "The upload failed. Try again shortly.";
	}
}
