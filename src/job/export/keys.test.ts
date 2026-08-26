/**
 * What the key check accepts and what it refuses, read without a database.
 *
 * The first case is the one that keeps the rest honest: the check holds the
 * contract in a second form, and the shipped fixture is the first form made
 * concrete, so a key added to `src/types.ts` and to the fixture without a
 * line in `keys.ts` fails here rather than riding along unchecked.
 */
import { describe, expect, test } from "bun:test";
import rawFixture from "../../fixtures/snapshot.json" with { type: "json" };
import type { SnapshotBundle } from "../../types.ts";
import { checkKeys } from "./keys.ts";

const fixture = rawFixture as unknown as SnapshotBundle;

/** The fixture with one edit, which every refusal below is one of. */
const edited = (edit: (bundle: SnapshotBundle) => void): SnapshotBundle => {
	const copy = structuredClone(fixture);
	edit(copy);
	return copy;
};

/** What `checkKeys` said, or `undefined` where it accepted the bundle. */
const refusal = (bundle: SnapshotBundle): string | undefined => {
	try {
		checkKeys(bundle);
		return undefined;
	} catch (error) {
		return (error as Error).message;
	}
};

describe("the bundle's keys", () => {
	test("the shipped fixture passes, contract and check agreeing", () => {
		expect(refusal(fixture)).toBeUndefined();
	});

	// spec: snapshot-export/a-key-that-is-neither
	test("a key of the wrong spelling fails on the spelling [34]", () => {
		// All three, because a test for the underscore alone catches one of
		// them: `patch-id` and `PatchId` are the two it would let publish.
		//
		// And on the spelling rather than merely at all: the declared set would
		// refuse each of these anyway, so a case reading only "it failed" says
		// nothing about the pattern and passes with the pattern weakened to
		// anything at all. What the refusal *says* is what separates them.
		for (const wrong of ["patch_id", "patch-id", "PatchId"])
			expect([
				wrong,
				refusal(
					edited((bundle) => {
						(bundle.patch as unknown as Record<string, unknown>)[wrong] =
							bundle.patch.id;
					}),
				),
			]).toEqual([wrong, `patch's key ${wrong} is not a camelCase name`]);
	});

	test("a key the contract does not declare fails though it is camelCase [34]", () => {
		const said = refusal(
			edited((bundle) => {
				(bundle.heroes[0] as unknown as Record<string, unknown>).winrate = 51;
			}),
		);
		// It is spelled the way every declared key is, so the pattern accepts
		// it and only the declared set can refuse it — which is why the check
		// holds one at all, and what the message has to say.
		expect(said).toContain("heroes[0]'s key winrate is not one of");
	});

	test("a key the contract declares and the render dropped fails [34]", () => {
		const said = refusal(
			edited((bundle) => {
				delete (bundle.heroes[0] as unknown as Record<string, unknown>).contest;
			}),
		);
		expect(said).toContain("contest");
	});

	test("an undeclared key fails wherever a named object sits [34]", () => {
		// Every place `named` is called, not the two the cases above reach:
		// removing the call that walks a hero's side, or its phase, or one
		// position's statistics, leaves those cases passing.
		// Cast once: the fixture holds heroes, and every edit below reaches
		// into the first of them to plant a key the contract does not declare.
		const hero = (bundle: SnapshotBundle) =>
			bundle.heroes[0] as unknown as {
				side: Record<string, unknown>;
				phase: Record<string, unknown>;
				positions: Record<string, Record<string, unknown>>;
			};
		const places: [string, (bundle: SnapshotBundle) => void][] = [
			[
				"the bundle",
				(bundle) => {
					(bundle as unknown as Record<string, unknown>).extra = 1;
				},
			],
			[
				"a hero's side",
				(bundle) => {
					hero(bundle).side.mid = 0;
				},
			],
			[
				"a hero's phase",
				(bundle) => {
					hero(bundle).phase.p3 = 0;
				},
			],
			[
				"a position's statistics",
				(bundle) => {
					const [first] = Object.values(hero(bundle).positions);
					if (first !== undefined)
						(first as unknown as Record<string, unknown>).rank = 1;
				},
			],
		];
		for (const [where, edit] of places) {
			const said = refusal(edited(edit)) ?? "";
			expect([
				where,
				/key (extra|mid|p3|rank) is not one of/.test(said),
			]).toEqual([where, true]);
		}
	});

	test("an id key that is not a decimal integer string fails [34]", () => {
		// Every place an id key is read, not the two easiest: the matrices are
		// checked at both levels, and dropping either level or either matrix
		// leaves a bundle whose keys the client looks heroes up by.
		const places: [string, (bundle: SnapshotBundle) => void][] = [
			[
				"matchups",
				(bundle) => {
					bundle.matchups.all = {};
				},
			],
			[
				"a matchup's row",
				(bundle) => {
					const [first] = Object.values(bundle.matchups);
					if (first !== undefined) first.all = 0;
				},
			],
			[
				"synergies",
				(bundle) => {
					bundle.synergies.all = {};
				},
			],
			[
				"a synergy's row",
				(bundle) => {
					const [first] = Object.values(bundle.synergies);
					if (first !== undefined) first.all = 0;
				},
			],
			[
				"a hero's positions",
				(bundle) => {
					(bundle.heroes[0] as unknown as Record<string, unknown>).positions = {
						mid: { share: 1, meta: 0, sufficient: true },
					};
				},
			],
		];
		for (const [where, edit] of places) {
			const said = refusal(edited(edit)) ?? "";
			expect([
				where,
				/key (all|mid) is not a decimal integer string/.test(said),
			]).toEqual([where, true]);
		}
	});
});
