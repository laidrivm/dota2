/**
 * What `ranges` reads as a set of versions and what it lets through.
 *
 * The manifests below are fabricated because the rule is: it answers for a
 * field this repository does not carry yet, and a case that could not have
 * come out the other way proves nothing about it. What the repository's own
 * manifest says is `checks/manifest-version-ranges.test.ts`'s.
 */
import { describe, expect, test } from "bun:test";
import { ranges } from "./manifest-ranges.ts";

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
		const found = ranges(manifest({ dependencies: { qs: spec } }));

		expect(found).toEqual([
			`package.json: dependencies.qs is ${spec}, not one version`,
		]);
	});

	test("is reached inside a nested override", () => {
		// bun lets an override scope a version to one dependent, so the values
		// are not all at one depth — and the nested spelling is the one a scan
		// reading the top level alone would pass.
		const fields = { overrides: { ajv: { "fast-uri": "^3.1.6" } } };

		const found = ranges(manifest(fields));

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

		const found = ranges(manifest(fields));

		expect(found).toEqual([
			"package.json: dependencies.qs is ^6.16.0, not one version",
			"package.json: overrides.fast-uri is ~3.1.7, not one version",
		]);
	});

	test("is named in a field this scan was never told about", () => {
		// The property the exemption list buys: `peerDependencies` is nowhere in
		// this file, and a range in it is still caught.
		const found = ranges(manifest({ peerDependencies: { preact: "^10" } }));

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
			expect(ranges(manifest({ dependencies: { qs: spec } }))).toEqual([]);
		},
	);

	test("a command carrying an operator passes, being exempt", () => {
		// Every shell operator this rejects in a version is ordinary in a script,
		// which is why the two fields are exempt rather than parsed.
		const fields = {
			scripts: { lint: "biome ci . || exit 1", dev: "bun x.ts >/dev/null" },
			"simple-git-hooks": { "pre-push": "bun test && echo x" },
		};

		expect(ranges(manifest(fields))).toEqual([]);
	});

	test("a null passes rather than ending the scan", () => {
		// `typeof null` is `"object"` and `Object.entries(null)` throws, so the
		// guard against it is the difference between a clean manifest and a
		// check that cannot report on one.
		const fields = { dependencies: { qs: null, preact: "^10.29.8" } };

		expect(ranges(manifest(fields))).toEqual([
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

		expect(ranges(manifest(fields))).toEqual([]);
	});
});
