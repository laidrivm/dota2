/**
 * Dev and production server. Both serve `dist/`, so the page opened in
 * development went through the bundler that built the one that ships —
 * unminified, which is the only way the two differ.
 *
 * The HTML entry point is deliberately not a route here. Bun's HTML dev
 * bundler is a second implementation of the one `bun build` runs, and it
 * cannot emit a CSS module's class-name mapping (oven-sh/bun#18258), so a
 * component that imported one would read `undefined` off a binding that was
 * never defined. `bun run dev` builds and watches instead.
 *
 * The fonts and the snapshot keep their own routes rather than being read out
 * of `dist`: their headers are the contract `static-routes.test.ts` asserts,
 * and the woff2 files stay out of the bundle so they remain cacheable files.
 */

import { serve } from "bun";
import { distDir, distFile } from "./dist-routes.ts";
import { staticRoutes } from "./static-routes.ts";

// Nothing to serve otherwise, and an empty page is a worse answer than this.
if (!(await Bun.file(new URL("index.html", distDir)).exists())) {
	throw new Error(
		"dist/ carries no index.html — run `bun run build`, or `bun run dev` to build and watch",
	);
}

const server = serve({
	routes: staticRoutes(),
	fetch: (request) =>
		distFile(new URL(request.url).pathname) ??
		new Response("Not found", { status: 404 }),
});

console.log(`listening on ${server.url}`);
