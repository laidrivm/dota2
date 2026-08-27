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
import {
	copyFileSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** The repository root: this file reads artefacts of it, from `checks/`. */
const root = join(import.meta.dir, "..");

/** The tag the shared image is built under. */
const TAG = "d2ass-checks:context";

/**
 * A value planted in the fabricated `.env` and searched for in the image. The
 * requirement is that no *value* from the file reaches the image, which a
 * check for the file's own name does not answer.
 *
 * Assembled rather than written whole, and not a stylistic choice: this file
 * is itself in the build context, so a literal here is a copy of the sentinel
 * inside the image — which the search then finds, failing the case on its own
 * source rather than on a leak.
 */
export const SECRET = ["d2ass", "check", "secret", "3f9a1c"].join("-");

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
 * Files no clone carries and every developer's checkout does, planted so the
 * `.dockerignore` has something to exclude. A directory nobody planted is a
 * directory the image trivially does not hold.
 */
const PLANTED: Record<string, string> = {
	// A `.git` directory: the whole history, on a machine where the image is
	// world-readable.
	".git/HEAD": "ref: refs/heads/main\n",
	".env": `STRATZ_API_KEY=${SECRET}\n`,
	// The host's install, marked so it can be told from the one the production
	// stage performs — the two are otherwise the same directory name.
	"node_modules/.host-copy": SECRET,
	// A bundle from the developer's own build. `COPY --from` merges into a
	// directory rather than replacing it, so one sent in the context would
	// survive beside the fresh one the build stage produced.
	"dist/stale.js": "console.log('a previous build');\n",
	// The two runtime directories. The job writes both and the server reads
	// both, and the image has to hold them empty: a file shipped at either
	// path is a second source for what the server answers from its listing,
	// one that survives every export.
	"snapshot/snapshot.json": '{"shipped":true}\n',
	"icons/1.png": "not really a png\n",
	"test-results/.last-run.json": "{}\n",
	"playwright-report/index.html": "<!doctype html>\n",
	"reports/mutation/index.html": "<!doctype html>\n",
	".stryker-tmp/sandbox/copy.ts": "export {};\n",
};

/**
 * A build context: every file the working tree holds and `.gitignore` does not
 * cover, plus `PLANTED`.
 *
 * `--others` beside `--cached`, so a `Dockerfile` written and not yet committed
 * is the one built — tracked files alone silently build the previous commit's
 * and report on it. `--exclude-standard` then leaves out exactly what
 * `PLANTED` supplies deliberately, so no gitignored file arrives twice.
 */
function fabricate(extra: Record<string, string> = {}): string {
	const dir = mkdtempSync(join(tmpdir(), "d2ass-context-"));
	const ls = Bun.spawnSync(
		["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
		{ cwd: root },
	);
	if (ls.exitCode !== 0) throw new Error(ls.stderr.toString());

	// `-z` terminates rather than separates, so the last field is empty.
	for (const path of ls.stdout.toString().split("\0").filter(Boolean)) {
		// Regular files only: git also lists a path deleted from the work tree,
		// a symlink and a submodule's gitlink, and none of the three is a file
		// a `COPY .` would send.
		if (!lstatSync(join(root, path), { throwIfNoEntry: false })?.isFile())
			continue;
		const target = join(dir, path);
		mkdirSync(dirname(target), { recursive: true });
		copyFileSync(join(root, path), target);
	}

	for (const [path, body] of Object.entries({ ...PLANTED, ...extra })) {
		const target = join(dir, path);
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, body);
	}
	return dir;
}

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
