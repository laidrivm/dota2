import { afterAll, describe, expect, test } from "bun:test";
import {
	appendFileSync,
	cpSync,
	mkdtempSync,
	readdirSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CORE, drift, sync } from "harness/bun/sync.ts";
import { root } from "./root.ts";

/**
 * The tracked copy of the harness rules, checked through the installed
 * package's own drift check: over this tree, and over consumers fabricated to
 * be in step, edited by hand, or left behind by a pin bump.
 */

const made: string[] = [];
afterAll(() => {
	for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

const scratch = () => {
	const dir = mkdtempSync(join(tmpdir(), "harness-copy-"));
	made.push(dir);
	return dir;
};

/** A consumer whose `harness/` was written by the package's own sync. */
function synced(): string {
	const copy = join(scratch(), "harness");
	sync(CORE, copy);
	return copy;
}

/** The rulebook and docs the installed package ships. */
const shipped = () => readdirSync(CORE).filter((name) => name.endsWith(".md"));

describe("the copy of the harness rules", () => {
	// spec: harness-consumption/a-copy-in-step-with-the-pin
	test("this tree's copy matches the pinned package", () => {
		expect(drift(CORE, join(root, "harness"))).toEqual([]);
	});

	// spec: harness-consumption/a-copy-in-step-with-the-pin
	test("a copy the package's sync wrote passes", () => {
		expect(drift(CORE, synced())).toEqual([]);
	});

	// spec: harness-consumption/a-copy-edited-by-hand
	test("a byte edited in the copy names that file alone", () => {
		const copy = synced();
		appendFileSync(join(copy, "rules.md"), " ");
		expect(drift(CORE, copy)).toEqual([
			expect.stringContaining("harness/rules.md: differs"),
		]);
	});

	// spec: harness-consumption/a-pin-bumped-without-refreshing-the-copy
	test("a pin whose every file changed names every file of the stale copy", () => {
		const copy = synced();
		const bumped = join(scratch(), "core");
		cpSync(CORE, bumped, { recursive: true });
		for (const name of shipped()) appendFileSync(join(bumped, name), "\n");
		const named = drift(bumped, copy).join("\n");
		for (const name of shipped())
			expect(named).toContain(`harness/${name}: differs`);
	});
});
