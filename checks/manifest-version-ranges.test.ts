/**
 * This repository's manifest, read against the rule in
 * `scripts/manifest-ranges.ts`. What that rule makes of a manifest generally
 * is its own test's; this is the one manifest that ships.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ranges } from "../scripts/manifest-ranges.ts";
import { root } from "./root.ts";

test("this repository's manifest names one version everywhere", () => {
	const real = readFileSync(join(root, "package.json"), "utf8");

	expect(ranges(real)).toEqual([]);
});
