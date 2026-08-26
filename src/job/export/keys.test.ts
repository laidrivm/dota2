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

	test("an id key that is not a decimal integer string fails [34]", () => {
		for (const [where, edit] of [
			[
				"matchups",
				(bundle: SnapshotBundle) => {
					bundle.matchups.all = {};
				},
			],
			[
				"a hero's positions",
				(bundle: SnapshotBundle) => {
					(bundle.heroes[0] as unknown as Record<string, unknown>).positions = {
						mid: { share: 1, meta: 0, sufficient: true },
					};
				},
			],
		] as const)
			expect([where, refusal(edited(edit)) !== undefined]).toEqual([
				where,
				true,
			]);
	});
});
