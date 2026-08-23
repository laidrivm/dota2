/**
 * Which weeks a pair pull covers: how many the cap admits, which patch a week
 * spanning a release belongs to, and where the run's own week stops.
 *
 * Every instant here is UTC and the Thursdays are the source's own bucket
 * boundaries, measured over week 2954 in
 * `docs/context/stratz-probe-2026-08.md`.
 */
import { expect, test } from "bun:test";
import { pairWeeks } from "./pairs.ts";

const WEEK_MS = 604_800_000;

/** A Thursday midnight, which is where the source's buckets turn. */
const THURSDAY = Date.parse("2026-08-20T00:00:00.000Z");

/** A run on the Friday after it, so the week 2955 began is still in progress. */
const RUN_AT = new Date("2026-08-21T12:00:00.000Z");

/** The patch released `weeks` whole buckets before the run's own week began. */
const released = (weeks: number) => new Date(THURSDAY - weeks * WEEK_MS);

/** The `start` of every week the pull would cover, as ISO days. */
const covered = (detectedAt: Date) =>
	pairWeeks(detectedAt, RUN_AT).map((week) => week.start.toISOString());

// spec: snapshot-ingest/a-patch-younger-than-the-cap
test("a patch live for exactly four complete weeks pulls four [23]", () => {
	expect(covered(released(4))).toEqual([
		"2026-07-23T00:00:00.000Z",
		"2026-07-30T00:00:00.000Z",
		"2026-08-06T00:00:00.000Z",
		"2026-08-13T00:00:00.000Z",
	]);
});

// spec: snapshot-ingest/a-patch-older-than-the-cap
test("a patch live for twelve pulls exactly the four most recent [24]", () => {
	const weeks = pairWeeks(released(12), RUN_AT);

	// Which four, not merely how many: a cap invisible in the output reads
	// afterwards as complete coverage.
	expect(weeks).toHaveLength(4);
	expect(weeks.map((week) => week.start.toISOString())).toEqual(
		covered(released(4)),
	);
});

// spec: snapshot-ingest/a-patch-younger-than-the-cap
test("a patch live for two pulls two, and no week before it [25]", () => {
	expect(covered(released(2))).toEqual([
		"2026-08-06T00:00:00.000Z",
		"2026-08-13T00:00:00.000Z",
	]);
});

// spec: snapshot-ingest/a-week-that-crosses-a-release
test("a week whose span holds the release belongs to the new patch [31]", () => {
	// Released on the Sunday inside week 2954, which therefore ends under the
	// new patch and is pulled; the week before it ended under the old one.
	expect(covered(new Date("2026-08-16T09:00:00.000Z"))).toEqual([
		"2026-08-13T00:00:00.000Z",
	]);
});

// spec: snapshot-ingest/a-week-that-crosses-a-release
test("a release on a bucket boundary leaves that bucket to the old patch [31]", () => {
	// The two sides of `detected < end`: a patch released as week 2954 opened
	// is in force on its last day, one released as it closed is not.
	expect(covered(new Date(THURSDAY - WEEK_MS))).toEqual([
		"2026-08-13T00:00:00.000Z",
	]);
	expect(covered(new Date(THURSDAY))).toEqual([]);
});

// spec: snapshot-ingest/a-patch-younger-than-the-cap
test("the week the run falls inside is not pulled [23]", () => {
	// The run is the Friday of week 2955, which the source answers with
	// nothing at all; the freshest complete bucket ended the Wednesday before.
	const [last] = pairWeeks(released(1), RUN_AT).slice(-1);

	expect(last?.end.toISOString()).toBe("2026-08-20T00:00:00.000Z");
});

test("an instant that is not one is refused rather than asked for", () => {
	expect(() => pairWeeks(new Date("not a date"), RUN_AT)).toThrow(
		"invalid instant",
	);
	expect(() => pairWeeks(released(1), new Date("not a date"))).toThrow(
		"invalid instant",
	);
});
