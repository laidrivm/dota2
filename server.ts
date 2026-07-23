/**
 * Dev and production server.
 *
 * Bun's HTML entry point bundles the app, but its CSS bundler inlines every
 * `url()` asset as base64 — which would put ~80 KB of fonts inside a
 * render-blocking stylesheet. Serving the woff2 files from their own routes
 * keeps them cacheable and the stylesheet small; `fonts.css` therefore stays
 * out of the bundle and is pulled in by an inline `@import` in index.html.
 */

import { serve } from "bun";
import homepage from "./index.html";
import { staticRoutes } from "./static-routes.ts";

const server = serve({
	development: { hmr: true },
	routes: {
		...staticRoutes(),
		"/": homepage,
	},
});

console.log(`listening on ${server.url}`);
