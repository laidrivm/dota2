/**
 * The CM page's setup and rosters as a value: what each edit leaves behind,
 * and what a stored copy that cannot be read falls back to.
 */
import { describe, expect, test } from "bun:test";
import {
	type CmSession,
	emptySession,
	parseSession,
	positionsComplete,
	reduce,
	SIGNATURE_LIMIT,
} from "./session.ts";

const start = () => emptySession();

describe("setup", () => {
	// spec: cm-draft/setup-collapses-into-the-board
	test("side and pick order are set independently", () => {
		const sided = reduce(start(), { type: "side", side: "dire" });
		expect(sided.side).toBe("dire");
		expect(sided.pickOrder).toBeNull();
		const both = reduce(sided, { type: "pickOrder", pickOrder: "first" });
		expect(both).toMatchObject({ side: "dire", pickOrder: "first" });
	});
});

describe("nicknames", () => {
	const named = (name: string) =>
		reduce(start(), { type: "nickname", team: "ours", index: 0, name });

	test("24 characters are kept", () => {
		expect(named("x".repeat(24)).ours[0]?.nickname).toBe("x".repeat(24));
	});

	test.each([
		["25 characters", "x".repeat(25)],
		["whitespace alone", "   "],
		["nothing", ""],
	])("%s are refused and the old name stays", (_, name) => {
		expect(named(name).ours[0]?.nickname).toBe(start().ours[0]?.nickname);
	});

	test("surrounding spaces are trimmed", () => {
		expect(named("  Puppey  ").ours[0]?.nickname).toBe("Puppey");
	});
});

describe("positions", () => {
	// spec: cm-draft/editing-the-captain-s-roster
	test.each(["ours", "theirs"] as const)(
		"a position given twice on %s unsets the first holder",
		(team) => {
			const first = reduce(start(), {
				type: "position",
				team,
				index: 0,
				position: 3,
			});
			const second = reduce(first, {
				type: "position",
				team,
				index: 1,
				position: 3,
			});
			expect(second[team][0]?.position).toBeNull();
			expect(second[team][1]?.position).toBe(3);
		},
	);

	// spec: cm-draft/editing-the-captain-s-roster
	test("the captain's roster is complete only with each position held once", () => {
		let session = start();
		expect(positionsComplete(session.ours)).toBe(false);
		for (const index of [0, 1, 2, 3, 4])
			session = reduce(session, {
				type: "position",
				team: "ours",
				index,
				position: (index + 1) as 1 | 2 | 3 | 4 | 5,
			});
		expect(positionsComplete(session.ours)).toBe(true);
		session = reduce(session, {
			type: "position",
			team: "ours",
			index: 4,
			position: null,
		});
		expect(positionsComplete(session.ours)).toBe(false);
	});
});

describe("signatures", () => {
	const add = (session: CmSession, hero: number) =>
		reduce(session, { type: "addSignature", team: "ours", index: 2, hero });

	// spec: cm-draft/editing-the-captain-s-roster
	test("the eleventh signature is refused", () => {
		let session = start();
		for (let hero = 1; hero <= SIGNATURE_LIMIT + 1; hero++)
			session = add(session, hero);
		expect(session.ours[2]?.signatures).toHaveLength(SIGNATURE_LIMIT);
		expect(SIGNATURE_LIMIT).toBe(10);
	});

	test("a hero already on the list is not added twice", () => {
		const session = add(add(start(), 7), 7);
		expect(session.ours[2]?.signatures).toEqual([7]);
	});

	test("a signature can be removed", () => {
		const session = reduce(add(add(start(), 7), 8), {
			type: "removeSignature",
			team: "ours",
			index: 2,
			hero: 7,
		});
		expect(session.ours[2]?.signatures).toEqual([8]);
	});

	test("the same hero may be a signature of players on both teams", () => {
		const ours = add(start(), 7);
		const both = reduce(ours, {
			type: "addSignature",
			team: "theirs",
			index: 0,
			hero: 7,
		});
		expect(both.theirs[0]?.signatures).toEqual([7]);
	});
});

describe("ranks", () => {
	test.each([0, 9, 2.5])("rank %p is refused", (rank) => {
		const session = reduce(start(), {
			type: "rank",
			team: "ours",
			index: 0,
			rank: rank as 1,
		});
		expect(session.ours[0]?.rank).toBeNull();
	});

	test("rank 8 is Immortal and kept", () => {
		const session = reduce(start(), {
			type: "rank",
			team: "ours",
			index: 0,
			rank: 8,
		});
		expect(session.ours[0]?.rank).toBe(8);
	});
});

describe("a stored session", () => {
	test("round-trips through JSON", () => {
		const session = reduce(start(), { type: "side", side: "radiant" });
		expect(parseSession(JSON.parse(JSON.stringify(session)))).toEqual(session);
	});

	test.each([
		["null", null],
		["a string", "draft"],
		["another version", { ...emptySession(), v: 2 }],
		["four players", { ...emptySession(), ours: emptySession().ours.slice(1) }],
		[
			"a bad position",
			{
				...emptySession(),
				ours: emptySession().ours.map((p) => ({ ...p, position: 6 })),
			},
		],
	])("that is %s falls back to empty", (_, stored) => {
		expect(parseSession(stored)).toEqual(emptySession());
	});
});
