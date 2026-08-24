/**
 * The permission policy the tests read: the tracked settings and the four
 * slices of them every file here works from.
 *
 * Its own module because the policy areas split across three files and all of
 * them start from the same file on disk. A copy per file would let one of them
 * read `.claude/settings.local.json` or a stale slice while the others passed.
 * `settings` itself is exported for the one assertion that reads `hooks`
 * rather than a permission list.
 */

import { join } from "node:path";

/** The repository root: this module reads an artefact of it, from `checks/`. */
export const root = join(import.meta.dir, "..");

/**
 * The tracked settings, never `.claude/settings.local.json` — that one is
 * gitignored, so it is present for the author and absent in a clone.
 */
export const settings = await Bun.file(`${root}/.claude/settings.json`).json();

/** Every package manager this project does not use. */
export const managers = ["npx", "npm", "pnpm", "yarn"];

export const deny: string[] = settings.permissions?.deny ?? [];
export const ask: string[] = settings.permissions?.ask ?? [];
export const allow: string[] = settings.permissions?.allow ?? [];

/**
 * The command rules. Both lists also carry file rules, whose specifier is a
 * path and not a command line, so every assertion that reads an entry word by
 * word takes this subset rather than the list.
 */
export const bashDeny = deny.filter((entry) => entry.startsWith("Bash("));
export const bashAsk = ask.filter((entry) => entry.startsWith("Bash("));
