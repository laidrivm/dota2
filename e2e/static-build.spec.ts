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
	// Quoted, because this path is a temporary directory's rather than a word
	// somebody chose, and `sh` would split it at a space.
	const built = spawnSync("sh", ["-c", parts.join(`'${into}'`)], {
		cwd: root,
		encoding: "utf8",
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
			served,
		],
		{ stdio: "ignore" },
	);

	for (let attempt = 0; attempt < 100; attempt++) {
		try {
			if ((await fetch(origin)).ok) return;
		} catch {
			// Not listening yet, which is what the next attempt is for.
		}
		await new Promise((wait) => setTimeout(wait, 100));
	}
	throw new Error(`nothing answered on ${origin}`);
});

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
		if (!request.url().startsWith(origin)) elsewhere.push(request.url());
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
