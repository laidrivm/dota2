/**
 * What the two suites over `contract.ts` share: the shipped bundle, a copy of
 * it carrying one edit, and what the check said about that copy.
 *
 * The fixture is the shipped `src/fixtures/snapshot.json` rather than a bundle
 * written here, because the check holds the client's contract in a second form
 * and the shipped file is the first form made concrete — a bundle authored
 * beside the check would agree with it by construction.
 */

import rawFixture from "../../fixtures/snapshot.json" with { type: "json" };
import type { SnapshotBundle } from "../../types.ts";
import { checkKeys } from "./contract.ts";

export const fixture = rawFixture as unknown as SnapshotBundle;

/** The fixture with one edit, which every refusal in either suite is one of. */
export const edited = (
	edit: (bundle: SnapshotBundle) => void,
): SnapshotBundle => {
	const copy = structuredClone(fixture);
	edit(copy);
	return copy;
};

/** What the check said, or `undefined` where it accepted the bundle. */
export const refusal = (bundle: SnapshotBundle): string | undefined => {
	try {
		checkKeys(bundle);
		return undefined;
	} catch (error) {
		return (error as Error).message;
	}
};
