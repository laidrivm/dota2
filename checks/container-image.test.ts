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
 */
import { expect, test } from "bun:test";
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

/**
 * Everything wrong with the pair, and an empty list when nothing is.
 *
 * `dir` is where the `Dockerfile` sits, in the spelling Dependabot's
 * `directory` uses. It is a parameter because the mismatch is the failure
 * worth catching: an entry naming a directory holding no `Dockerfile` raises
 * nothing, and reads in the file exactly like one that raises everything.
 */
export function problems(
	dockerfile: string,
	dependabot: string,
	dir = "/",
): string[] {
	const found: string[] = [];

	// Stage names, so a later `FROM build` naming an earlier stage is not read
	// as an unpinned registry image. A stage is named before it can be referred
	// to and the scan runs in file order, so one pass carries them.
	const stages = new Set<string>();
	let froms = 0;
	for (const line of dockerfile.split(/\r\n|\n|\r/)) {
		// Any `--platform=…`-style flag before the image, and an `AS <name>`
		// after it. Case-insensitive, `from` being as valid to the builder as
		// `FROM`.
		const from = /^\s*FROM\s+(?:--\S+\s+)*(\S+)(?:\s+AS\s+(\S+))?/i.exec(line);
		if (!from) continue;
		froms++;
		// `image` cannot be absent — its group is not optional — but the match
		// type says it can, and a default costs less than asserting otherwise.
		const [, image = "", stage] = from;
		// The image is resolved against the stages declared *before* this line,
		// so `FROM foo AS foo` is the unpinned image it looks like.
		if (!stages.has(image.toLowerCase()) && !DIGEST.test(image))
			found.push(`Dockerfile: ${line.trim()}: no @sha256: digest`);
		if (stage) stages.add(stage.toLowerCase());
	}
	// Guards the guard: a file with no `FROM` line satisfies every assertion
	// above, and builds nothing.
	if (froms === 0) found.push("Dockerfile: no FROM line");

	const doc = Bun.YAML.parse(dependabot) as { updates?: Entry[] } | null;
	const updates = doc?.updates ?? [];
	const docker = updates.filter((e) => e["package-ecosystem"] === "docker");
	const others = updates.filter((e) => e["package-ecosystem"] !== "docker");

	if (docker.length === 0) {
		found.push(
			"dependabot: no `docker` ecosystem entry — the digests above are pins nothing raises",
		);
		return found;
	}

	for (const entry of docker) {
		if (entry.directory !== dir)
			found.push(
				`dependabot: the docker entry names ${JSON.stringify(entry.directory)}, and the Dockerfile sits in ${JSON.stringify(dir)}`,
			);
		// Every entry in the file groups its updates, so one that does not is
		// opting into a pull request per image rather than following the file.
		if (Object.keys(entry.groups ?? {}).length === 0)
			found.push("dependabot: the docker entry declares no group");
		// Compared against the other entries rather than against a copy of the
		// terms written here: the file is where they are decided, and a second
		// copy is a second thing to keep current. `Bun.deepEquals` rather than
		// two `JSON.stringify` calls, which disagree on key order.
		for (const key of ["schedule", "cooldown"] as const)
			for (const other of others)
				if (!Bun.deepEquals(entry[key], other[key]))
					found.push(
						`dependabot: the docker entry's ${key} differs from the ${other["package-ecosystem"]} entry's`,
					);
	}

	return found;
}

/** A `Dockerfile` this check has nothing to say about. */
const pinned = `FROM oven/bun:1.3.14-alpine@sha256:${"a".repeat(64)} AS build
FROM build AS production
`;

/** The terms every entry in the real file carries. */
const terms = {
	directory: "/",
	schedule: { interval: "weekly", day: "monday" },
	cooldown: { "default-days": 3 },
};

const bunEntry = {
	"package-ecosystem": "bun",
	...terms,
	groups: { dependencies: { "update-types": ["minor", "patch"] } },
};

const dockerEntry = (over: Partial<Entry> = {}) => ({
	"package-ecosystem": "docker",
	...terms,
	groups: { images: { patterns: ["*"] } },
	...over,
});

const file = (...updates: object[]) =>
	Bun.YAML.stringify({ version: 2, updates });

// spec: container-image/a-base-image-referenced-by-tag
test("a base image referenced by tag is named", () => {
	const found = problems(
		"FROM oven/bun:1.3.14-alpine AS build\n",
		file(bunEntry, dockerEntry()),
	);
	expect(found).toEqual([
		"Dockerfile: FROM oven/bun:1.3.14-alpine AS build: no @sha256: digest",
	]);
});

// spec: container-image/a-digest-with-no-updater
test("a digest-pinned Dockerfile no docker entry covers fails", () => {
	expect(problems(pinned, file(bunEntry))).toEqual([
		"dependabot: no `docker` ecosystem entry — the digests above are pins nothing raises",
	]);
});

// spec: container-image/an-entry-naming-another-directory
test("an entry naming a directory the Dockerfile does not sit in fails", () => {
	const found = problems(
		pinned,
		file(bunEntry, dockerEntry({ directory: "/docker" })),
	);
	expect(found).toEqual([
		'dependabot: the docker entry names "/docker", and the Dockerfile sits in "/"',
	]);
});

// spec: container-image/an-entry-on-terms-of-its-own
test.each([
	[
		"schedule",
		{ schedule: { interval: "daily" } },
		"dependabot: the docker entry's schedule differs from the bun entry's",
	],
	[
		"cooldown",
		{ cooldown: { "default-days": 0 } },
		"dependabot: the docker entry's cooldown differs from the bun entry's",
	],
	[
		"grouping",
		{ groups: {} },
		"dependabot: the docker entry declares no group",
	],
])("a docker entry on its own %s fails", (_what, over, message) => {
	expect(problems(pinned, file(bunEntry, dockerEntry(over)))).toEqual([
		message,
	]);
});

// spec: container-image/the-repository-as-it-stands
test("this repository passes", () => {
	expect(
		problems(
			readFileSync(`${root}/Dockerfile`, "utf8"),
			readFileSync(`${root}/.github/dependabot.yml`, "utf8"),
		),
	).toEqual([]);
});
