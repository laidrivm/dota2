import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

/**
 * `dist/` on a plain static file host, which is the claim `app-shell` makes
 * about the production build: no server-side code, nothing resolved from
 * source, nothing fetched from anywhere else.
 *
 * Python's `http.server` rather than anything of this project's, because a
 * static server written here would be the server-side code the requirement
 * says the output does not need. It is what the README already tells a reader
 * to point at `dist/`.
 *
 * The build goes to a directory of its own rather than to `dist/`. The dev
 * server the rest of the suite runs against serves `dist/` and would be
 * answering out of a directory this had just removed — a failure in whichever
 * spec happened to be running beside it, and in this one never.
 */

/** The repository root, from `e2e/`. */
const root = fileURLToPath(new URL("..", import.meta.url));

/** A port nothing is listening on, taken by listening on one and letting go. */
const freePort = () =>
	new Promise<number>((resolve, reject) => {
		const probe = createServer();
		probe.on("error", reject);
		probe.listen(0, "127.0.0.1", () => {
			const found = probe.address();
			if (typeof found === "string" || found === null) {
				probe.close();
				reject(new Error("the probe bound no port"));
				return;
			}
			probe.close(() => resolve(found.port));
		});
	});

/**
 * The production build, put where nothing else is serving from.
 *
 * The command is `package.json`'s own with the output directory replaced,
 * rather than a copy of it: the build is `rm -rf`, a bundle and two copies,
 * and a copy of that here would go on running the old steps after the script
 * changed. The four occurrences are asserted, so a script that stops naming
 * the directory four times fails here instead of building into `dist/` after
 * all.
 */
function build(into: string): void {
	const { scripts } = JSON.parse(
		readFileSync(join(root, "package.json"), "utf8"),
	) as { scripts: Record<string, string> };
	const parts = (scripts.build ?? "").split("dist");
	if (parts.length !== 5)
		throw new Error(
			`expected the build script to name dist four times: ${scripts.build}`,
		);
	// One word to `sh`, whatever it holds: this path is a temporary
	// directory's rather than one somebody chose, so a space in it would
	// otherwise split the argument and an apostrophe would end it.
	const word = `'${into.replaceAll("'", `'\\''`)}'`;
	const built = spawnSync("sh", ["-c", parts.join(word)], {
		cwd: root,
		encoding: "utf8",
		// What the build needs and nothing else, so the bundle under test does
		// not depend on who ran it. It cannot be the whole story: `cwd` has to
		// be the repository root — the build reads `index.html` and `src/` —
		// and bun loads the `.env` sitting there whatever this passes. Nothing
		// under `src/` reads a variable today, so that reaches no bundle; this
		// is what keeps the *spawn* from carrying one in.
		env: Object.fromEntries(
			["PATH", "HOME", "TMPDIR"]
				.map((name) => [name, process.env[name]])
				.filter((pair): pair is [string, string] => pair[1] !== undefined),
		),
	});
	if (built.status !== 0)
		throw new Error(`the build failed:\n${built.stderr}${built.stdout}`);
}

let served: string | undefined;
let host: ReturnType<typeof spawn> | undefined;
let origin = "";

test.beforeAll(async () => {
	// The bundle and two copies, against a default that assumes a page load.
	test.setTimeout(120_000);
	served = mkdtempSync(join(tmpdir(), "d2ass-static-"));
	build(served);

	// Three attempts, because the port is chosen by binding one and letting it
	// go: between that and `http.server` binding it, something else on the
	// machine may take it. Rare, and a flake gets fixed rather than retried.
	for (let attempt = 0; attempt < 3; attempt++) {
		if (await serve(served)) return;
		host?.kill();
	}
	throw new Error(`nothing answered on ${origin}`);
});

/** Start the static host on a free port, and say whether it answered. */
async function serve(directory: string): Promise<boolean> {
	const port = await freePort();
	origin = `http://127.0.0.1:${port}`;
	host = spawn(
		"python3",
		[
			"-m",
			"http.server",
			String(port),
			"--bind",
			"127.0.0.1",
			"--directory",
			directory,
		],
		{ stdio: "ignore" },
	);

	for (let waited = 0; waited < 100; waited++) {
		// A process that has already exited is a port lost to something else,
		// and no amount of waiting brings it back.
		if (host.exitCode !== null) return false;
		try {
			if ((await fetch(origin)).ok) return true;
		} catch {
			// Not listening yet, which is what the next attempt is for.
		}
		await new Promise((wait) => setTimeout(wait, 100));
	}
	return false;
}

