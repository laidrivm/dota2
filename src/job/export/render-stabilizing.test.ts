/**
 * When the bundle says the patch it was built on is still settling.
 *
 * Read without a database: the flag is a function of three fields the
 * snapshot froze when it was built, so a case is those three and nothing
 * else. Every instant below is written against one `detected_at` at midnight
 * UTC, because what separates the cases is the day count and not the anchor.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { stabilizing } from "./render.ts";

/** The patch every case counts from, detected at midnight UTC. */
const DETECTED = new Date("2026-07-14T00:00:00.000Z");

describe("whether the bundle calls the patch settling", () => {
	// spec: snapshot-export/the-day-a-major-patch-lands
	// spec: snapshot-export/the-window-has-passed
	test.each([
		["the day it landed", "2026-07-14T09:00:00.000Z", true],
		[
			"the last whole day before the window closes",
			"2026-07-17T23:59:59.999Z",
			true,
		],
		["the day the window closes", "2026-07-18T00:00:00.000Z", false],
		["a month past it", "2026-08-14T00:00:00.000Z", false],
	])(
		"a major patch is settling on %s [32]",
		(_when, at: string, settling: boolean) => {
			// The window is *Patch blending with a decaying prior*'s `t_max`,
			// four whole days for a major patch — so the third row is the first
			// instant at which the prior this flag stands for has stopped
			// counting, and the second is the last at which it still does.
			expect(stabilizing(true, DETECTED, new Date(at))).toBe(settling);
		},
	);

	// spec: snapshot-export/a-letter-patch
	test("a letter patch is not settling however recent [33]", () => {
		// The same instant the first row above calls settling: the kind is all
		// that differs, so a flag reading the window alone passes there and
		// fails here.
		expect(
			stabilizing(false, DETECTED, new Date("2026-07-14T09:00:00.000Z")),
		).toBe(false);
	});
});

/** The zone this file found, which the block below must give back. */
const AT_LOAD = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe("the day count the window is measured in", () => {
	const zone = process.env.TZ;
	beforeAll(() => {
		// East of UTC by enough that the instant below falls on the next local
		// day: run in UTC, where `bun test` starts whatever the machine's zone
		// is, a count taken off the local calendar and one taken off the UTC
		// timeline agree, and the case cannot tell them apart.
		process.env.TZ = "Asia/Tokyo";
	});
	afterAll(() => {
		// `UTC` rather than a delete where it arrived unset, for the reason
		// `render-shape.test.ts` records: deleting `TZ` in bun 1.3.14 leaves
		// the last value assigned rather than restoring the system one.
		process.env.TZ = zone ?? "UTC";
	});

	// spec: snapshot-export/an-offset-that-crosses-the-utc-day
	test("an offset that crosses the UTC day is counted by UTC [57]", () => {
		// Asserted rather than assumed: an assignment that did not take leaves
		// this in UTC, where the reading this case exists to refuse passes.
		expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("Asia/Tokyo");
		// `2026-07-18T00:30:00+05:00` is `2026-07-17T19:30:00Z`: three whole
		// days past the anchor, and 04:30 on the 18th in Tokyo — so a count
		// read off either local calendar gives four and calls the window
		// closed a day early.
		expect(
			stabilizing(true, DETECTED, new Date("2026-07-18T00:30:00+05:00")),
		).toBe(true);
	});
});

test("the zone the block above set is given back", () => {
	// Nothing else in this file would notice — every case above reads UTC — so
	// the file that pays for a restore that did not take is some later one.
	expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(AT_LOAD);
});
