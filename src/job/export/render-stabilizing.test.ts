/**
 * When the bundle says the patch it was built on is still settling.
 *
 * Read without a database: the flag is a function of three fields the
 * snapshot froze when it was built, so a case is those three and nothing
 * else. Every instant below is written against one `detected_at` at midnight
 * UTC, because what separates the cases is the day count and not the anchor.
 */
import { describe, expect, test } from "bun:test";
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

	// spec: snapshot-export/an-offset-that-crosses-the-utc-day
	test("an offset that crosses the UTC day is counted by UTC [57]", () => {
		// `2026-07-18T00:30:00+05:00` is `2026-07-17T19:30:00Z`: three whole
		// days past the anchor, where reading the offset's own calendar date
		// gives four and calls the window closed.
		expect(
			stabilizing(true, DETECTED, new Date("2026-07-18T00:30:00+05:00")),
		).toBe(true);
	});
});
