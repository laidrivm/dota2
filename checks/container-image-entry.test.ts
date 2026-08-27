/**
 * The two entry points one image carries, exercised by running it.
 *
 * The server is the default command and the job is the one that has to be
 * asked for, which is the whole of how they differ. Everything below is read
 * off a container rather than off the `Dockerfile`, because the failure this
 * requirement exists to prevent appears in no build and in no unit test:
 * `static-routes.ts` resolves the fonts, the fixture snapshot and the job's
 * schema from *source* paths, so an image carrying only `dist/` is wrong in a
 * way only running it can show. Measured, by building exactly that image: the
 * route map is assembled by scanning the font directory, so the server throws
 * `ENOENT` before it binds and the container exits — which is what makes
 * every case below a real one rather than a restatement of the `Dockerfile`.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
	available,
	buildsImage,
	image,
	requiresDocker,
} from "./docker.fixture.ts";

/** The repository root: this file reads artefacts of it, from `checks/`. */
const root = join(import.meta.dir, "..");

requiresDocker();

/** Containers this file started, stopped however it ends. */
const running: string[] = [];

/**
 * The empty publication volume, under a fixed name for the reason the image
 * tag is fixed: a name reused is one volume replaced, where a name carrying
 * the pid leaves one behind on every run of the suite. Removed afterwards all
 * the same, so nothing of this file's outlives it.
 */
const VOLUME = "d2ass-checks-empty";

afterAll(() => {
	for (const id of running)
		Bun.spawnSync(["docker", "stop", id], {
			stdout: "ignore",
			stderr: "ignore",
			timeout: 45_000,
		});
	// After the containers, never before: a volume still attached to one is
	// refused, and the removal would fail quietly on the way out.
	Bun.spawnSync(["docker", "volume", "rm", "-f", VOLUME], {
		stdout: "ignore",
		stderr: "ignore",
		timeout: 45_000,
	});
});

/**
 * Start the image with no command of its own and wait until it answers.
 *
 * The port is asked for rather than fixed: `:3000` is taken on the machine
 * this deploys to and may be taken on the machine this runs on, and a suite
 * that failed for that reason would be reporting on the host rather than on
 * the image. Readiness is a request that succeeds, never a sleep — the server
 * binds after a `dist/` check, so the interval that is long enough today is
 * the one that is flaky on a slower runner.
 */
async function serve(...opts: string[]): Promise<string> {
	const started = Bun.spawnSync(
		["docker", "run", "-d", "--rm", "-p", "127.0.0.1::3000", ...opts, image()],
		{ stdout: "pipe", stderr: "pipe", timeout: 45_000 },
	);
	if (started.exitCode !== 0)
		throw new Error(`docker run failed:\n${started.stderr.toString()}`);
	const id = started.stdout.toString().trim();
	running.push(id);

	const mapped = Bun.spawnSync(["docker", "port", id, "3000"], {
		stdout: "pipe",
		timeout: 45_000,
	});
	const port = mapped.stdout.toString().split("\n")[0]?.split(":").pop();
	if (!port) throw new Error("the container published no port");

	const url = `http://127.0.0.1:${port}`;
	for (let attempt = 0; attempt < 150; attempt++) {
		try {
			await fetch(url);
			return url;
		} catch {
			await Bun.sleep(100);
		}
	}
	// The logs, because a container that never answered has already said why
	// and the alternative is a timeout with nothing to read.
	const logs = Bun.spawnSync(["docker", "logs", id], {
		stdout: "pipe",
		stderr: "pipe",
		timeout: 45_000,
	});
	throw new Error(
		`the container never answered:\n${logs.stdout.toString()}${logs.stderr.toString()}`,
	);
}

describe.skipIf(!available)("the image run with no command of its own", () => {
	buildsImage();

	// spec: container-image/the-image-run-with-no-command-of-its-own
	test("serves the application", async () => {
		const url = await serve();
		const answer = await fetch(url);
		expect(answer.status).toBe(200);
		expect(answer.headers.get("content-type")).toContain("text/html");
	}, 120_000);

	// spec: container-image/a-font-request-before-anything-has-been-exported
	test("answers a font the build copied from the image", async () => {
		// Taken from the tree rather than named here: the faces are renamed
		// when they are subset, and a case naming one that no longer exists
		// would fail as though the route were broken.
		const font = readdirSync(join(root, "src/app/styles/fonts")).find((name) =>
			name.endsWith(".woff2"),
		);
		expect(font).toBeDefined();
		const url = await serve();
		const answer = await fetch(`${url}/fonts/${font}`);
		expect(answer.status).toBe(200);
		expect(answer.headers.get("content-type")).toBe("font/woff2");
	}, 120_000);

	// spec: container-image/the-snapshot-before-an-export-has-run
	test("answers /snapshot.json with the committed fixture", async () => {
		// An empty named volume over the publication path, which is the state a
		// first deploy is in: the directory exists and no export has filled it.
		const url = await serve("-v", `${VOLUME}:/app/snapshot`);
		const answer = await fetch(`${url}/snapshot.json`);
		expect(answer.status).toBe(200);
		const served = (await answer.json()) as { snapshotId: number };
		const fixture = (await Bun.file(
			join(root, "src/fixtures/snapshot.json"),
		).json()) as { snapshotId: number };
		expect(served.snapshotId).toBe(fixture.snapshotId);
	}, 120_000);
});

// spec: container-image/the-job-entry-point-in-the-same-image
describe.skipIf(!available)("the job entry point in the same image", () => {
	buildsImage();

	test("run without BUNDLE_DIR exits non-zero naming that variable", () => {
		const run = Bun.spawnSync(
			["docker", "run", "--rm", image(), "bun", "src/job/run.ts"],
			{ stdout: "pipe", stderr: "pipe", timeout: 45_000 },
		);
		expect(run.exitCode).not.toBe(0);
		// Reachable at all only because the job and its runtime are in the
		// image: a production stage carrying `dist/` alone cannot get this far.
		expect(run.stderr.toString()).toContain("BUNDLE_DIR");
	}, 60_000);
});
