/**
 * The files the app fetches at runtime, as Bun.serve routes.
 *
 * Kept apart from `server.ts` so they can be exercised without importing
 * the HTML entry point (which would pull in the whole bundler).
 */

const fontDir = new URL("./src/app/styles/fonts/", import.meta.url);
const snapshotFile = new URL("./src/fixtures/snapshot.json", import.meta.url);

// The woff2 filenames encode their own face, so their bytes never change and
// they can be cached forever. fonts.css can gain a face under a stable name,
// so it must be revalidated.
const FILE_KINDS: Record<string, { type: string; cache: string }> = {
	woff2: {
		type: "font/woff2",
		cache: "public, max-age=31536000, immutable",
	},
	css: { type: "text/css; charset=utf-8", cache: "no-cache" },
};

export function staticRoutes(): Record<string, Response> {
	const routes: Record<string, Response> = {};

	// Built from the directory listing, so a request can only ever name a file
	// that is actually there — there is no path for it to traverse out of.
	for (const name of new Bun.Glob("*.{woff2,css}").scanSync(fontDir.pathname)) {
		const kind = FILE_KINDS[name.split(".").pop() ?? ""];
		if (!kind) continue;
		routes[`/fonts/${name}`] = new Response(Bun.file(new URL(name, fontDir)), {
			headers: { "content-type": kind.type, "cache-control": kind.cache },
		});
	}

	// Until Phase 4 publishes a real bundle, the fixture is the snapshot. It is
	// revalidated rather than cached, because the pipeline will republish this
	// same URL.
	routes["/snapshot.json"] = new Response(Bun.file(snapshotFile), {
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-cache",
		},
	});

	return routes;
}
