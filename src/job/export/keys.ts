/**
 * The bundle's keys, checked at every depth before it can be published.
 *
 * Two kinds and no third: a named key is camelCase, and an id key is a
 * decimal integer string. The named keys are also checked against what
 * `src/types.ts` declares at that point, because a key of the right *shape*
 * is not thereby a key the client reads — `patchId` beside `patch` would pass
 * a spelling test and mean nothing to anyone.
 *
 * This is the contract in a second form, and unavoidably so: the interfaces
 * are erased before the bundle exists. `keys.test.ts` walks the shipped
 * fixture through it, so a key added to the contract without a line here
 * fails rather than passing unchecked. Value types are group 6's; this is
 * keys alone.
 */
import type { SnapshotBundle } from "../../types.ts";

/** Rejects `patch_id`, `patch-id` and `PatchId` alike. */
const NAMED = /^[a-z][A-Za-z0-9]*$/;

/** A hero id or a position, as a JSON object key is: decimal, unpadded. */
const ID = /^(0|[1-9][0-9]*)$/;

const BUNDLE = [
	"snapshotId",
	"createdAt",
	"patch",
	"stabilizing",
	"heroes",
	"matchups",
	"synergies",
];
const PATCH = ["id", "isMajor", "detectedAt"];
const HERO = [
	"id",
	"name",
	"short",
	"icon",
	"aliases",
	"sufficient",
	"contest",
	"side",
	"phase",
	"positions",
];
const SIDE = ["radiant", "dire"];
const PHASE = ["p1", "p2", "last"];
const POSITION = ["share", "meta", "sufficient"];

/**
 * The bundle roots the walk below has already accounted for: two scalars, the
 * flag, and the two the named checks above descend into. Everything else is a
 * matrix of matrices keyed by hero id.
 */
const CHECKED_ABOVE = [
	"snapshotId",
	"createdAt",
	"stabilizing",
	"patch",
	"heroes",
];

/** Raise unless every key of `bundle` is one the client reads. */
export function checkKeys(bundle: SnapshotBundle): void {
	named("", bundle, BUNDLE);
	named("patch", bundle.patch, PATCH);
	bundle.heroes.forEach((hero, index) => {
		const at = `heroes[${index}]`;
		named(at, hero, HERO);
		named(`${at}.side`, hero.side, SIDE);
		named(`${at}.phase`, hero.phase, PHASE);
		ids(`${at}.positions`, hero.positions);
		for (const [position, stats] of Object.entries(hero.positions))
			named(`${at}.positions.${position}`, stats, POSITION);
	});
	// Driven by the bundle's own roots, and scoped by what it exempts: every
	// root not checked above is a matrix keyed by hero id, so a matrix the
	// contract grows is scanned by being there. Named as a list of what is
	// *not* one, because that list refuses loudly — a root added to `BUNDLE`
	// and left out of it reaches `ids`, whose keys are camelCase names and not
	// integers, so it fails rather than going unscanned.
	for (const [root, held] of Object.entries(bundle)) {
		if (CHECKED_ABOVE.includes(root)) continue;
		const matrix = held as Record<string, object>;
		ids(root, matrix);
		for (const [hero, against] of Object.entries(matrix))
			ids(`${root}.${hero}`, against);
	}
}

/** Every key here is camelCase and one of `declared`, in any order. */
function named(at: string, held: object, declared: string[]): void {
	for (const key of Object.keys(held)) {
		if (!NAMED.test(key)) refuse(at, key, "is not a camelCase name");
		if (!declared.includes(key))
			refuse(at, key, `is not one of ${declared.join(", ")}`);
	}
	// Both directions, because a key the contract declares and the render
	// dropped is as unreadable to the client as one it never declared — and a
	// check on what is present cannot see what is not.
	for (const key of declared)
		if (!Object.hasOwn(held, key)) refuse(at, key, "is declared and missing");
}

/** Every key here is a decimal integer string, and there is no other kind. */
function ids(at: string, held: object): void {
	for (const key of Object.keys(held))
		if (!ID.test(key)) refuse(at, key, "is not a decimal integer string");
}

function refuse(at: string, key: string, why: string): never {
	throw new Error(`${at === "" ? "the bundle" : at}'s key ${key} ${why}`);
}
