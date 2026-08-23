/**
 * What `scripts/test-db.sh` reads out of the workflow, and the two shapes it
 * would silently misread.
 *
 * The script takes its Postgres image from `test.yml` rather than pinning a
 * second copy, so what has to hold is that the workflow keeps carrying exactly
 * one such pin in the shape the script's `sed` matches.
 */
import { expect, test } from "bun:test";

const root = `${import.meta.dir}/..`;
const workflow = await Bun.file(`${root}/.github/workflows/test.yml`).text();
const script = await Bun.file(`${root}/scripts/test-db.sh`).text();

/** The script's own expression, so the two cannot drift apart. */
const extract = (text: string) =>
	text
		.split("\n")
		.map((line) => /image: (postgres:[^ ]*)/.exec(line)?.[1])
		.filter((found) => found !== undefined);

test("the workflow carries exactly one pinned postgres image", () => {
	const found = extract(workflow);

	// One, because the script takes the first match: a second would make which
	// image it runs a question of line order.
	expect(found).toHaveLength(1);
	expect(found[0]).toMatch(/^postgres:[\w.-]+@sha256:[0-9a-f]{64}$/);
});

test("a workflow naming no image yields nothing to run", () => {
	// The branch the script turns into a named failure rather than handing
	// `docker run` an empty argument.
	expect(extract("      ports:\n        - 5432:5432\n")).toEqual([]);
});

test("the script's own pattern refuses a mutable tag", () => {
	// Read out of the script rather than restated, so weakening it there is
	// what fails here.
	const declared = /^PINNED='(.+)'$/m.exec(script)?.[1];
	expect(declared).toBeDefined();
	const pinned = new RegExp(declared as string);

	// A tag names whatever it points at today, which is what a digest is for.
	expect(pinned.test("postgres:18-alpine")).toBe(false);
	expect(pinned.test("postgres:18-alpine@sha256:")).toBe(false);
	expect(pinned.test(`postgres:18-alpine@sha256:${"d".repeat(63)}`)).toBe(
		false,
	);
	expect(pinned.test(`postgres:18-alpine@sha256:${"d".repeat(64)}`)).toBe(true);
	// And what the workflow actually carries clears it, so the two cannot
	// drift into a script that refuses the image CI runs.
	expect(pinned.test(extract(workflow)[0] as string)).toBe(true);
});

test("the service container's own probe goes over TCP too", () => {
	// Held here because nothing else would notice it being put back: the
	// workflow's own YAML parses either way, and CI would go on passing on the
	// seconds its checkout and install happen to take.
	const parsed = Bun.YAML.parse(workflow) as {
		jobs: Record<string, { services?: { postgres?: { options?: string } } }>;
	};
	// Every job carrying one, not the first: naming the job would tie this to
	// a rename, and taking the first would pass while a second job kept the
	// probe this exists to remove.
	const probes = Object.values(parsed.jobs)
		.map((job) => job.services?.postgres?.options)
		.filter((options) => options !== undefined);

	// Non-empty first, so a service deleted outright cannot pass by vacuity.
	expect(probes).not.toEqual([]);
	// Anchored at the start, so a comment folded into the block scalar is
	// caught: `#` inside `>-` is text, not a comment, and `bun run lint:yaml`
	// passes over the folded form exactly as it does over this one.
	for (const options of probes)
		expect(options).toStartWith('--health-cmd "pg_isready -h 127.0.0.1"');
});

test("the script waits on the server over TCP, not the socket", () => {
	// The socket answers during initdb's temporary server, whose connections
	// are closed when the real one takes over — measured as a run where every
	// database suite failed with `Connection closed`.
	//
	// Matched against what the script runs rather than what it says: the
	// invocation is what has to carry the flag, and a comment mentioning it
	// would otherwise satisfy this on its own.
	const runs = script
		.split("\n")
		.filter((line) => !line.trimStart().startsWith("#"))
		.join("\n");

	expect(runs).toContain('docker exec "$name" pg_isready -h 127.0.0.1');
});
