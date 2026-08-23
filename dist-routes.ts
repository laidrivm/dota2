/**
 * The built bundle, as a lookup `Bun.serve` can hand a request to.
 *
 * Kept apart from `server.ts` for the reason `static-routes.ts` is —
 * so it can be exercised without starting a server.
 */

import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { staticRoutes } from "./static-routes.ts";

/** Exported so a caller can say what is missing before asking for a file:
 * listing a directory that is not there throws rather than coming up empty. */
export const distDir = new URL("./dist/", import.meta.url);

/**
 * The paths served from source, with headers of their own — the build copies
 * both into `dist` as well, and answering them from there would drop those
 * headers. Read off the routes rather than restated, so the two cannot drift.
 */
const owned = new Set(Object.keys(staticRoutes()));

// Nanoseconds, not `mtimeMs`: two writes inside the same millisecond are one
// timestamp, and the second would be served from a stale listing.
let listedAt = -1n;
let listing = new Set<string>();

/**
 * What `dist/` holds at its top level, scoped by what it exempts: an asset the
 * bundler emits under an extension nobody thought of is served, rather than
 * 404ing while the document links it.
 *
 * The top level is where the bundler emits, and it is also as deep as the
 * cache key reaches: a write inside a child directory changes that child's
 * mtime, not this one's. Listing deeper would promise a freshness the key
 * cannot give, and the only subdirectory `dist/` has is `fonts/`, which
 * `staticRoutes` owns. A bundler that starts emitting into a subdirectory
 * 404s on the first page load rather than serving something stale.
 *
 * A rebuild renames every hashed asset — it adds and removes entries — so the
 * directory's own mtime is what says the set is stale, and a `stat` costs a
 * fiftieth of the scan. Content that changes under an unchanged name needs no
 * refresh: `Bun.file` reads it when the response is sent.
 */
function listed(): Set<string> {
	const at = statSync(distDir, { bigint: true }).mtimeNs;
	if (at !== listedAt) {
		// `scanSync` does not follow symlinks unless asked to, measured against
		// Bun 1.3.14, so a link planted in `dist/` is not listed and `Bun.file`
		// never receives one. That default is what the containment above rests
		// on, and `build.test.ts` pins it.
		listing = new Set(new Bun.Glob("*").scanSync(fileURLToPath(distDir)));
		listedAt = at;
	}
	return listing;
}

/**
 * The file a request names, or `null` if `dist/` does not list one. Built from
 * the directory listing, so a request can only ever name a file that is
 * actually there — there is no path for it to traverse out of.
 */
export function distFile(pathname: string): Response | null {
	if (owned.has(pathname)) return null;

	const name = pathname === "/" ? "index.html" : pathname.slice(1);

	return listed().has(name)
		? new Response(Bun.file(new URL(name, distDir)))
		: null;
}
