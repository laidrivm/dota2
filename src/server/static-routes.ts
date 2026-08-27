/**
 * The files the app fetches at runtime, as Bun.serve routes.
 *
 * Kept apart from `server.ts` so they can be exercised without importing
 * the HTML entry point (which would pull in the whole bundler).
 */

import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PUBLISHED } from "../job/export/publish.ts";

/**
 * The repository root, which is two levels above this module rather than the
 * module's own directory. Every path below is written from there because that
 * is where the files are: `src/server/` holds this file and nothing it serves.
 */
const root = new URL("../../", import.meta.url);

export const fontDir = new URL("src/app/styles/fonts/", root);
// A path, not a URL: it is handed to the filesystem, and converting it here
// is one conversion rather than one per request.
const snapshotFile = fileURLToPath(new URL("src/fixtures/snapshot.json", root));

/**
 * Where the export publishes the bundle. Written by the job, never by a build,
 * and gitignored for the reason `icons/` is — a clone has neither until a run
 * fills it.
 *
 * Exported for the same reason `iconDir` is: the lookup below answers an
 * absent directory with the fixture on purpose, so nothing a request can ask
 * for distinguishes a wrong anchor from a clone that has never exported.
 */
export const snapshotDir = new URL("snapshot/", root);

/**
 * Where the ingest mirrors hero images. Written by the job, never by a build.
 *
 * Exported for the same reason `distDir` is: the lookup below turns a missing
 * directory into an empty listing on purpose, so nothing a request can ask for
 * distinguishes a wrong anchor from a clone that has never run the ingest.
 */
export const iconDir = new URL("icons/", root);

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

/**
 * What a route answers with: a fixed file, or a per-request lookup.
 *
 * Narrower than the runtime's own route type, and deliberately. Bun's includes
 * a handler that may return `undefined` — the arm that hands the request to a
 * WebSocket upgrade — and a route map admitting it selects the `Bun.serve`
 * overload that *requires* a `websocket` handler beside it. Measured: widening
 * this to `Bun.Serve.Options<unknown>["routes"]`, or to that type indexed by
 * `string`, fails the typecheck at every `Bun.serve` call in this repository.
 * Nothing here upgrades anything, so the union stays the shapes that are used.
 */
type Route =
	| Response
	| ((request: Request) => Response)
	| ((request: Request) => Promise<Response>);

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
		return new Set(new Bun.Glob("*.png").scanSync(fileURLToPath(dir)));
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

/**
 * The validator last computed, and the file state it was computed from.
 *
 * The key is the resolved path *and* `mtimeNs`, and both halves earn their
 * place. The path, because this route has two sources and a key that forgets
 * which one it read hands the previous source's validator to the next. The
 * nanoseconds, because two writes inside one millisecond share a millisecond
 * timestamp — which is why `dist-routes.ts` reads `mtimeNs` for its listing
 * cache as well.
 *
 * One slot, because one process serves one publication directory. A second
 * server in the same process — which is what this route's own suite runs —
 * finds a key that does not match and hashes again, so the cache costs
 * accuracy nothing and buys nothing there either.
 *
 * The inode is what says the file behind the name changed, and the timestamp
 * rides beside it rather than carrying that alone. A publication renames a
 * freshly written file over the published name, so every one of them puts a
 * different inode there — measured, five publications and five distinct
 * inodes. The timestamp cannot say as much on its own: two publications inside
 * one of the filesystem's ticks share it, and this cache answered the second
 * with the first one's hash until the inode joined the key. Which is not a
 * hypothetical — CI met it, where a returning client was told the bundle it
 * held was still current and this repository's own filesystem never produced
 * the collision in 200 tries.
 *
 * No case reaches the path's half, and none can: it separates the two sources
 * only where their timestamps coincide to the nanosecond, and `utimesSync`
 * takes milliseconds — so a collision cannot be arranged from here, and
 * waiting for one means waiting for two files written years apart to agree.
 * It stays because what it prevents is a client being told stale bytes are
 * the ones it holds, and it costs a string.
 */
let taggedFor = "";
let tag = "";

