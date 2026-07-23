/**
 * Where the snapshot bundle comes from.
 *
 * The bundle is fetched over HTTP rather than imported as a module, so the
 * pipeline (Phase 4) can take over the producer by changing nothing but the
 * URL below. The last good response is cached, because a draft assistant
 * that dies with the network is useless in the two minutes it exists for.
 */

import type { SnapshotBundle } from "../types.ts";
import { read, write } from "./storage.ts";

/**
 * The one line Phase 4 changes. Until the pipeline exists, `server.ts`
 * serves the fixture here and the build copies it into `dist/`; the client
 * only ever sees a URL. Deliberately not a bundler asset import: a hashed
 * filename would mean a rebuild to publish a new snapshot, which is the
 * opposite of what the pipeline needs.
 */
const SNAPSHOT_URL = "/snapshot.json";

export const CACHE_KEY = "snapshot.bundle";

/**
 * Formats as `Jul 19`. Pinned to UTC so the viewer's timezone cannot shift
 * the date by a day; the pipeline writes `createdAt` with a `Z`.
 */
const SNAPSHOT_DATE = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

/** Leading `YYYY-MM-DD` of an ISO timestamp, with a real month and day. */
const ISO_DATE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])/;

function isHeroEntry(value: unknown): boolean {
	if (typeof value !== "object" || value === null) return false;
	const hero = value as { id?: unknown; name?: unknown };
	return typeof hero.id === "number" && typeof hero.name === "string";
}

/**
 * A payload we cannot render from is no better than no payload at all. The
 * date is checked against the calendar because the header formats it by
 * reading the digits, and a hero list is checked entry by entry because a
 * truncated response is otherwise indistinguishable from a real one.
 */
export function isBundle(value: unknown): value is SnapshotBundle {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const b = value as Partial<SnapshotBundle>;
	return (
		typeof b.snapshotId === "number" &&
		typeof b.createdAt === "string" &&
		ISO_DATE.test(b.createdAt) &&
		typeof b.patch?.id === "string" &&
		Array.isArray(b.heroes) &&
		b.heroes.length > 0 &&
		b.heroes.every(isHeroEntry)
	);
}

async function fetchBundle(): Promise<SnapshotBundle | null> {
	try {
		const response = await fetch(SNAPSHOT_URL);
		if (!response.ok) return null;
		const payload = await response.json();
		return isBundle(payload) ? payload : null;
	} catch {
		// Offline, DNS failure, a proxy's HTML error page — all the same to us.
		return null;
	}
}

function readCache(): SnapshotBundle | null {
	const cached = read(CACHE_KEY);
	if (cached === null) return null;
	try {
		const parsed = JSON.parse(cached);
		return isBundle(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

/**
 * One fetch per call — the app calls this once at startup, and again only
 * when the user activates retry from the error state.
 */
export async function loadSnapshot(): Promise<SnapshotBundle | null> {
	const fetched = await fetchBundle();
	if (fetched) {
		write(CACHE_KEY, JSON.stringify(fetched));
		return fetched;
	}
	return readCache();
}

/** `patch 7.41d · snapshot Jul 19` */
export function formatProvenance(bundle: SnapshotBundle): string {
	const date = SNAPSHOT_DATE.format(new Date(bundle.createdAt));
	return `patch ${bundle.patch.id} · snapshot ${date}`;
}
