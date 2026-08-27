/**
 * What the build context sends and what the image is therefore allowed to
 * hold, read off a real image built from a context holding every file a
 * developer's checkout has and a clone does not.
 *
 * Read off the image rather than off `.dockerignore`, because the two are not
 * the same statement: the `Dockerfile` copies the tree, so a pattern that
 * looks right and matches nothing leaves the file shipping while the file it
 * was written in reads correct.
 */
import { describe, expect, test } from "bun:test";
import {
	available,
	buildsImage,
	holds,
	requiresDocker,
	SECRET,
	sh,
} from "./docker.fixture.ts";

requiresDocker();

/** Where the image's `WORKDIR` puts everything the context sent. */
const app = "/app";

describe.skipIf(!available)("the build context", () => {
	buildsImage();

	// spec: container-image/the-version-control-directory
	test("the image holds no .git", () => {
		expect(holds(`${app}/.git`)).toBe(false);
	});

	// The last argument is a timeout: the search below reads every file the
	// image holds, `node_modules` included, which is well past the default one
	// on a cold page cache.
	//
	// spec: container-image/a-local-environment-file
	test("a .env in the context reaches neither the image nor its files", () => {
		// Three places, because the requirement is that no *value* from the
		// file reaches the image and the file's own name answers for only one
		// of them: excluded by name, absent from every file the image holds,
		// and absent from the environment the image declares — a value read
		// into an `ENV` sits in none of the files and leaks all the same.
		expect(holds(`${app}/.env`)).toBe(false);
		const grep = sh(`grep -rl '${SECRET}' ${app} 2>/dev/null; true`);
		expect(grep.stdout.toString().trim()).toBe("");
		expect(sh("env").stdout.toString()).not.toContain(SECRET);
	}, 60_000);

	// spec: container-image/the-committed-example-file
	test("the image holds no .env.example", () => {
		expect(holds(`${app}/.env.example`)).toBe(false);
	});

	// spec: container-image/the-host-s-installed-modules
	test("the image's node_modules is the production install", () => {
		// The directory has to be there for its absence of the marker to mean
		// anything: an image with no `node_modules` at all passes the second
		// assertion and runs nothing.
		expect(holds(`${app}/node_modules`)).toBe(true);
		expect(holds(`${app}/node_modules/.host-copy`)).toBe(false);
	});

	// spec: container-image/the-directories-no-run-reads
	describe("the directories no run reads", () => {
		test.each([
			".claude",
			"openspec",
			"test-results",
			"playwright-report",
			"reports",
			".stryker-tmp",
		])("the image holds no %s", (name) => {
			expect(holds(`${app}/${name}`)).toBe(false);
		});
	});
});
