/**
 * What a build context holds: every file the working tree carries, and the
 * ones a clone never does, planted so the `.dockerignore` has something to
 * exclude.
 *
 * Apart from `docker.fixture.ts`, which owns the daemon and the image built
 * from this. The split is the one the cap asked for and the one the concerns
 * suggest anyway: this file is a policy — the list of what a developer's
 * checkout really has — where that one is mechanism.
 *
 * The context is fabricated rather than borrowed for the case that matters
 * most. `.env` holds a real STRATZ key and a real database password on a real
 * machine, so a suite that planted one at the repository root to prove it is
 * excluded would be writing over it — and one that relied on the developer's
 * own would pass vacuously in CI, where there is none.
 */
import {
	copyFileSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

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

/** The repository root: this file reads artefacts of it, from `checks/`. */
const root = join(import.meta.dir, "..");

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
export function fabricate(extra: Record<string, string> = {}): string {
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
