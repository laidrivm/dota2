/**
 * The schedule: the line the README hands an operator, and what that line
 * leaves behind when it runs.
 *
 * The shape cases read the entry and run nothing, so they hold on any machine.
 * The rest execute it — against a stand-in project for the statuses the
 * deployment's own job cannot be asked to exit with, and against the
 * deployment itself for the one thing a stand-in cannot show: that the entry
 * reaches a service kept behind a profile, runs it, and leaves nothing.
 *
 * `checks/snapshot-schedule-exclusion.test.ts` is the other half — what a
 * second invocation does while a run is still going.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { down, PROJECT, projectFile, up } from "./compose.fixture.ts";
import { DEPLOY, repository } from "./deploy-workflow.fixture.ts";
import { buildsImage, HOOK_MS, requiresDocker } from "./docker.fixture.ts";
import {
	clean,
	containers,
	invoke,
	records,
	requiresSchedule,
	schedulable,
	standIn,
	under,
} from "./schedule.fixture.ts";
import { ENTRY, FILE, LOCK, LOG, SCHEDULE } from "./schedule-entry.fixture.ts";

requiresDocker();
requiresSchedule();

/**
 * An ISO instant, which is the whole of what the entry's `date` writes.
 *
 * The offset is part of it and is asserted: `date -Iseconds` writes the host's
 * local time, so two records either side of a clock change are comparable only
 * because each says which offset it was written under. `Z` as well as `±hh:mm`
 * — GNU writes the second, and a host set to UTC may write either.
 */
const INSTANT = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(Z|[+-]\d\d:\d\d)$/;

describe("the entry the README names", () => {
	// spec: snapshot-schedule/a-scheduled-invocation
	test("is one line, which is all a crontab reads", () => {
		// A crontab has no continuation: a line broken over two is two entries,
		// the second of which is not a schedule at all. The design's own
		// rendering of this line was wrapped for the page, and this is what
		// keeps the README's from being.
		expect(ENTRY).not.toContain("\n");
	});

	// spec: snapshot-schedule/a-scheduled-invocation
	test("fires at a fixed hour and minute rather than through the day", () => {
		const fields = SCHEDULE.split(/\s+/);
		expect(fields).toHaveLength(5);
		expect(fields[0]).toMatch(/^\d+$/);
		expect(fields[1]).toMatch(/^\d+$/);
	});

	// spec: snapshot-schedule/a-run-that-succeeds
	test("names an absolute lock, log and project file", () => {
		// Absolute because cron runs the entry from the invoking user's home
		// with a `PATH` of its own: a relative path here resolves somewhere
		// nobody chose, and the record would be written there.
		for (const named of [LOCK, LOG, FILE]) expect(named).toMatch(/^\//);
	});

	// spec: snapshot-schedule/a-scheduled-invocation
	test("runs the project the deploy workflow puts on the host", () => {
		// The one value this line and `deploy.yml`'s host script both name.
		// The README's prose around the entry points at it rather than
		// restating the path, but the entry itself has to be complete — an
		// operator pastes it — so the two literals are bound here instead of
		// by not existing. A deployment moved on the host changes one of them
		// and fails this.
		const directory = /^\s*cd (\S+)$/m.exec(repository()[DEPLOY] ?? "")?.[1];
		if (!directory)
			throw new Error("the deploy workflow changes into no directory");
		expect(FILE.startsWith(`${directory}/`)).toBe(true);
	});

	// spec: snapshot-schedule/a-scheduled-invocation
	test("carries no `%`, which crontab reads as a newline", () => {
		// The one character that changes meaning between a shell and a crontab.
		// A `date` format string is where it would arrive, and it would end the
		// command at that point rather than being passed on.
		expect(ENTRY).not.toContain("%");
	});
});

describe.skipIf(!schedulable)("the record an invocation leaves", () => {
	buildsImage();
	afterAll(clean, HOOK_MS);

	// spec: snapshot-schedule/a-run-that-succeeds
	test(
		"holds the instant and a zero status, with nothing between them",
		() => {
			const log = under("succeeds.log");
			invoke(standIn("exit 0"), log);
			// The whole file, so that the emptiness is asserted rather than the
			// presence of two lines among however many: a run that succeeds
			// prints nothing, and compose's own progress is what would otherwise
			// fill the record night after night.
			expect(records(log)).toEqual([
				{ at: expect.stringMatching(INSTANT), body: [], status: 0 },
			]);
		},
		HOOK_MS,
	);

	// spec: snapshot-schedule/a-run-that-fails
	test(
		"holds the report naming the step, and a non-zero status",
		() => {
			const log = under("fails.log");
			const report = "the ingest failed: the API answered 401";
			invoke(standIn(`echo '${report}' >&2; exit 1`), log);
			expect(records(log)).toEqual([
				{ at: expect.stringMatching(INSTANT), body: [report], status: 1 },
			]);
		},
		HOOK_MS,
	);

	// spec: snapshot-schedule/a-run-that-fails
	test(
		"holds what went wrong when the entry could not start a run at all",
		() => {
			// The failure nobody arranges and everybody eventually has: the
			// project file moved, or the path in the crontab was wrong from the
			// start. Without this the record would say only that something
			// exited non-zero, and a reader would look for the fault in the job.
			const log = under("absent.log");
			invoke(under("no-such-project.yml"), log);
			const [record, ...rest] = records(log);
			expect(rest).toEqual([]);
			expect(record?.status).not.toBe(0);
			expect(record?.body.join("\n")).toContain("no-such-project.yml");
		},
		HOOK_MS,
	);
});

describe.skipIf(!schedulable)("an invocation against the deployment", () => {
	buildsImage();
	beforeAll(up, HOOK_MS);
	afterAll(() => {
		clean();
		down();
	}, HOOK_MS);

	// spec: snapshot-schedule/a-scheduled-invocation
	test(
		"runs one job container to completion and removes it",
		() => {
			const log = under("deployment.log");
			expect(containers(PROJECT, "job")).toEqual([]);

			// The project file the fixture brought up, so the run joins the
			// database already running rather than starting a second one.
			invoke(projectFile(), log, PROJECT);

			const [record, ...rest] = records(log);
			expect(rest).toEqual([]);
			// The job's own report, in the words `src/job/run.ts` composes: what
			// says a container ran the job rather than compose failing to start
			// one, which would leave a status here and no report of a step. The
			// run fails because this project has no STRATZ key worth the name,
			// and failing is the outcome that is reachable without one.
			expect(record?.body.join("\n")).toMatch(/^the \w+ failed: /);
			expect(record?.status).toBe(1);
			// And nothing left: `--rm` in the entry is what keeps a nightly
			// schedule from leaving a container behind every night.
			expect(containers(PROJECT, "job")).toEqual([]);
		},
		HOOK_MS,
	);
});
