/**
 * Whether what the export renders is what the client accepts, and whether it
 * refuses what the client would have taken.
 *
 * Both halves are read against `isBundle` itself rather than a description of
 * it: a second copy of that check here would agree with the client's exactly
 * until it drifted, which is the one failure a copy has and a reference does
 * not. The first block edits the shipped fixture and needs no database; the
 * second renders a real build and skips without one.
 *
 * What the check accepts and refuses about keys alone is `contract.test.ts`'s.
 */
import { describe, expect, test } from "bun:test";
import { isBundle } from "../../app/snapshot.ts";
import type { SnapshotBundle } from "../../types.ts";
import { BUILT_AT, NEW_PATCH, seeded, stage } from "../build/build.fixture.ts";
import { buildSnapshot } from "../build/build.ts";
import { cleaner, requiresDatabase, url } from "../db.fixture.ts";
import { edited, refusal } from "./contract.fixture.ts";
import { renderBundle } from "./render.ts";

requiresDatabase();

const clean = cleaner();

/**
 * The first hero of a copy, at the types every edit below reaches through.
 *
 * Unguarded on purpose: the fixture holds heroes — `contract.test.ts` asserts
 * the shipped file passes the check whole, and the check refuses an empty
 * list — so a guard here would be a branch no case can take.
 */
const hero = (bundle: SnapshotBundle) =>
	bundle.heroes[0] as unknown as Record<string, unknown> & {
		side: Record<string, unknown>;
		phase: Record<string, unknown>;
		positions: Record<string, Record<string, unknown>>;
	};

/**
 * The first row of a matrix, or a loose object where the fixture holds none.
 *
 * The fallback is deliberately *not* attached to the matrix. Writing an edit
 * into a row nothing holds leaves the copy unedited, the check then accepts
 * it, and the case fails on a refusal it never got — which is the answer a
 * fixture that stopped carrying matrices deserves. Attaching it instead would
 * manufacture the structure the case exists to read, and pass.
 */
const row = (matrix: Record<string, Record<string, number>>) =>
	Object.values(matrix)[0] ?? {};

