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
 * Whether a daemon is reachable, not merely whether the client is installed:
 * `docker --version` answers on a machine whose daemon is stopped, and every
 * case here needs one that runs containers.
 */
export const available = (() => {
	try {
		return (
			Bun.spawnSync(["docker", "info"], {
				stdout: "ignore",
				stderr: "ignore",
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

/** `test` where a daemon is reachable, and `test.skip` where none is. */
export const dockerTest = available ? test : test.skip;

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
function fabricate(): string {
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

	for (const [path, body] of Object.entries(PLANTED)) {
		const target = join(dir, path);
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, body);
	}
	return dir;
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
		});
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

/** Run `script` under `sh` in the image, replacing whatever it would have run. */
export const sh = (script: string, ...opts: string[]) =>
	Bun.spawnSync(
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
		{ stdout: "pipe", stderr: "pipe" },
	);

/** Whether the image holds `path`, of any kind. */
export const holds = (path: string) => sh(`test -e '${path}'`).exitCode === 0;
