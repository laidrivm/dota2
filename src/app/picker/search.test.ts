import { describe, expect, test } from "bun:test";
import {
	EMPTY_SESSION,
	type Session,
	type SnapshotBundle,
} from "../../types.ts";
import { isUsed } from "../session.ts";
import { firstSelectable, matchHeroes } from "./search.ts";

const bundle = (await Bun.file(
	new URL("../../fixtures/snapshot.json", import.meta.url),
).json()) as SnapshotBundle;

const heroes = bundle.heroes;

const names = (query: string) =>
	matchHeroes(heroes, query).map((hero) => hero.name);

describe("an empty query", () => {
	test("keeps every hero, in ascending name order", () => {
		const all = names("");

		expect(all).toHaveLength(heroes.length);
		expect(all).toEqual([...all].sort((a, b) => a.localeCompare(b, "en")));
		expect(all).not.toEqual(heroes.map((hero) => hero.name));
	});

	test("is what whitespace alone amounts to", () => {
		expect(names("   ")).toEqual(names(""));
	});
});

describe("matching", () => {
	test.each([
		["cli", "Clinkz"],
		["bone", "Clinkz"],
		["wk", "Wraith King"],
		["king", "Wraith King"],
		["mage", "Anti-Mage"],
		["WK", "Wraith King"],
		["  wk  ", "Wraith King"],
	])("%p reaches %p", (query, expected) => {
		expect(names(query)).toContain(expected);
	});

	test("a query is a prefix of a word, never a substring of one", () => {
		expect(names("ing")).toEqual([]);
	});

	test("a query longer than the name it starts matches nothing", () => {
		expect(names("clinkzz")).toEqual([]);
	});

	test.each([".", "*", "(", "[a-z]"])(
		"%p is matched literally and does not throw",
		(query) => {
			expect(names(query)).toEqual([]);
		},
	);

	test("several heroes match through different routes, still in name order", () => {
		// Enigma through the alias `nigma`, Night Stalker through its name.
		expect(names("ni")).toEqual(["Enigma", "Night Stalker"]);
	});

	test("a hero with no aliases is matched by its name alone", () => {
		expect(names("larg")).toEqual(["Largo"]);
	});
});

describe("what Enter takes", () => {
	const named = (name: string) => {
		const hero = heroes.find((entry) => entry.name === name);
		if (hero === undefined) throw new Error(`${name} is not in the fixture`);
		return hero.id;
	};
	const taken = (session: Session) => (hero: number) => isUsed(session, hero);

	test("is the first match on an untouched draft", () => {
		const matches = matchHeroes(heroes, "cl");

		expect(matches.map((hero) => hero.name)).toEqual(["Clinkz", "Clockwerk"]);
		expect(firstSelectable(matches, taken(EMPTY_SESSION()))?.name).toBe(
			"Clinkz",
		);
	});

	test("skips a hero already on the board", () => {
		const session: Session = { ...EMPTY_SESSION(), bans: [named("Clinkz")] };

		expect(
			firstSelectable(matchHeroes(heroes, "cl"), taken(session))?.name,
		).toBe("Clockwerk");
	});

	test("is nothing when every match is taken", () => {
		const session: Session = {
			...EMPTY_SESSION(),
			bans: [named("Clinkz")],
			enemyPicks: [named("Clockwerk")],
		};

		expect(
			firstSelectable(matchHeroes(heroes, "cl"), taken(session)),
		).toBeUndefined();
	});

	test("is nothing when the query matches nothing", () => {
		expect(
			firstSelectable(matchHeroes(heroes, "zzz"), taken(EMPTY_SESSION())),
		).toBeUndefined();
	});
});
