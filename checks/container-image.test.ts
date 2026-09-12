/**
 * The image's pins, read from the two files that carry them: every base image
 * named by digest in the `Dockerfile`, and a Dependabot entry that raises those
 * digests.
 *
 * Both halves or neither, which is why one check reads both files. A tag is
 * mutable, so a rebuild of an unchanged commit can produce a different image;
 * a digest nobody updates is a pin that freezes rather than a pin that is
 * maintained, and a stale digest reads exactly like a fresh one. The second
 * half is an absence, and absences are what review misses.
 *
 * Both are asserted against the shipped files rather than against fabricated
 * ones put through a rule this file writes. The rule was the reason the
 * fabrications existed; without it there is nothing for them to exercise.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The repository root: this file reads artefacts of it, from `checks/`. */
const root = join(import.meta.dir, "..");

/**
 * A digest reference, anchored at both ends: a guard matching a prefix would
 * pass `oven/bun:1.3@sha256:beef` on four hex characters, and one matching a
 * suffix would pass a line with a second image after the digest.
 */
const DIGEST = /^[^\s@]+@sha256:[0-9a-f]{64}$/;

/** One `updates:` entry of `.github/dependabot.yml`, as much as is read here. */
type Entry = {
	"package-ecosystem"?: string;
	directory?: string;
	schedule?: unknown;
	cooldown?: unknown;
	groups?: Record<string, unknown>;
};

const dockerfile = readFileSync(`${root}/Dockerfile`, "utf8");

/**
 * Every `FROM` line with the image it names, carrying the stages declared
 * before it: a later `FROM build` names an earlier stage rather than an
 * unpinned registry image, and resolving against the stages declared *before*
 * the line is what leaves `FROM foo AS foo` the unpinned image it looks like.
 *
 * Any `--platform=…`-style flag before the image, and an `AS <name>` after it.
 * Case-insensitive, `from` being as valid to the builder as `FROM`.
 */
const froms = (() => {
	const stages = new Set<string>();
	const found: { line: string; image: string; isStage: boolean }[] = [];
	for (const line of dockerfile.split(/\r\n|\n|\r/)) {
		const from = /^\s*FROM\s+(?:--\S+\s+)*(\S+)(?:\s+AS\s+(\S+))?/i.exec(line);
		if (!from) continue;
		const [, image = "", stage] = from;
		found.push({
			line: line.trim(),
			image,
			isStage: stages.has(image.toLowerCase()),
		});
		if (stage) stages.add(stage.toLowerCase());
	}
	return found;
})();

// spec: container-image/a-base-image-referenced-by-tag
describe("every base image is pinned by digest", () => {
	// Guards the cases below: a file with no `FROM` line satisfies all of them,
	// and builds nothing.
	test("the Dockerfile declares the stages these cases are about", () => {
		expect(froms.map((from) => from.line)).toHaveLength(2);
	});

	test.each(froms)("$line", ({ image, isStage }) => {
		if (isStage) return;
		expect(image).toMatch(DIGEST);
	});
});

const updates =
	(
		Bun.YAML.parse(readFileSync(`${root}/.github/dependabot.yml`, "utf8")) as {
			updates?: Entry[];
		} | null
	)?.updates ?? [];

const docker = updates.filter((e) => e["package-ecosystem"] === "docker");
const others = updates.filter((e) => e["package-ecosystem"] !== "docker");

// spec: container-image/a-digest-with-no-updater
test("a `docker` ecosystem entry raises the digests above", () => {
	expect(docker).toHaveLength(1);
	// Guards the comparison below, which has nothing to compare against on a
	// file holding the docker entry alone.
	expect(others.length).toBeGreaterThan(0);
});

// spec: container-image/an-entry-naming-another-directory
test("it names the directory the Dockerfile sits in", () => {
	expect(docker[0]?.directory).toBe("/");
});

/**
 * Compared against the other entries rather than against a copy of the terms
 * written here: the file is where they are decided, and a second copy is a
 * second thing to keep current. `Bun.deepEquals` rather than two
 * `JSON.stringify` calls, which disagree on key order.
 */
// spec: container-image/an-entry-on-terms-of-its-own
describe("it is on the same terms as every other entry", () => {
	test.each(["schedule", "cooldown"] as const)(
		"its %s matches theirs",
		(key) => {
			for (const other of others)
				expect(Bun.deepEquals(docker[0]?.[key], other[key])).toBe(true);
		},
	);

	// Every entry in the file groups its updates, so one that does not is
	// opting into a pull request per image rather than following the file.
	test("it groups its updates", () => {
		expect(Object.keys(docker[0]?.groups ?? {}).length).toBeGreaterThan(0);
	});
});

// spec: container-image/the-repository-as-it-stands
test("the two files agree: every digest here is one that entry raises", () => {
	const pinned = froms.filter((from) => !from.isStage);
	expect(pinned.length).toBeGreaterThan(0);
	for (const from of pinned) expect(from.image).toMatch(DIGEST);
	expect(docker).toHaveLength(1);
});
