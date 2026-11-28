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

test("each position reads its own upload", () => {
	const all = (["1", "2", "3", "4", "5"] as const).map((k) => [
		k,
		{ heroes: { "1": { rating: 30 }, "2": { rating: 70 } } },
	]);
	const read = withUploads(snapshot(), Object.fromEntries(all) as Uploads);
	const one = read.heroes.find((h) => h.id === 1);
	const two = read.heroes.find((h) => h.id === 2);
	for (const k of [1, 2, 3, 4, 5] as Role[]) {
		expect(metaAt(two as never, k)).toBeGreaterThanOrEqual(
			metaAt(one as never, k),
		);
		// Rated there, both play every position, the snapshot's or not.
		expect(metaAt(one as never, k)).toBeGreaterThan(-10);
		expect(metaAt(two as never, k)).toBeGreaterThan(-10);
		// Unrated there, hero 3 cannot play any uploaded position.
		expect(metaAt(read.heroes.find((h) => h.id === 3) as never, k)).toBe(-10);
	}
});

test("two rated heroes spread to a snapshot of two, and an unrated one leaves the spread alone", () => {
	const two = bundle([
		hero(1, { "3": -1 }),
		hero(2, { "3": 1 }),
		hero(3, { "3": 0.2 }),
	]);
	const read = withUploads(two, {
		"3": {
			heroes: {
				"1": { rating: 40 },
				"2": { rating: 60 },
				"3": { rating: null },
			},
		},
	});
	const at = (id: number) =>
		metaAt(read.heroes.find((h) => h.id === id) as never, 3);
	// The snapshot's spread over heroes 1–3 is that of −1, 1 and 0.2.
	expect(std([at(1), at(2)])).toBeCloseTo(std([-1, 1, 0.2]), 10);
	expect(at(1)).toBeCloseTo(-at(2), 10);
});

test("one rated hero, or a position the snapshot never filled, maps to 0", () => {
	const lone = withUploads(snapshot(), {
		"1": { heroes: { "3": { rating: 80 } } },
	});
	expect(metaAt(lone.heroes.find((h) => h.id === 3) as never, 1)).toBeCloseTo(
		0,
		10,
	);
	const empty = withUploads(snapshot(), {
		"4": { heroes: { "1": { rating: 20 }, "2": { rating: 90 } } },
	});
	expect(metaAt(empty.heroes.find((h) => h.id === 1) as never, 4)).toBeCloseTo(
		0,
		10,
	);
});