/**
 * A validator for the bytes at `file`, computed once per publication.
 *
 * A hash of the bytes, not of `mtime` and size: those answer *was this file
 * rewritten*, where the client is asking *is this the payload I hold*, and a
 * re-export writing identical content would cost every returning client the
 * whole bundle again. The `stat` is what each request pays; the hash is paid
 * when the file behind the name changes.
 */
async function validator(file: string): Promise<string> {
	const seen = statSync(file, { bigint: true });
	const key = `${file}:${seen.ino}:${seen.mtimeNs}`;
	if (key !== taggedFor) {
		// The pair is written and read with no `await` between, so two requests
		// resolving different files cannot hand each other the other's answer:
		// whichever assigns last returns what it assigned.
		// SHA-256 over a wyhash: both are one line, and only one of them makes
		// a collision — a changed bundle a returning client is told it already
		// holds — something nobody has to reason about.
		tag = `"${new Bun.CryptoHasher("sha256")
			.update(await Bun.file(file).bytes())
			.digest("hex")}"`;
		taggedFor = key;
	}
	return tag;
}

/**
 * Whether `If-None-Match` names the validator this URL is offering.
 *
 * The header is a list, not a value: RFC 9110 lets it carry several
 * validators, `*` for any current representation, and the `W/` prefix an
 * intermediary adds when it weakened one. Compared against the header whole,
 * a client that named the current bundle beside another gets the bundle
 * again — correct, and the whole payload for nothing.
 *
 * Split on commas, which is safe for the tags this route hands out: an entity
 * tag may contain one inside its quotes, and every tag offered here is hex.
 */
const revalidates = (header: string | null, etag: string): boolean =>
	header?.split(",").some((named) => {
		const candidate = named.trim();
		return candidate === "*" || candidate === etag || candidate === `W/${etag}`;
	}) ?? false;

/**
 * The bundle if one has been published, and the committed fixture otherwise.
 *
 * A per-request lookup rather than a prebuilt `Response` because this route's
 * *source* switches: the fixture until an export publishes, the published file
 * afterwards. A map built at startup would serve the fixture until a restart,
 * which is the same reason the icon route resolves its listing per request.
 *
 * Both answers are revalidated: the URL is republished under one name, so what
 * a client holds is never fresh on its own account — it asks, and a client
 * holding the current bytes is told so in a header rather than sent them
 * again.
 */
const snapshotRoute =
	(dir: URL) =>
	async (request: Request): Promise<Response> => {
		const bundle = fileURLToPath(new URL(PUBLISHED, dir));
		const file = (await Bun.file(bundle).exists()) ? bundle : snapshotFile;
		const etag = await validator(file);
		if (revalidates(request.headers.get("if-none-match"), etag))
			// The validator and the freshness rule, and no `content-type`: a
			// 304 describes what the client already holds, and repeating the
			// representation's own headers over a body that is not there is
			// what RFC 9110 tells a server not to do.
			return new Response(null, {
				status: 304,
				headers: { "cache-control": "no-cache", etag },
			});
		return new Response(Bun.file(file), {
			headers: {
				"content-type": "application/json; charset=utf-8",
				"cache-control": "no-cache",
				etag,
			},
		});
	};

export function staticRoutes(
	icons: URL = iconDir,
	snapshots: URL = snapshotDir,
): Record<string, Route> {
	const routes: Record<string, Route> = {};

	routes["/icons/*"] = iconRoute(icons);
	// Written out rather than built from `PUBLISHED`, though the two spell the
	// same thing today. The URL is the client's contract — `snapshot-delivery`
	// pins it and `src/app/snapshot.ts` fetches it — where the filename is the
	// job's, and deriving one from the other would move the URL out from under
	// the client the day the export renamed its file.
	routes["/snapshot.json"] = snapshotRoute(snapshots);

	// Built from the directory listing, so a request can only ever name a file
	// that is actually there — there is no path for it to traverse out of.
	for (const name of new Bun.Glob("*.{woff2,css}").scanSync(
		fileURLToPath(fontDir),
	)) {
		const kind = FILE_KINDS[name.split(".").pop() ?? ""];
		if (!kind) continue;
		routes[`/fonts/${name}`] = new Response(Bun.file(new URL(name, fontDir)), {
			headers: { "content-type": kind.type, "cache-control": kind.cache },
		});
	}

	return routes;
}
