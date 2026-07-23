/**
 * Dev and production server.
 *
 * Bun's HTML entry point bundles the app, but its CSS bundler inlines every
 * `url()` asset as base64 — which would put ~80 KB of fonts inside a
 * render-blocking stylesheet. Serving the woff2 files from their own routes
 * keeps them cacheable and the stylesheet small; `@font-face` therefore
 * points at absolute `/fonts/…` paths that the bundler leaves alone.
 */

import { serve } from "bun";
import homepage from "./index.html";

const fontDir = new URL("./src/app/styles/fonts/", import.meta.url);

// The woff2 filenames encode their own face, so their bytes never change and
// they can be cached forever. fonts.css can gain a face, and its name is
// stable, so it must be revalidated.
const FILE_KINDS: Record<string, { type: string; cache: string }> = {
	woff2: {
		type: "font/woff2",
		cache: "public, max-age=31536000, immutable",
	},
	css: { type: "text/css; charset=utf-8", cache: "no-cache" },
};

// Routes are built from the directory listing, so a request can only ever
// name a file that is actually there — no path to traverse out of.
const fontRoutes: Record<string, Response> = {};
for (const name of new Bun.Glob("*.{woff2,css}").scanSync(fontDir.pathname)) {
	const kind = FILE_KINDS[name.split(".").pop() ?? ""];
	if (!kind) continue;
	fontRoutes[`/fonts/${name}`] = new Response(
		Bun.file(new URL(name, fontDir)),
		{
			headers: { "content-type": kind.type, "cache-control": kind.cache },
		},
	);
}

const server = serve({
	development: { hmr: true },
	routes: {
		...fontRoutes,
		"/": homepage,
	},
});

console.log(`listening on ${server.url}`);
