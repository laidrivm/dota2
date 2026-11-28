/**
 * The uploaded d2pt meta folded into the snapshot the engine reads
 * (cm-meta-import, *The model takes hero strength from the upload where it
 * exists*; design D9).
 */
import { expect, test } from "bun:test";
import type { Role } from "../../types.ts";
import { bundle, hero } from "./engine.fixture.ts";
import { type Uploads, withUploads } from "./meta.ts";
import { metaAt, PLAYABLE_SHARE } from "./value.ts";

const std = (values: number[]) => {
	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	return Math.sqrt(
		values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length,
	);
};

/** Heroes 1–4: snapshot meta −2, −1, 1, 2 at position 1, and 0.5 at 2. */
const snapshot = () =>
	bundle([
		hero(1, { "1": -2, "2": 0.5 }),
		hero(2, { "1": -1, "2": 0.5 }),
		hero(3, { "1": 1, "2": 0.5 }),
		hero(4, { "1": 2, "2": 0.5 }),
		hero(5, { "2": 0.5 }),
	]);

const uploads = (ratings: Record<number, number | null>): Uploads => ({
	"1": {
		heroes: Object.fromEntries(
			Object.entries(ratings).map(([id, rating]) => [id, { rating }]),
		),
	},
});

// spec: cm-meta-import/nothing-uploaded-yet
test("with nothing uploaded the snapshot is read as it is", () => {
	const b = snapshot();
	expect(withUploads(b, {})).toBe(b);
	expect(withUploads(b, { "1": null, "3": null })).toEqual(b);
});

// spec: cm-meta-import/one-position-uploaded
test("an uploaded position takes its meta from the ratings, 50 at 0, spread to the snapshot's", () => {
	const b = snapshot();
	const read = withUploads(b, uploads({ 1: 30, 2: 50, 3: 60, 4: 90, 5: 70 }));
	const at = (id: number, k: Role) => {
		const entry = read.heroes.find((h) => h.id === id);
		return entry ? metaAt(entry, k) : Number.NaN;
	};
	expect(at(2, 1)).toBe(0);
	// The mapped ratings' spread equals the snapshot's at position 1.
	const snapshotSpread = std([-2, -1, 1, 2]);
	const mapped = [1, 2, 3, 4, 5].map((id) => at(id, 1));
	expect(std(mapped)).toBeCloseTo(snapshotSpread, 10);
	// Order follows the ratings, and a hero the snapshot never placed at 1
	// plays there once rated.
	expect(at(4, 1)).toBeGreaterThan(at(3, 1));
	expect(at(5, 1)).toBeGreaterThan(at(3, 1));
	// Every other position is the snapshot's.
	for (const id of [1, 2, 3, 4, 5]) expect(at(id, 2)).toBe(0.5);
});

test("a hero unrated at an uploaded position cannot play it", () => {
	const read = withUploads(
		snapshot(),
		uploads({ 1: 30, 2: null, 3: 60, 4: 90 }),
	);
	const entry = (id: number) => read.heroes.find((h) => h.id === id);
	// Null-rated, and not in the upload at all: off-role, both.
	expect(metaAt(entry(2) as never, 1)).toBe(-10);
	expect(metaAt(entry(5) as never, 1)).toBe(-10);
	expect(entry(3)?.positions["1"]?.share).toBeGreaterThanOrEqual(
		PLAYABLE_SHARE,
	);
});
