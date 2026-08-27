/**
 * The two runtime directories the image holds so that volumes can be mounted
 * over them — `snapshot/` for the published bundle, `icons/` for the mirror.
 *
 * Both halves are load-bearing and for opposite reasons. They must **exist**,
 * because Docker creates a missing mount point itself and creates it owned by
 * `root`: a named volume mounted where the image holds nothing leaves the
 * non-root job unable to write the bundle it has just built. They must be
 * **empty**, because the server answers both from a listing taken per request,
 * so a file shipped at either path is a second source for what it serves — one
 * that survives every export and that no publication can replace.
 *
 * Neither is reachable from a build or a unit test, which is why these run a
 * container with a real volume attached.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	app,
	available,
	buildsImage,
	HOOK_MS,
	holds,
	requiresDocker,
	sh,
	tidy,
} from "./docker.fixture.ts";

requiresDocker();

/**
 * The volume mounted at the publication path. Fixed name and removed
 * afterwards, for the reason the image tag is fixed: a name carrying the pid
 * leaves one behind on every run.
 */
const VOLUME = "d2ass-checks-bundle";

/** Remove it, so a run always starts against a volume nothing has written. */
const clear = () => tidy("volume", "rm", "-f", VOLUME);

// Before as well as after. A named volume takes the ownership of the mount
// point the first time it is attached and keeps it, so one left by an earlier
// run carries that run's answer into this one.
beforeAll(clear, HOOK_MS);

afterAll(clear, HOOK_MS);

describe.skipIf(!available)("the two runtime directories", () => {
	buildsImage();

	// spec: container-image/a-volume-mounted-where-the-image-holds-no-directory
	test("a volume at the publication path is writable by the image's user", () => {
		// Written as the user the image runs as, which is the whole question:
		// `docker run` without `--user` takes the image's own, so this is the
		// job's real identity rather than one the case chose for it.
		const wrote = sh(
			`echo published > ${app()}/snapshot/bundle.json && cat ${app()}/snapshot/bundle.json`,
			"-v",
			`${VOLUME}:${app()}/snapshot`,
		);
		expect(wrote.stderr.toString()).toBe("");
		expect(wrote.exitCode).toBe(0);
		expect(wrote.stdout.toString().trim()).toBe("published");
	}, 60_000);

	// The control for the case above. Docker creates a mount point the image
	// does not hold, and creates it owned by `root` — so a volume at a path the
	// image never made is exactly what the non-root user cannot write. Without
	// this, the case above passes whether or not the image creates anything.
	//
	// An anonymous volume rather than the named one, and that is the whole of
	// what makes it a control: a volume takes the ownership of the mount point
	// it is first attached to and keeps it, so reusing the one the case above
	// wrote through carries `bun` here and the write succeeds. Measured — the
	// case passed against a reused volume and fails against a fresh one.
	// `--rm` takes an anonymous volume away with the container.
	test("a volume at a path the image does not hold is not writable", () => {
		const wrote = sh(
			`echo published > ${app()}/not-a-mount-point/bundle.json`,
			"-v",
			`${app()}/not-a-mount-point`,
		);
		expect(wrote.exitCode).not.toBe(0);
		expect(wrote.stderr.toString()).toContain("denied");
	}, 60_000);

	// spec: container-image/what-the-container-s-user-may-write
	test("the container cannot write to its own source", () => {
		const wrote = sh(`echo tampered >> ${app()}/src/server/server.ts`);
		expect(wrote.exitCode).not.toBe(0);
		expect(wrote.stderr.toString()).toContain("denied");
	}, 60_000);

	// spec: container-image/a-file-shipped-at-a-mount-point
	test.each(["snapshot", "icons"])(
		"%s is in the image and holds nothing",
		(name) => {
			// The context this image is built from plants a file under each, so
			// an empty directory here is an exclusion that worked rather than a
			// developer who happened to have run neither the export nor the
			// ingest.
			expect(holds(`${app()}/${name}`)).toBe(true);
			const listing = sh(`ls -A ${app()}/${name}`);
			expect(listing.stdout.toString().trim()).toBe("");
		},
	);

	// spec: container-image/a-volume-mounted-where-the-image-holds-no-directory
	test.each(["snapshot", "icons"])(
		"%s is owned by the container's user",
		(name) => {
			// Compared against the user the container actually runs as rather than
			// against the name `bun`: the two agree today, and if the image ever
			// switches user this asks the question that matters instead of the one
			// that was true when it was written.
			const owner = sh(`stat -c %U ${app()}/${name}`).stdout.toString().trim();
			const user = sh("id -un").stdout.toString().trim();
			expect(owner).toBe(user);
		},
	);
});
