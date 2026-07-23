import { afterEach, describe, expect, test } from "bun:test";
import { read, write } from "./storage.ts";

/** Bun has no localStorage, so every test installs the one it needs. */
function install(fake: Partial<Storage> | undefined) {
	(globalThis as { localStorage?: unknown }).localStorage = fake;
}

function memoryStorage(): Partial<Storage> {
	const map = new Map<string, string>();
	return {
		getItem: (k) => map.get(k) ?? null,
		setItem: (k, v) => {
			map.set(k, v);
		},
	};
}

afterEach(() => install(undefined));

describe("storage wrapper", () => {
	test("round-trips a value", () => {
		install(memoryStorage());
		write("draft.session", '{"v":1}');
		expect(read("draft.session")).toBe('{"v":1}');
	});

	test("reads absent keys as null", () => {
		install(memoryStorage());
		expect(read("nothing.here")).toBeNull();
	});

	test("getItem throwing reads as absent", () => {
		install({
			getItem: () => {
				throw new DOMException("access denied", "SecurityError");
			},
			setItem: () => {},
		});
		expect(read("draft.session")).toBeNull();
	});

	test("setItem throwing on quota is swallowed", () => {
		install({
			getItem: () => null,
			setItem: () => {
				throw new DOMException("quota exceeded", "QuotaExceededError");
			},
		});
		expect(() => write("draft.session", "x")).not.toThrow();
	});

	test("a missing localStorage degrades instead of throwing", () => {
		install(undefined);
		expect(read("draft.session")).toBeNull();
		expect(() => write("draft.session", "x")).not.toThrow();
	});
});
