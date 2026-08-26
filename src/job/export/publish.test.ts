/**
 * How a bundle reaches the name the route serves, and what is left behind when
 * it does not.
 *
 * Read over real directories under the system's temp root: what the
 * requirement rests on is a rename the kernel performs, and a stubbed
 * filesystem would be a promise about the stub.
 *
 * The read-during-publication case is not written as a read loop. Measured
 * against bun 1.3.14 at eight megabytes: a write straight to the served name
 * was never once caught half done from outside, so a loop would pass against
 * the implementation the criterion exists to refuse — the same measurement
 * `icons.ts` already records for the mirror. What separates the two is which
 * file the name ends up pointing at, which is read below instead.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SQL } from "bun";
import rawFixture from "../../fixtures/snapshot.json" with { type: "json" };
import type { SnapshotBundle } from "../../types.ts";
import { exportSnapshot, PART, PUBLISHED, publishBundle } from "./publish.ts";

const fixture = rawFixture as unknown as SnapshotBundle;

const made: string[] = [];
afterAll(() => {
	for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

/** A publication directory of its own, removed when the file finishes. */
const emptyDir = () => {
	const dir = mkdtempSync(join(tmpdir(), "d2ass-publish-"));
	made.push(dir);
	return dir;
};

/** The shipped bundle under a given id, so two publications differ. */
const numbered = (snapshotId: number): SnapshotBundle => ({
	...fixture,
	snapshotId,
});

/** What the served name holds, parsed. */
const served = async (dir: string) =>
	JSON.parse(await Bun.file(join(dir, PUBLISHED)).text());

/** The names the directory holds, temporary ones included. */
const held = (dir: string) => readdirSync(dir).sort();

// spec: snapshot-export/a-read-during-publication
describe("how a bundle reaches the served name", () => {
	test("a publication replaces the served file rather than rewriting it [31]", async () => {
		const dir = emptyDir();
		await publishBundle(dir, numbered(1));
		const before = statSync(join(dir, PUBLISHED)).ino;

		await publishBundle(dir, numbered(2));

		// A rename points the name at a different file; a write to the name in
		// place keeps the file and passes through a state where its bytes are
		// neither bundle. Measured: rewriting a path leaves its inode
		// untouched, so this is the assertion a direct write fails.
		expect(statSync(join(dir, PUBLISHED)).ino).not.toBe(before);
		// The whole bundle rather than its id: what the route serves is these
		// bytes, and a write that dropped or reshaped the rest of them would
		// leave the id alone. Compared against the bundle *as JSON carries
		// it*, because that is what a reader gets — JSON has no negative zero
		// and the fixture holds several, so the object itself is not what
		// comes back and never could be.
		expect(await served(dir)).toEqual(JSON.parse(JSON.stringify(numbered(2))));
	});

	test("a publication that fails before its rename leaves the last one [44]", async () => {
		const dir = emptyDir();
		await publishBundle(dir, numbered(1));
		// A directory where the write wants a file: no write can replace it,
		// which is the closest thing to a crash the filesystem reproduces on
		// demand.
		mkdirSync(join(dir, PART));

		await publishBundle(dir, numbered(2)).then(
			() => expect.unreachable(),
			() => {},
		);

		// The served name still points at the file the first publication left,
		// because nothing touched it — which is what a reader taking the URL
		// during the failed run gets.
		expect((await served(dir)).snapshotId).toBe(1);
	});

	test("a publication that crashes leaves the directory holding no bundle [43]", async () => {
		const dir = emptyDir();
		mkdirSync(join(dir, PART));

		await publishBundle(dir, numbered(1)).then(
			() => expect.unreachable(),
			() => {},
		);

		// What the route resolves is the served name, and it was never
		// created: the wreck sits under a name nothing looks up, and a dotfile
		// at that, which keeps it out of a glob and out of a shell's `*` too.
		expect(await Bun.file(join(dir, PUBLISHED)).exists()).toBe(false);
		expect(held(dir)).toEqual([PART]);
	});
});

// spec: snapshot-export/nothing-has-ever-been-published
test("an export with nothing published writes no file [27]", async () => {
	const dir = emptyDir();
	// Every read the render takes answers with no rows, which is what a
	// database holding no published snapshot answers the first of them.
	const empty = (() => Promise.resolve([])) as unknown as SQL;

	await exportSnapshot(empty, dir).then(
		() => expect.unreachable(),
		(error: Error) =>
			expect(error.message).toContain("no snapshot has published"),
	);

	// The other half of the criterion, and the half group 5 could not reach:
	// there is a write now, and it did not happen — not even the temporary one.
	expect(held(dir)).toEqual([]);
});