test.afterAll(() => {
	host?.kill();
	if (served) rmSync(served, { recursive: true, force: true });
});

// spec: app-shell/build-output-is-self-contained
test("dist on a static host loads, fetches its snapshot and reaches Setup", async ({
	page,
}) => {
	// Every request the page makes, so that "with no other process running" is
	// asserted rather than assumed: the dev server is up on its own port
	// throughout this suite, and a build that had kept an absolute URL to it
	// would pass every assertion below while proving the opposite.
	const elsewhere: string[] = [];
	page.on("request", (request) => {
		// The parsed origin, not a prefix: `http://127.0.0.1:<port>@elsewhere/`
		// starts with this origin and goes somewhere else entirely, which is
		// the one thing this listener exists to catch.
		if (new URL(request.url()).origin !== origin) elsewhere.push(request.url());
	});

	const snapshot = page.waitForResponse((response) =>
		response.url().endsWith("/snapshot.json"),
	);
	await page.goto(origin);
	expect((await snapshot).status()).toBe(200);

	// Setup on screen is what says the snapshot resolved: the app renders
	// nothing until it does, so this is the whole path from an empty document
	// to a screen a user can act on.
	await expect(page.getByRole("group", { name: "Side" })).toBeVisible();
	await expect(page.getByRole("group", { name: "Role" })).toBeVisible();

	expect(elsewhere).toEqual([]);
});

// spec: draft-board/the-image-does-not-load
test("dist carries no icons, so the board is palette squares throughout", async ({
	page,
}) => {
	await page.goto(origin);
	const bundle = (await (
		await page.request.get(`${origin}/snapshot.json`)
	).json()) as {
		heroes: unknown[];
	};
	await page.getByRole("radio", { name: "R Radiant" }).check();
	await page.getByRole("radio", { name: "1 C Carry" }).click();

	// The picker is where every hero has a tile at once, so one screen covers
	// the whole board's worth of them.
	await page.getByRole("button", { name: "Add ban" }).click();
	await expect(page.getByRole("dialog")).toBeVisible();

	// Every hero's tile asked for an image the build does not carry, the host
	// answered 404, and not one is revealed — each showing the abbreviation over
	// its palette square instead. The tile count is what keeps that from being
	// satisfied by a picker holding no tiles at all.
	//
	// The picker's tiles carry no label, so none is reachable by role: the grid
	// names each hero beside its tile, and a second name is what the requirement
	// forbids.
	await expect
		.poll(() =>
			page.getByRole("dialog").evaluate((el) => {
				const images = [...el.querySelectorAll("img")];
				return {
					tiles: images.length,
					shown: images.filter((i) => getComputedStyle(i).opacity !== "0")
						.length,
					unlettered: images.filter(
						(i) => (i.parentElement?.textContent ?? "") === "",
					).length,
					// Every request has come back, and every one came back empty.
					// Without these the fallback is asserted against a state that
					// looks the same before any request has finished at all.
					pending: images.filter((i) => !i.complete).length,
					drew: images.filter((i) => i.naturalWidth > 0).length,
				};
			}),
		)
		.toEqual({
			tiles: bundle.heroes.length,
			shown: 0,
			unlettered: 0,
			pending: 0,
			drew: 0,
		});
});
