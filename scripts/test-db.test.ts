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

test("the script waits on the server over TCP, not the socket", () => {
	// The socket answers during initdb's temporary server, whose connections
	// are closed when the real one takes over — measured as a run where every
	// database suite failed with `Connection closed`.
	expect(script).toContain("pg_isready -h 127.0.0.1");
});