describe("what the export refuses and the client would not", () => {
	// spec: snapshot-export/a-hero-entry-missing-a-field-the-client-never-checks
	test("a hero entry missing a field the client never reads fails [49]", () => {
		// The client's validation stops at the hero's identity, so each of
		// these reaches `src/model.ts` as `undefined` and leaves it computing
		// `NaN` — which is the whole reason the export asserts more than the
		// consumer does.
		for (const field of ["side", "phase", "contest", "sufficient"]) {
			const bundle = edited((copy) => {
				delete hero(copy)[field];
			});
			expect([field, refusal(bundle)]).toEqual([
				field,
				`heroes[0]'s key ${field} is declared and missing`,
			]);
			// The half that makes the case worth writing: what the export
			// refused is a payload the client would have taken and rendered.
			expect([field, isBundle(bundle)]).toEqual([field, true]);
		}
	});

	// spec: snapshot-export/a-field-of-the-wrong-type
	test("a field holding its number as a string fails [52]", () => {
		const bundle = edited((copy) => {
			hero(copy).contest = "0.13";
		});

		// The key is present and spelled as the contract declares it, so
		// nothing about the keys can refuse this — only what it holds. And
		// `"0.13"` compares as neither greater nor less than a threshold, so
		// the model would carry it silently.
		expect(refusal(bundle)).toBe(
			"heroes[0]'s key contest does not hold the declared type",
		);
		expect(isBundle(bundle)).toBe(true);
	});

	// spec: snapshot-export/a-field-of-the-wrong-type
	test("a value of the wrong type fails at each kind the contract declares [95]", () => {
		// One case per declared kind, because the case above reaches only the
		// number: measured by weakening each predicate in turn, every one of
		// these but that first left the whole suite passing.
		const places: [string, (bundle: SnapshotBundle) => void][] = [
			[
				"a declared string",
				(bundle) => {
					(bundle as unknown as Record<string, unknown>).createdAt = 20260714;
				},
			],
			[
				"a declared boolean",
				(bundle) => {
					(bundle as unknown as Record<string, unknown>).stabilizing = "false";
				},
			],
			[
				"a declared list of strings",
				(bundle) => {
					hero(bundle).aliases = [7];
				},
			],
			[
				"a declared object rendered as a list",
				(bundle) => {
					hero(bundle).side = [] as unknown as Record<string, unknown>;
				},
			],
			[
				"a matrix row rendered as a number",
				(bundle) => {
					const [first] = Object.keys(bundle.matchups);
					if (first !== undefined)
						bundle.matchups[first] = 5 as unknown as Record<string, number>;
				},
			],
		];
		for (const [where, edit] of places) {
			const said = refusal(edited(edit)) ?? "";
			expect([where, said.includes("does not hold the declared type")]).toEqual(
				[where, true],
			);
		}
	});

	// spec: snapshot-export/the-client-s-own-check
	test("a bundle carrying no heroes at all fails [94]", () => {
		const bundle = edited((copy) => {
			copy.heroes = [];
		});

		// The one refusal here the client also makes: a hero list with nothing
		// in it is a bundle nothing can be suggested from, and the export fails
		// on it rather than publishing a payload the client would reject.
		expect(refusal(bundle)).toBe(
			"the bundle's key heroes does not hold the declared type",
		);
		expect(isBundle(bundle)).toBe(false);
	});

	// spec: snapshot-export/a-number-that-is-not-finite
	test("a numeric leaf that is not a finite number fails [54]", () => {
		// Every place a number is read, and all four values spread between
		// them: `NaN` and the infinities are numbers to `typeof`, and `null` is
		// what a column nothing filled arrives as.
		const places: [string, (bundle: SnapshotBundle) => void][] = [
			[
				"the bundle's own id",
				(bundle) => {
					(bundle as unknown as Record<string, unknown>).snapshotId =
						Number.NaN;
				},
			],
			[
				"a hero's contest",
				(bundle) => {
					hero(bundle).contest = Number.POSITIVE_INFINITY;
				},
			],
			[
				"a hero's side",
				(bundle) => {
					hero(bundle).side.radiant = Number.NEGATIVE_INFINITY;
				},
			],
			[
				"a hero's phase",
				(bundle) => {
					hero(bundle).phase.p1 = null;
				},
			],
			[
				"a position's delta",
				(bundle) => {
					const [first] = Object.values(hero(bundle).positions);
					if (first !== undefined) first.meta = Number.NaN;
				},
			],
			[
				"a matchup's leaf",
				(bundle) => {
					row(bundle.matchups)["9999"] = Number.POSITIVE_INFINITY;
				},
			],
			[
				"a synergy's leaf",
				(bundle) => {
					row(bundle.synergies)["9999"] = null as unknown as number;
				},
			],
		];
		for (const [where, edit] of places) {
			const said = refusal(edited(edit)) ?? "";
			expect([where, said.includes("does not hold the declared type")]).toEqual(
				[where, true],
			);
		}
	});
});

describe.skipIf(url === undefined)("what the export renders", () => {
	// spec: snapshot-export/the-client-s-own-check
	test("an exported bundle is one the client accepts [39]", async () => {
		const sql = await seeded(clean);
		await stage(sql, NEW_PATCH);
		await buildSnapshot(sql, NEW_PATCH, BUILT_AT);

		// Through JSON, because what the client validates is the parsed text:
		// `createdAt` is a `Date` on the object the render returned and a
		// string on the payload, and only one of those `isBundle` accepts.
		const bundle = JSON.parse(JSON.stringify(await renderBundle(sql)));

		expect(isBundle(bundle)).toBe(true);
	});

	// spec: snapshot-export/a-component-rendered-as-zeros-throughout
	test("a snapshot measuring neither component renders both [62]", async () => {
		const sql = await seeded(clean);
		await stage(sql, NEW_PATCH);
		await sql`DELETE FROM staging_hero_sides WHERE patch_id = ${NEW_PATCH}`;
		await sql`DELETE FROM staging_hero_phases WHERE patch_id = ${NEW_PATCH}`;
		await buildSnapshot(sql, NEW_PATCH, BUILT_AT);

		// That this renders at all is half the criterion: the export reads the
		// newest *published* snapshot, so a build the validation had refused
		// would leave nothing here to render and raise instead.
		const bundle = JSON.parse(JSON.stringify(await renderBundle(sql)));

		// Present with the value the model reads as no contribution, rather
		// than dropped for being empty: an absent `side` reaches the model as
		// `undefined` and leaves it computing `NaN`.
		expect(
			bundle.heroes.map((entry: SnapshotBundle["heroes"][number]) => [
				entry.side,
				entry.phase,
			]),
		).toEqual([
			[
				{ radiant: 0, dire: 0 },
				{ p1: 0, p2: 0, last: 0 },
			],
			[
				{ radiant: 0, dire: 0 },
				{ p1: 0, p2: 0, last: 0 },
			],
		]);
	});
});
