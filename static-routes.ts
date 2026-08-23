/**
 * The files the app fetches at runtime, as Bun.serve routes.
 *
 * Kept apart from `server.ts` so they can be exercised without importing
 * the HTML entry point (which would pull in the whole bundler).
 */

const fontDir = new URL("./src/app/styles/fonts/", import.meta.url);
const snapshotFile = new URL("./src/fixtures/snapshot.json", import.meta.url);

/** Where the ingest mirrors hero images. Written by the job, never by a build. */
const iconDir = new URL("./icons/", import.meta.url);

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

/** What a route answers with: a fixed file, or a per-request lookup. */
type Route = Response | ((request: Request) => Response);

/**
 * The image names the mirror holds, or none where it holds nothing yet — a
 * clone that has never run the ingest has no such directory at all, and a
 * scan of it raises rather than coming back empty.
 *
 * A temporary file is missed by the pattern twice over: it does not end in
 * `.png`, and it is a dotfile. That is deliberate belt and braces, since the
 * two are what stand between a reader and half a download.
 */
const held = (dir: URL): Set<string> => {
	try {
		return new Set(new Bun.Glob("*.png").scanSync(dir.pathname));
	} catch {
		return new Set();
	}
};

/**
 * The mirrored images, resolved from the directory listing on every request.
 *
 * Unlike the fonts this cannot be a prebuilt map: the ingest writes this
 * directory while the server is running, and a map built at startup would
 * leave a hero added tonight unreachable until a restart. The listing is also
 * what makes the lookup safe — a name that is not in it is answered `404`,
 * so there is no path for a request to traverse out of, encoded or otherwise.
 *
 * `404` carries no body, so `docs/api-design.md`'s RFC 9457 rule has nothing
 * to shape: that rule reaches a response that carries one.
 */
const iconRoute =
	(dir: URL) =>
	(request: Request): Response => {
		const name = new URL(request.url).pathname.slice("/icons/".length);
		if (!held(dir).has(name)) return new Response(null, { status: 404 });
		return new Response(Bun.file(new URL(name, dir)), {
			headers: {
				"content-type": "image/png",
				// The filename carries the hero and the bytes under a given name
				// never change, which is the fonts' reasoning unchanged.
				"cache-control": "public, max-age=31536000, immutable",
			},
		});
	};

export function staticRoutes(icons: URL = iconDir): Record<string, Route> {
	const routes: Record<string, Route> = {};

	routes["/icons/*"] = iconRoute(icons);

	// Built from the directory listing, so a request can only ever name a file
	// that is actually there — there is no path for it to traverse out of.
	for (const name of new Bun.Glob("*.{woff2,css}").scanSync(fontDir.pathname)) {
		const kind = FILE_KINDS[name.split(".").pop() ?? ""];
		if (!kind) continue;
		routes[`/fonts/${name}`] = new Response(Bun.file(new URL(name, fontDir)), {
			headers: { "content-type": kind.type, "cache-control": kind.cache },
		});
	}

	// Until Phase 3 publishes a real bundle, the fixture is the snapshot. It is
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
