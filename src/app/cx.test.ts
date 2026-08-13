import { describe, expect, test } from "bun:test";
import { cx } from "./cx.ts";

describe("joining the class names a module hands back", () => {
	test("a name the stylesheet does not carry leaves nothing behind", () => {
		expect(cx(undefined, undefined)).toBe("");
	});

	test("names keep the order they were given", () => {
		expect(cx("tile", "tileLg")).toBe("tile tileLg");
	});

	// The reason the helper exists: a plain join writes "tile  tileLg", and a
	// template literal writes "tile undefined tileLg".
	test("an absent name between two present ones leaves no gap", () => {
		expect(cx("tile", undefined, "tileLg")).toBe("tile tileLg");
	});
});
