/**
 * The crontab entry the README names, read as its parts.
 *
 * It is read out of the README rather than written again here, because the
 * README is where an operator installs it from: a copy would drift, and the
 * drift would be invisible — the copy would go on passing while the line
 * actually pasted into a crontab did something else.
 *
 * `checks/schedule.fixture.ts` is what runs it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The repository root: this file reads an artefact of it, from `checks/`. */
const root = join(import.meta.dir, "..");

/**
 * The entry, taken from the README's one fenced block tagged `crontab`.
 *
 * By the tag rather than by a heading, a position, or a token in the line: a
 * section renamed or moved leaves this reading the same block, and the README
 * also shows a shell command that installs the entry — which quotes it, and so
 * carries every token the entry does. The tag is what says which of the two is
 * the thing cron reads.
 */
export const ENTRY = (() => {
	const found = [
		...readFileSync(join(root, "README.md"), "utf8").matchAll(
			/```([a-z]*)\n([\s\S]*?)```/g,
		),
	]
		.filter((block) => block[1] === "crontab")
		.map((block) => (block[2] as string).trim());
	if (found.length !== 1)
		throw new Error(
			`expected one fenced block tagged crontab in the README, found ${found.length}`,
		);
	return found[0] as string;
})();

/** The five schedule fields, and the command they run. */
const stated = /^((?:\S+\s+){5})(.+)$/s.exec(ENTRY);
if (!stated)
	throw new Error(`the entry states no schedule and command: ${ENTRY}`);

/** When the entry fires, as crontab's five fields. */
export const SCHEDULE = (stated[1] as string).trim();

/** What it runs when it does. */
export const COMMAND = stated[2] as string;

/** One path the entry names, or a throw saying which one it does not. */
const path = (what: string, pattern: RegExp) => {
	const found = pattern.exec(COMMAND);
	if (!found) throw new Error(`the entry names no ${what}: ${COMMAND}`);
	return found[1] as string;
};

/**
 * The lock the exclusion is held on: `flock`'s last argument before the
 * command it runs, rather than a token matched by its extension — the
 * exclusion works whatever the file is called, and a pattern that insists on a
 * name is a check on the name.
 */
export const LOCK = path("lock file", /\bflock\s+(?:\S+\s+)*?(\S+)\s+docker\b/);

/** The file the record is appended to. */
export const LOG = path("log file", />>\s*(\S+)/);

/** The project file the invocation runs the job from. */
export const FILE = path("compose file", /\bdocker\s+compose\b.*?\s-f\s+(\S+)/);
