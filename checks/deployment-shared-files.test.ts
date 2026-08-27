/**
 * What the compose project actually arranges: the bundle and the icon mirror
 * as one set of files the job writes and the application reads, and a job that
 * is not running until something asks for it.
 *
 * These run the project. `checks/deployment-topology.test.ts` reads the file
 * and asserts what it says; this one asserts what happens, which is the half
 * a mount at a plausible-looking path passes without doing.
 *
 * Every request goes through a container on the shared network, addressing the
 * application by name — the project publishes no port, so that is not one way
 * in among several but the only one there is, and it is what the reverse proxy
 * does.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	compose,
	down,
	incarnation,
	inJob,
	request,
	up,
} from "./compose.fixture.ts";
import {
	available,
	buildsImage,
	HOOK_MS,
	requiresDocker,
} from "./docker.fixture.ts";

requiresDocker();

describe.skipIf(!available)("the compose project", () => {
	buildsImage();
	beforeAll(up, HOOK_MS);
	afterAll(down, HOOK_MS);

	// spec: snapshot-schedule/the-job-is-not-kept-running
	test(
		"brings up no job container",
		() => {
			// The services compose considers running, asked of the project rather
			// than of docker at large: another project's container named for a job
			// is not this one's.
			const running = compose("ps", "--services").stdout.toString().split("\n");
			expect(running).toContain("app");
			expect(running).toContain("db");
			expect(running).not.toContain("job");
		},
		HOOK_MS,
	);

	// spec: deployment-topology/the-proxy-reaching-the-application
	test(
		"answers by container name over the shared network",
		() => {
			const answer = request("/");
			expect(answer.status).toBe(200);
		},
		HOOK_MS,
	);

	// spec: deployment-topology/a-bundle-published-while-the-application-is-running
	test(
		"serves a bundle the job published, without a restart",
		() => {
			// Before, so what follows is a change rather than a coincidence: the
			// image ships the fixture and an assertion made only afterwards would
			// pass against it.
			const serving = incarnation();
			const before = request("/snapshot.json");
			expect(before.status).toBe(200);
			expect(before.body).not.toContain("published-by-the-job");

			// The job's own publishing code, in the job service, writing to the
			// directory its own environment names. `publishBundle` writes a part
			// file and renames it, which is the step a mount could fail at: a
			// rename across a filesystem boundary is refused, and a bundle written
			// to a path that is not really the volume would land nowhere the
			// application looks.
			const published = inJob(
				`bun -e 'import { publishBundle } from "/app/src/job/export/publish.ts";
			 await publishBundle(process.env.BUNDLE_DIR, { marker: "published-by-the-job" });'`,
			);
			expect(published.stderr.toString()).not.toContain("error");
			expect(published.exitCode).toBe(0);

			// The same process that was already serving, never restarted: the
			// server lists the directory per request, which is what makes a shared
			// mount sufficient and a rebuild unnecessary.
			const after = request("/snapshot.json");
			expect(after.status).toBe(200);
			expect(after.body).toContain("published-by-the-job");
			// The same incarnation: `restart: always` would otherwise let a
			// container that died and came back read the volume fresh and
			// satisfy the assertion above for the one reason it rules out.
			expect(incarnation()).toBe(serving);
		},
		HOOK_MS,
	);

	// spec: deployment-topology/a-hero-mirrored-while-the-application-is-running
	test(
		"serves an image the ingest mirrored, without a restart",
		() => {
			const name = "9999.png";
			const before = request(`/icons/${name}`);
			expect(before.status).toBe(404);

			const mirrored = inJob(
				`printf 'mirrored-by-the-ingest' > "$ICONS_DIR/${name}"`,
			);
			expect(mirrored.exitCode).toBe(0);

			const after = request(`/icons/${name}`);
			expect(after.status).toBe(200);
			expect(after.body).toContain("mirrored-by-the-ingest");
		},
		HOOK_MS,
	);
});
