/**
 * Every version in `package.json` names one version and not a set of them.
 *
 * `bunfig.toml`'s `[install] exact = true` states the policy and its reason —
 * a malicious release ships as a patch or minor bump, which a caret adopts
 * unread — but it governs only what `bun add` writes. A range typed into the
 * file by hand, or into `overrides`, which `bun add` never touches, passes
 * every gate this repository has. This is the gate it passes.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The repository root: this file reads artefacts of it, from `checks/`. */
const root = join(import.meta.dir, "..");

/**
 * The fields holding shell commands rather than version specs, which is the
 * whole of what this scan exempts. Everything else is walked, `overrides` and
 * any field added later alike — a scan scoped by a list of the collections it
 * covers is one a new collection is silently outside of, and a dependency
 * field nobody thought to add to that list is exactly where an unread range
 * would sit.
 */
const EXEMPT = new Set(["scripts", "simple-git-hooks"]);

/**
 * What makes a spec admit more than the one version it names: a caret or
 * tilde, a comparator, a disjunction, or a wildcard in a position a number
 * belongs in. Anchored where anchoring is what distinguishes them — a `<` in
 * the middle of a value is not a comparator, and an `x` inside a word is not a
 * wildcard.
 */
const RANGE = /^[\^~<>=]|\|\||(^|\.)[x*](\.|$)/i;

/** Every version in `manifest` that names a set, and an empty list when none. */
export function problems(manifest: string): string[] {
	const found: string[] = [];

	const walk = (value: unknown, path: string) => {
		if (typeof value === "string") {
			if (RANGE.test(value))
				found.push(`package.json: ${path} is ${value}, not one version`);
			return;
		}
		// `null` first: it is an object to `typeof`, and `Object.entries` throws
		// on it rather than returning nothing.
		if (value === null || typeof value !== "object") return;
		for (const [key, inner] of Object.entries(value))
			walk(inner, `${path}.${key}`);
	};

	const parsed = JSON.parse(manifest) as Record<string, unknown>;
	for (const [key, value] of Object.entries(parsed))
		if (!EXEMPT.has(key)) walk(value, key);

	return found;
}

/** A manifest holding `fields`, with the ones every real one carries. */
const manifest = (fields: Record<string, unknown>) =>
	JSON.stringify({ name: "d2ass", private: true, type: "module", ...fields });

describe("a version naming a set rather than a version", () => {
	test.each([
		["a caret", "^6.16.0"],
		["a tilde", "~6.16.0"],
		["a comparator", ">=6.16.0"],
		["a disjunction", "6.16.0 || 6.17.0"],
		["a minor wildcard", "6.x"],
		["a bare wildcard", "*"],
	])("%s is named, with the field it sits in", (_, spec) => {
		const found = problems(manifest({ dependencies: { qs: spec } }));

		expect(found).toEqual([
			`package.json: dependencies.qs is ${spec}, not one version`,
		]);
	});

	test("is reached inside a nested override", () => {
		// bun lets an override scope a version to one dependent, so the values
		// are not all at one depth — and the nested spelling is the one a scan
		// reading the top level alone would pass.
		const fields = { overrides: { ajv: { "fast-uri": "^3.1.6" } } };

		const found = problems(manifest(fields));

		expect(found).toEqual([
			"package.json: overrides.ajv.fast-uri is ^3.1.6, not one version",
		]);
	});

	test("is named once per version, not once per manifest", () => {
		// Every other case here asserts a one-element list, which a scan keeping
		// the last match rather than collecting them would satisfy.
		const fields = {
			dependencies: { qs: "^6.16.0" },
			overrides: { "fast-uri": "~3.1.7" },
		};

		const found = problems(manifest(fields));

		expect(found).toEqual([
			"package.json: dependencies.qs is ^6.16.0, not one version",
			"package.json: overrides.fast-uri is ~3.1.7, not one version",
		]);
	});

	test("is named in a field this scan was never told about", () => {
		// The property the exemption list buys: `peerDependencies` is nowhere in
		// this file, and a range in it is still caught.
		const found = problems(manifest({ peerDependencies: { preact: "^10" } }));

		expect(found).toEqual([
			"package.json: peerDependencies.preact is ^10, not one version",
		]);
	});
});

describe("a value this scan has nothing to say about", () => {
	test("an exact version passes", () => {
		const fields = { dependencies: { preact: "10.29.8" } };

		expect(problems(manifest(fields))).toEqual([]);
	});

	test("a command carrying an operator passes, being exempt", () => {
		// Every shell operator this rejects in a version is ordinary in a script,
		// which is why the two fields are exempt rather than parsed.
		const fields = {
			scripts: { lint: "biome ci . || exit 1", dev: "bun x.ts >/dev/null" },
			"simple-git-hooks": { "pre-push": "bun test && echo x" },
		};

		expect(problems(manifest(fields))).toEqual([]);
	});

	test("a null passes rather than ending the scan", () => {
		// `typeof null` is `"object"` and `Object.entries(null)` throws, so the
		// guard against it is the difference between a clean manifest and a
		// check that cannot report on one.
		const fields = { dependencies: { qs: null, preact: "^10.29.8" } };

		expect(problems(manifest(fields))).toEqual([
			"package.json: dependencies.preact is ^10.29.8, not one version",
		]);
	});

	test("a word carrying an x passes", () => {
		// `type` is not a version, and an unanchored wildcard would read one here.
		expect(problems(manifest({ dependencies: {} }))).toEqual([]);
	});
});

test("this repository's manifest names one version everywhere", () => {
	const real = readFileSync(join(root, "package.json"), "utf8");

	expect(problems(real)).toEqual([]);
});
