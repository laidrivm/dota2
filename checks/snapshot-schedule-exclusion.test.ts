/**
 * What the entry does when one run is still going.
 *
 * Every case here arranges a run that is actually in flight and invokes the
 * entry against it, which is what `snapshot-schedule` requires of the
 * demonstration: an interval says how often invocations begin and never how
 * long one lasts, and the run this protects against is precisely the one that
 * ran longer than expected.
 *
 * The refusing invocation writes to a log of its own rather than the one the
 * run in flight is appending to. On the host both go to the same file and
 * interleave, which is what `>>` from two processes means; here the two are
 * separated so each record can be read as the invocation that wrote it.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { buildsImage, HOOK_MS, requiresDocker } from "./docker.fixture.ts";
import {
	clean,
	containers,
	inFlight,
	invoke,
	killRun,
	records,
	requiresSchedule,
	schedulable,
	standIn,
	start,
	under,
} from "./schedule.fixture.ts";

requiresDocker();
requiresSchedule();

/** Long enough that the assertions below run against a live container. */
const INFLIGHT = "sleep 30";

describe.skipIf(!schedulable)("an invocation while a run is in flight", () => {
	buildsImage();
	afterAll(clean, HOOK_MS);

	// spec: snapshot-schedule/an-invocation-arriving-while-a-run-is-in-flight
	// spec: snapshot-schedule/the-refusal-is-distinguishable-from-a-failure
	test(
		"starts no second container, leaves the first, and records 99",
		async () => {
			const file = standIn(INFLIGHT);
			const running = start(file, under("held.log"));
			const first = inFlight();

			const refused = under("refused.log");
			invoke(file, refused);

			// The one container there was, still the one there is: not a count
			// alone, which a second container replacing the first would also
			// satisfy.
			expect(containers()).toEqual([first]);
			// 99, which the job itself never emits: `src/job/run.ts` exits 0 or 1
			// and nothing else, so a refusal carrying either would be a refusal
			// the record cannot tell from a run.
			expect(records(refused)).toEqual([
				{ at: expect.any(String), body: [], status: 99 },
			]);

			// And the run it was refused for still ends of its own accord.
			await running.exited;
			expect(records(under("held.log"))[0]?.status).toBe(0);
		},
		HOOK_MS,
	);

	// spec: snapshot-schedule/the-lock-after-the-run-ends
	test(
		"starts normally once the run has ended",
		async () => {
			const log = under("after.log");
			await start(standIn("sleep 2"), log).exited;

			// The same lock, the same entry, a moment later.
			invoke(standIn("exit 0"), log);
			expect(records(log).map((r) => r.status)).toEqual([0, 0]);
		},
		HOOK_MS,
	);

	// spec: snapshot-schedule/a-run-that-dies-without-tidying-up
	test(
		"starts after a run that was killed outright",
		async () => {
			const file = standIn(INFLIGHT);
			const killed = start(file, under("killed.log"));
			inFlight();

			// Killed with no chance to release anything: the exclusion is the
			// kernel's, held for the lifetime of the run's processes and
			// released however they ended. A flag or a lock file of the job's
			// own would still be set here, and every later invocation refused.
			expect(killRun().exitCode).toBe(0);
			await killed.exited;

			const log = under("next.log");
			invoke(standIn("exit 0"), log);
			expect(records(log)).toEqual([
				{ at: expect.any(String), body: [], status: 0 },
			]);
		},
		HOOK_MS,
	);
});
