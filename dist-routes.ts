/**
 * The built bundle, as a lookup `Bun.serve` can hand a request to.
 *
 * Kept apart from `server.ts` for the reason `static-routes.ts` is —
 * so it can be exercised without starting a server.
 */

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

/**
 * The file a request names, or `null` if `dist/` does not list one. Built from
 * the directory listing, so a request can only ever name a file that is
 * actually there — there is no path for it to traverse out of. Listed per
 * call, because a rebuild renames every hashed asset.
 *
 * The listing is scoped by what it exempts: an asset the bundler emits under
 * an extension nobody thought of is served, rather than 404ing while the
 * document links it.
 */
export function distFile(pathname: string): Response | null {
	if (owned.has(pathname)) return null;

	const name = pathname === "/" ? "index.html" : pathname.slice(1);
	const listed = new Set(new Bun.Glob("**/*").scanSync(distDir.pathname));

	return listed.has(name)
		? new Response(Bun.file(new URL(name, distDir)))
		: null;
}
