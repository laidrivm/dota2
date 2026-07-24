import { describe, expect, test } from "bun:test";
import {
	EMPTY_SESSION,
	type Session,
	type SnapshotBundle,
} from "../../types.ts";
import { availableHeroes } from "./board.tsx";

const bundle = (await Bun.file(
	new URL("../../fixtures/snapshot.json", import.meta.url),
).json()) as SnapshotBundle;

const named = (name: string) => {
	const hero = bundle.heroes.find((entry) => entry.name === name);
	if (hero === undefined) throw new Error(`${name} is not in the fixture`);
	return hero.id;
};

describe("the pick-entry candidate list", () => {
	test("offers every hero of an untouched draft", () => {
		expect(availableHeroes(bundle, EMPTY_SESSION())).toHaveLength(
			bundle.heroes.length,
		);
	});

	test("is ordered by name, not by the snapshot's own order", () => {
		const names = availableHeroes(bundle, EMPTY_SESSION()).map((h) => h.name);
		expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
		expect(names).not.toEqual(bundle.heroes.map((h) => h.name));
	});

	test.each([
		["banned", (id: number): Partial<Session> => ({ bans: [id] })],
		[
			"picked by my team",
			(id: number): Partial<Session> => ({
				teamPicks: { "1": null, "2": id, "3": null, "4": null, "5": null },
			}),
		],
		[
			"picked by the enemy",
			(id: number): Partial<Session> => ({ enemyPicks: [id] }),
		],
	])("drops a hero that is %s", (_label, place) => {
		const zeus = named("Zeus");
		const session = { ...EMPTY_SESSION(), ...place(zeus) };

		const offered = availableHeroes(bundle, session);

		expect(offered.map((hero) => hero.id)).not.toContain(zeus);
		expect(offered).toHaveLength(bundle.heroes.length - 1);
	});

	test("returns a hero as soon as its ban is lifted", () => {
		const zeus = named("Zeus");
		const banned = { ...EMPTY_SESSION(), bans: [zeus] };
		const lifted = { ...banned, bans: [] };

		expect(availableHeroes(bundle, lifted).map((h) => h.id)).toContain(zeus);
	});
});
