/**
 * `bun run dev`: build, watch, serve. The bundle is what the server hands out
 * (see `server.ts` for why the HTML entry point is not served directly), so a
 * change has to be rebuilt before it is visible.
 *
 * Not minified — that is the one difference from the production build, and
 * `build.test.ts` runs the real one. What this arrangement exists for is the
 * bundler's behaviour, not the minifier's.
 */

import { watch } from "node:fs";
import { rm } from "node:fs/promises";

const root = new URL("..", import.meta.url).pathname;
const dist = `${root}dist`;

// `bun run build`'s own first act, for the same reason: whatever is in there
// was emitted by a build nobody is running now, and the server answers from
// the listing rather than from what the document links.
await rm(dist, { recursive: true, force: true });

let building: Promise<unknown> = Promise.resolve();
let emitted = new Set<string>();

const build = () => {
	building = Bun.build({ entrypoints: [`${root}index.html`], outdir: dist })
		.then(async (result) => {
			// Every rebuild names its assets by content, so the previous ones
			// would otherwise pile up for the whole session — and go on being
			// served under names nothing links to any more.
			const built = new Set(result.outputs.map((output) => output.path));
			for (const path of emitted) {
				if (!built.has(path)) await Bun.file(path).delete();
			}
			emitted = built;
			console.log("bundled");
		})
		.catch((error) => console.error(error));
	return building;
};

await build();

// One save fires several events, so a rebuild already in flight absorbs them
// rather than queueing a build per event.
let pending = false;
const rebuild = () => {
	if (pending) return;
	pending = true;
	building.then(() => {
		pending = false;
		build();
	});
};

watch(`${root}src`, { recursive: true }, rebuild);
watch(`${root}index.html`, rebuild);

await import("../server.ts");
