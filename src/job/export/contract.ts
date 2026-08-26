/**
 * The bundle checked against `SnapshotBundle` at every depth, before it can be
 * published: every key the client reads, present and holding the declared
 * type.
 *
 * Keys come in two kinds and no third: a named key is camelCase, and an id key
 * is a decimal integer string. The named keys are also checked against what
 * `src/types.ts` declares at that point, because a key of the right *shape* is
 * not thereby a key the client reads — `patchId` beside `patch` would pass a
 * spelling test and mean nothing to anyone.
 *
 * The values are checked because the client's own validation stops at the
 * hero's identity: a missing `side` reaches `src/model.ts` as `undefined` and
 * leaves it computing `NaN`, and a `contest` rendered as a string compares as
 * neither greater nor less than a threshold. A declared `number` must also be
 * finite — `NaN` and the infinities are numbers to `typeof`, and arithmetic on
 * them is what a delta of `0/0` becomes.
 *
 * This is the contract in a second form, and unavoidably so: the interfaces
 * are erased before the bundle exists, and two of the objects walked here are
 * built by `Object.fromEntries` from database rows. `contract.test.ts` walks
 * the shipped fixture through it, so a key added to the contract without a
 * line here fails rather than passing unchecked. Written by hand because a
 * schema package would be this change's only new dependency.
 */
import type { SnapshotBundle } from "../../types.ts";

/** Rejects `patch_id`, `patch-id` and `PatchId` alike. */
const NAMED = /^[a-z][A-Za-z0-9]*$/;

/** A hero id or a position, as a JSON object key is: decimal, unpadded. */
const ID = /^(0|[1-9][0-9]*)$/;

/** Whether a value is of the type the contract declares at its key. */
type Declared = (value: unknown) => boolean;

const number: Declared = (value) =>
	typeof value === "number" && Number.isFinite(value);
const text: Declared = (value) => typeof value === "string";
const flag: Declared = (value) => typeof value === "boolean";
/** An object and not an array: every declared object here is keyed, not listed. */
const object: Declared = (value) =>
	typeof value === "object" && value !== null && !Array.isArray(value);
const texts: Declared = (value) => Array.isArray(value) && value.every(text);
/**
 * A hero list with at least one hero, which is what the client requires of it:
 * an empty array is a bundle nothing can be suggested from.
 */
const entries: Declared = (value) =>
	Array.isArray(value) && value.length > 0 && value.every(object);

const BUNDLE: Record<string, Declared> = {
	snapshotId: number,
	createdAt: text,
	patch: object,
	stabilizing: flag,
	heroes: entries,
	matchups: object,
	synergies: object,
};
const PATCH: Record<string, Declared> = {
	id: text,
	isMajor: flag,
	detectedAt: text,
};
const HERO: Record<string, Declared> = {
	id: number,
	name: text,
	short: text,
	icon: text,
	aliases: texts,
	sufficient: flag,
	contest: number,
	side: object,
	phase: object,
	positions: object,
};
const SIDE: Record<string, Declared> = { radiant: number, dire: number };
const PHASE: Record<string, Declared> = {
	p1: number,
	p2: number,
	last: number,
};
const POSITION: Record<string, Declared> = {
	share: number,
	meta: number,
	sufficient: flag,
};

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

/** Raise unless `bundle` is what the client reads, key and value alike. */
export function checkBundle(bundle: SnapshotBundle): void {
	named("", bundle, BUNDLE);
	named("patch", bundle.patch, PATCH);
	bundle.heroes.forEach((hero, index) => {
		const at = `heroes[${index}]`;
		named(at, hero, HERO);
		named(`${at}.side`, hero.side, SIDE);
		named(`${at}.phase`, hero.phase, PHASE);
		ids(`${at}.positions`, hero.positions, object);
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
		ids(root, matrix, object);
		// The leaves are numbers, and there are more of them here than in the
		// whole of the rest of the bundle: a delta the build reached through a
		// division by zero arrives as `NaN` at one of these.
		for (const [hero, against] of Object.entries(matrix))
			ids(`${root}.${hero}`, against, number);
	}
}

/**
 * Every key here is camelCase and one `declared` names, in any order, and
 * holds the type declared beside it.
 */
function named(
	at: string,
	held: object,
	declared: Record<string, Declared>,
): void {
	for (const key of Object.keys(held)) {
		if (!NAMED.test(key)) refuse(at, key, "is not a camelCase name");
		if (!Object.hasOwn(declared, key))
			refuse(at, key, `is not one of ${Object.keys(declared).join(", ")}`);
	}
	// Both directions, because a key the contract declares and the render
	// dropped is as unreadable to the client as one it never declared — and a
	// check on what is present cannot see what is not.
	for (const [key, kind] of Object.entries(declared)) {
		if (!Object.hasOwn(held, key)) refuse(at, key, "is declared and missing");
		if (!kind((held as Record<string, unknown>)[key]))
			refuse(at, key, "does not hold the declared type");
	}
}

/**
 * Every key here is a decimal integer string and there is no other kind, and
 * every value is of the one type such a map holds.
 */
function ids(at: string, held: object, kind: Declared): void {
	for (const [key, value] of Object.entries(held)) {
		if (!ID.test(key)) refuse(at, key, "is not a decimal integer string");
		if (!kind(value)) refuse(at, key, "does not hold the declared type");
	}
}

function refuse(at: string, key: string, why: string): never {
	throw new Error(`${at === "" ? "the bundle" : at}'s key ${key} ${why}`);
}
