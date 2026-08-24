import { expect, test } from "bun:test";
import { join } from "node:path";

/**
 * The shape every check that lists the tracked tree has to take, pinned once
 * rather than argued in each of them.
 *
 * `git ls-files` reports only what is under the directory it ran in and names
 * it relative to that directory. A check that lists where it happens to sit is
 * therefore correct only while it sits at the root — correct by accident, and
 * the accident ends at the next move. `readme-map.test.ts` was exactly that
 * until it moved into `checks/`.
 */

/** The listing an anchored check takes: resolve the root, then list there. */
const anchored = (cwd: string): string[] => {
	const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], { cwd });
	if (top.exitCode !== 0) throw new Error(top.stderr.toString());
	const ls = Bun.spawnSync(["git", "ls-files", "-z"], {
		cwd: top.stdout.toString().trim(),
	});
	if (ls.exitCode !== 0) throw new Error(ls.stderr.toString());
	// `-z` terminates rather than separates, so the last field is empty.
	return ls.stdout.toString().split("\0").filter(Boolean);
};

/** The listing an unanchored one takes, which is the mistake being ruled out. */
const naive = (cwd: string): string[] => {
	const ls = Bun.spawnSync(["git", "ls-files", "-z"], { cwd });
	if (ls.exitCode !== 0) throw new Error(ls.stderr.toString());
	return ls.stdout.toString().split("\0").filter(Boolean);
};

const here = import.meta.dir;

/** The three listings, taken once: each helper call is two git processes. */
const fromHere = anchored(here);
const fromRoot = anchored(join(here, ".."));
const short = naive(here);

// spec: repo-layout/a-check-run-from-a-subdirectory
test("a listing taken below the root is the whole repository", () => {
	expect(fromHere).toEqual(fromRoot);
});

// spec: repo-layout/a-check-run-from-a-subdirectory
test("its paths are named from the root, not from where it ran", () => {
	// The half the equality above would satisfy anyway if git ever named paths
	// relative to the caller. Taken off the unanchored listing rather than
	// written out, so a rename in `checks/` cannot make this pass by naming a
	// file that is simply absent from both.
	const [neighbour] = short;
	expect(neighbour).toBeDefined();

	expect(fromHere).toContain(`checks/${neighbour}`);
	// The second assertion reads the bare name as a root-level path, so it
	// says what it means only while the root tracks no file of that basename.
	expect(fromHere).not.toContain(neighbour);
});

test("the unanchored listing is the mistake, not a second way of writing it", () => {
	// Without this the two helpers above could agree and the anchoring would
	// be cargo. What it pins is that `cwd` really does decide the answer, so a
	// check that skips the resolve is measurably reading a different tree.
	expect(short.length).toBeLessThan(fromRoot.length);
});
