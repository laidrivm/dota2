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

test("the script fails rather than running an unpinned image", () => {
	expect(script).toContain("no pinned postgres image");
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
	expect(script).toContain("pg_isready -h 127.0.0.1");
});
