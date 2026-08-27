/**
 * What every Docker-gated suite needs: whether a daemon is here at all, the
 * guard that turns a skip in the job owning these cases into a failure, and
 * one image built from a context this fabricates rather than borrows.
 *
 * The context is fabricated for the case that matters most. `.env` holds a
 * real STRATZ key and a real database password on a real machine, so a suite
 * that planted one at the repository root to prove it is excluded would be
 * writing over it — and one that relied on the developer's own would pass
 * vacuously in CI, where there is none. The tracked tree is copied and every
 * file a clone never has is planted beside it, so the WHEN each scenario
 * states is actually arranged.
 *
 * The image is built once for the whole run and left tagged. A fixed tag
 * rather than a fresh one per run: a tag reused is an image replaced, where a
 * unique tag would leave one behind on every run of the suite.
 */
import { beforeAll, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { fabricate } from "./docker-context.fixture.ts";

/** The tag the shared image is built under. */
const TAG = "d2ass-checks:context";

/**
 * How long each kind of docker call may take. Every one of them is a
 * *synchronous* spawn, so a daemon that accepts the connection and then stops
 * answering blocks the thread the test runner's own timer runs on: bun's
 * per-case timeout cannot fire, and the case hangs until CI's job limit rather
 * than until its own. These are what make that a failure instead.
 *
 * Each sits below the timeout of the case that owns it — `RUN` under the 60s
 * on the search case, `BUILD` under the 900s on `buildsImage` — so the call
 * fails first and says why, rather than the case failing with nothing to read.
 */
const PROBE_MS = 10_000;
const BUILD_MS = 600_000;
const RUN_MS = 45_000;

/**
 * What a hook doing docker work is given, against bun's own default of 5s.
 *
 * Every call below is a *synchronous* spawn, and bun cannot fire a hook's
 * timer while one blocks the thread — so a hook that overruns runs to
 * completion and is then reported as timed out, with its real elapsed time in
 * the message. That is why the default is not merely tight here but
 * misleading: it named 25s on a CI runner where the same hooks take 3s on a
 * developer's machine, and nothing in the message says which call was slow.
 */
export const HOOK_MS = 120_000;

/**
 * Whether a daemon is reachable, not merely whether the client is installed:
 * `docker --version` answers on a machine whose daemon is stopped, and every
 * case here needs one that runs containers.
 */
export const available = (() => {
	try {
		// A timeout reports `null` here rather than a status, so it takes the
		// same branch a refusal does — which is the right answer: a daemon that
		// cannot describe itself in ten seconds cannot run these cases either.
		return (
			Bun.spawnSync(["docker", "info"], {
				stdout: "ignore",
				stderr: "ignore",
				timeout: PROBE_MS,
			}).exitCode === 0
		);
	} catch {
		// `docker` is not on PATH at all, which Bun reports by throwing.
		return false;
	}
})();

/**
 * Declare that this file's cases are not allowed to skip in CI.
 *
 * `scripts/test-docker.sh` and the job that runs it set `DOCKER_REQUIRED`,
 * which is what makes a green run evidence that the cases ran rather than
 * evidence that bun found the files.
 */
export const requiresDocker = () =>
	test("the job that requires docker is given a daemon", () => {
		expect(Bun.env.DOCKER_REQUIRED === "1" && !available).toBe(false);
	});

/**
 * Build a context of its own, with `extra` written over the tree, and report
 * how the build ended rather than throwing.
 *
 * For the cases that are *about* a build refusing: the shared image above
 * throws on a non-zero status, which is right when a build failing means the
 * suite cannot run and wrong when it is the assertion. Tagged rather than left
 * dangling so a build that unexpectedly succeeds replaces one image instead of
 * leaving one behind per run.
 */
export function buildWith(extra: Record<string, string>) {
	const dir = fabricate(extra);
	try {
		const build = Bun.spawnSync(
			["docker", "build", "-t", `${TAG}-probe`, dir],
			{ stdout: "pipe", stderr: "pipe", timeout: BUILD_MS },
		);
		if (build.exitedDueToTimeout)
			throw new Error(`docker build did not finish within ${BUILD_MS}ms`);
		return { exitCode: build.exitCode, stderr: build.stderr.toString() };
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

let built: string | undefined;

/**
 * The shared image, built on the first call and reused afterwards. Bun runs a
 * test run's files in one process, so every Docker-gated file in the run pays
 * for one build between them.
 */
export function image(): string {
	if (built) return built;
	const dir = fabricate();
	try {
		const build = Bun.spawnSync(["docker", "build", "-t", TAG, dir], {
			stdout: "pipe",
			stderr: "pipe",
			timeout: BUILD_MS,
		});
		if (build.exitedDueToTimeout)
			throw new Error(`docker build did not finish within ${BUILD_MS}ms`);
		if (build.exitCode !== 0)
			throw new Error(`docker build failed:\n${build.stderr.toString()}`);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
	built = TAG;
	return built;
}

/**
 * Build the shared image before this file's cases run, so the first case is
 * not the one that pays for it and times out.
 */
export const buildsImage = () =>
	beforeAll(() => {
		if (available) image();
		// A cold build installs twice from the registry and bundles the app.
	}, 900_000);

/**
 * Run `script` under `sh` in the image, replacing whatever it would have run.
 *
 * A run that timed out throws rather than being returned. Bun reports one as
 * `exitCode: null`, which every caller comparing against `0` reads as an
 * ordinary failure — and for `holds` below that means a container which never
 * answered is indistinguishable from a path the image does not have. Raised
 * here rather than at each call site, which is where all of them route.
 */
export function sh(script: string, ...opts: string[]) {
	const run = Bun.spawnSync(
		[
			"docker",
			"run",
			"--rm",
			...opts,
			"--entrypoint",
			"sh",
			image(),
			"-c",
			script,
		],
		{ stdout: "pipe", stderr: "pipe", timeout: RUN_MS },
	);
	if (run.exitedDueToTimeout)
		throw new Error(`docker run did not finish within ${RUN_MS}ms: ${script}`);
	return run;
}

/**
 * Run a docker command for its effect alone, and do nothing where there is no
 * daemon to run it against.
 *
 * For teardown, which is the one place a suite touches docker outside its own
 * cases: a `beforeAll` or `afterAll` sits at the top level of its file and runs
 * whether or not the cases under it were skipped, so an unguarded `docker` on
 * a machine that has none throws — and the file fails for want of the daemon
 * the skip existed to tolerate. Failures are swallowed for the same reason a
 * cleanup's are: it runs on the way out of a suite that has already reported.
 */
export const tidy = (...argv: string[]) => {
	if (!available) return;
	Bun.spawnSync(["docker", ...argv], {
		stdout: "ignore",
		stderr: "ignore",
		timeout: RUN_MS,
	});
};

let workdir: string | undefined;

/**
 * The image's own `WORKDIR`, which is where everything the context sent ends
 * up and what every path below is written from.
 *
 * Read off the built image rather than written here, because the failure of
 * restating it is silent and total: `WORKDIR` moves, every `holds` call asks
 * about a path no image has, and each one answers `false` — which is what the
 * exclusion cases are asserting, so the whole suite passes having checked
 * nothing.
 */
export function app(): string {
	if (workdir) return workdir;
	const read = Bun.spawnSync(
		[
			"docker",
			"image",
			"inspect",
			"--format",
			"{{.Config.WorkingDir}}",
			image(),
		],
		{ stdout: "pipe", stderr: "pipe", timeout: PROBE_MS },
	);
	const found = read.stdout.toString().trim();
	if (read.exitCode !== 0 || found === "")
		throw new Error(
			`the image declares no WORKDIR:\n${read.stderr.toString()}`,
		);
	workdir = found;
	return workdir;
}

/** Whether the image holds `path`, of any kind. */
export const holds = (path: string) => sh(`test -e '${path}'`).exitCode === 0;
