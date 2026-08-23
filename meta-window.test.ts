/**
 * The window a patch and a run instant define: which whole UTC days it holds,
 * where the source's own reach cuts it short, and that neither bound is read
 * off the machine's calendar.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { metaWindow } from "./meta.ts";

/** A patch released at a UTC midnight, and a run a week into its life. */
const RELEASED = new Date("2026-08-14T00:00:00.000Z");
const RUN_AT = new Date("2026-08-21T12:00:00.000Z");

/** The window for a patch released at the midnight `days` whole days back. */
const aged = (days: number) =>
	metaWindow(
		new Date(Date.parse("2026-08-21T00:00:00.000Z") - days * 86_400_000),
		RUN_AT,
	);

// spec: snapshot-ingest/a-patch-a-week-old
test("a patch seven whole UTC days old is covered over seven days [20]", () => {
	expect(metaWindow(RELEASED, RUN_AT)).toEqual({
		start: new Date("2026-08-14T00:00:00.000Z"),
		end: new Date("2026-08-21T00:00:00.000Z"),
		days: 7,
		cappedBySource: false,
	});
});

// spec: snapshot-ingest/a-patch-a-week-old
test("a patch released midway through a day leaves that day out [20]", () => {
	// Released at noon on the 14th, so the 14th is not a day the window holds:
	// six whole days remain, not seven.
	const span = metaWindow(new Date("2026-08-14T12:00:00.000Z"), RUN_AT);

	expect(span.days).toBe(6);
	expect(span.start).toEqual(new Date("2026-08-15T00:00:00.000Z"));
});

// spec: snapshot-ingest/the-day-in-progress
test("the day the run instant falls inside is not part of it [64]", () => {
	// The last instant of the eighth day and the first of the ninth: the
	// window grows only once the day it would add has finished.
	expect(metaWindow(RELEASED, new Date("2026-08-21T23:59:59.999Z")).days).toBe(
		7,
	);
	expect(metaWindow(RELEASED, new Date("2026-08-22T00:00:00.000Z")).days).toBe(
		8,
	);
});

describe("read from a zone nine hours ahead of UTC", () => {
	const zone = process.env.TZ;
	beforeAll(() => {
		process.env.TZ = "Asia/Tokyo";
	});
	afterAll(() => {
		process.env.TZ = zone;
	});

	// spec: snapshot-ingest/the-day-in-progress
	test("a run instant whose local date is a day ahead adds no day [26]", () => {
		// 23:00 UTC is the next morning in Tokyo, so a window measured by the
		// machine's calendar would hold eight days here rather than seven.
		expect(
			metaWindow(RELEASED, new Date("2026-08-21T23:00:00.000Z")).days,
		).toBe(7);
	});
});

// spec: snapshot-ingest/a-patch-detected-today
test("a patch with no complete day behind it covers the last complete one [18]", () => {
	const today = metaWindow(
		new Date("2026-08-21T06:00:00.000Z"),
		new Date("2026-08-21T12:00:00.000Z"),
	);

	expect(today).toEqual({
		start: new Date("2026-08-20T00:00:00.000Z"),
		end: new Date("2026-08-21T00:00:00.000Z"),
		days: 1,
		cappedBySource: false,
	});
});

// spec: snapshot-ingest/a-patch-older-than-the-source-will-serve
test("a patch 150 days old covers thirty days, and the cap is recorded [70]", () => {
	const old = metaWindow(new Date("2026-03-24T00:00:00.000Z"), RUN_AT);

	expect(old.days).toBe(30);
	// Recorded rather than inferred from the length: a thirty-day patch and a
	// 150-day one both ask for thirty days, and only one of them is covered
	// whole.
	expect(old.cappedBySource).toBe(true);
	expect(old.start).toEqual(new Date("2026-07-22T00:00:00.000Z"));
});

// spec: snapshot-ingest/a-patch-older-than-the-source-will-serve
test("a patch exactly thirty days old is covered whole [70]", () => {
	// The day either side of the cap: thirty days is the patch's own span and
	// thirty-one is the source refusing to serve one.
	expect(aged(30)).toMatchObject({ days: 30, cappedBySource: false });
	expect(aged(31)).toMatchObject({ days: 30, cappedBySource: true });
});
