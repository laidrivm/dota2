#!/usr/bin/env bun
/**
 * Fails when a tracked source file carries a linter or type-checker
 * suppression. The rule it replaces has an escape hatch — a suppression is
 * allowed once the user approves it — and a grep cannot see approval, so the
 * approval is a line of this file's allowlist and therefore a line of the diff.
 *
 * Only the extensions a linter or a type-checker acts on are read. Prose names
 * these markers while explaining the rule — this change's own artefacts do,
 * three times over — and a check that fails on the proposal introducing it is a
 * check nobody keeps.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MARKERS = ["biome-ignore", "@ts-expect-error", "@ts-ignore"];

const EXTENSIONS = [".ts", ".tsx", ".json"];

/**
 * This script and its test, excluded by path rather than by allowlist entry:
 * both must spell the three markers out to do their job, and an entry would
 * pin a count that every added test case then has to re-approve.
 */
const SELF = ["scripts/no-suppressions.ts", "scripts/no-suppressions.test.ts"];

/**
 * Approved suppressions, keyed by `<path> <marker>` and valued by how many
 * occurrences of that marker are approved there, with the reason as a comment
 * beside the entry. The count is what stops a second suppression riding in on
 * the first one's approval; the marker in the key is what stops a suppression
 * of one kind being swapped for another on the first one's approval.
 *
 * The markers are named here only as string literals, never in prose: Biome's
 * `suspicious/noTsIgnore` reads a comment as a directive wherever it sits, and
 * `biome check --write` rewrote this very sentence when it spelled one out.
 */
const APPROVED: Record<string, number> = {};

export type Finding = { path: string; line: number; marker: string };

/**
 * Every suppression in the work tree at `cwd` that `approved` does not admit.
 * Tracked files only, so an ignored or untracked file cannot fail a clone that
 * does not have it.
 */
export function scan(cwd?: string, approved = APPROVED): Finding[] {
	const ls = Bun.spawnSync(["git", "ls-files", "-z"], { cwd });
	if (ls.exitCode !== 0) throw new Error(ls.stderr.toString());

	const found = new Map<string, Finding[]>();
	for (const path of ls.stdout.toString().split("\0")) {
		if (!EXTENSIONS.some((ext) => path.endsWith(ext))) continue;
		if (SELF.includes(path)) continue;
		const full = join(cwd ?? ".", path);
		if (!existsSync(full)) continue; // tracked, deleted in the work tree
		readFileSync(full, "utf8")
			.split("\n")
			.forEach((text, at) => {
				for (const marker of MARKERS) {
					if (!text.includes(marker)) continue;
					const key = `${path} ${marker}`;
					found.set(key, [
						...(found.get(key) ?? []),
						{ path, line: at + 1, marker },
					]);
				}
			});
	}

	const unapproved: Finding[] = [];
	for (const [key, list] of found) {
		if (list.length > (approved[key] ?? 0)) unapproved.push(...list);
	}
	return unapproved;
}

if (import.meta.main) {
	const unapproved = scan();
	for (const { path, line, marker } of unapproved) {
		console.error(`${path}:${line}: ${marker}`);
	}
	if (unapproved.length) process.exit(1);
}
