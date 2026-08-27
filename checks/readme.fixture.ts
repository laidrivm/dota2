/**
 * The README, and its fenced blocks by the language they are tagged with.
 *
 * Three checks read a value out of this file — the schedule's entry, the
 * command that installs it, and the virtual host the proxy is configured
 * from — and each of them wants the block a reader copies rather than the
 * file at large. A value matched anywhere in the prose is a value that can
 * still be right while the example carrying it is gone.
 *
 * The tag is what selects, because the alternative is a heading or a
 * position: a section renamed leaves this reading the same block, and a
 * second block of the same kind is an ambiguity worth failing on rather than
 * resolving by taking the first.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The repository root: this file reads an artefact of it, from `checks/`. */
const root = join(import.meta.dir, "..");

/** The file itself, for the checks that are about its prose. */
export const README = readFileSync(join(root, "README.md"), "utf8");

/** Every fenced block tagged `language`, in the order they appear. */
export const fenced = (language: string) =>
	[...README.matchAll(/```([a-z]*)\n([\s\S]*?)```/g)]
		.filter((block) => block[1] === language)
		.map((block) => (block[2] as string).trim());

/**
 * The one block tagged `language` that holds `holds`, or a throw naming which
 * of the two went wrong.
 *
 * Both halves are needed and neither is enough. The tag alone does not
 * separate two shell blocks; the content alone does not separate an example
 * from the prose around it, nor a block from the command that quotes it.
 */
export function only(language: string, holds: string): string {
	const tagged = fenced(language);
	if (tagged.length === 0)
		throw new Error(`the README carries no \`\`\`${language} block`);
	const found = tagged.filter((block) => block.includes(holds));
	if (found.length !== 1)
		throw new Error(
			`expected one \`\`\`${language} block holding ${holds}, found ${found.length} of ${tagged.length}`,
		);
	return found[0] as string;
}
