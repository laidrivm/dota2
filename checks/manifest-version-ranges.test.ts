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
 * Every way a spec names more than the one version it appears to: a widening
 * operator or comparator, a disjunction, a wildcard, a partial version — `6`
 * is every 6 and `6.16` every 6.16, which is the form that reads least like a
 * range and is the widest of them — and a hyphen span.
 *
 * Written as what a range is rather than as what a version is, because the
 * scan walks every field and most of them hold neither: `"module"`, `"d2ass"`
 * and `"./index.x.ts"` all have to pass, and a pattern asking what a version
 * looks like has to tell them apart from one. The cost is that a date would
 * read as a span; no field here holds one, and the report names the field.
 */
const RANGE =
	/^[\^~<>=]|\|\||^[x*]$|^\d+(\.\d+)?$|^\d+(\.\d+)*\.[x*]$|^\d[\d.]*\s*-\s*\d/i;

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

/**
 * A manifest holding `fields`, with the ones every real one carries — this
 * repository's own name among them, which carries a digit and so is what every
 * case below also asserts is not read as a version.
 */
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
		["a hyphen span", "6.16.0 - 6.17.0"],
		["a major on its own", "6"],
		["a major and minor", "6.16"],
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
	test.each(["10.29.8", "1.2.3-beta.1", "1.2.3+build.5"])(
		"the exact version %s passes",
		(spec) => {
			// A prerelease is still one version, and it carries the hyphen a span
			// is written with — which is why the span is recognised by the digit
			// after that hyphen rather than by the hyphen alone.
			expect(problems(manifest({ dependencies: { qs: spec } }))).toEqual([]);
		},
	);

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

	test("a path carrying an x segment passes", () => {
		// Not every field this scan walks holds a version, and a wildcard read
		// wherever a dot precedes an `x` would refuse this one.
		const fields = {
			main: "./index.x.ts",
			dependencies: { preact: "10.29.8" },
		};

		expect(problems(manifest(fields))).toEqual([]);
	});
});

test("this repository's manifest names one version everywhere", () => {
	const real = readFileSync(join(root, "package.json"), "utf8");

	expect(problems(real)).toEqual([]);
});
