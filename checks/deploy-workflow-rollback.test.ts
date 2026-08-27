/**
 * Whether the way back from a release is written down.
 *
 * The tag pair exists so a rollback is a change of one value; this is what
 * makes that value findable. One passage, not four mentions scattered through
 * the file — a rollback named in one place and its command in another is a
 * procedure the reader has to assemble while the site is down — and it has to
 * name the repository the workflow actually pushes to, or a rename leaves a
 * README every other word of which still reads true.
 */
import { describe, expect, test } from "bun:test";
import {
	built,
	deployed,
	imageOf,
	names,
	REFERENCE,
	ROLLBACK,
} from "./deploy-workflow.fixture.ts";

/** What is wrong with the README's rollback, and nothing when nothing is. */
export function problems(deploy: string, readme: string): string[] {
	const image = imageOf(deploy);
	const named = readme.split(/\n\s*\n/).some(
		(block) =>
			/roll ?back/i.test(block) &&
			block.includes(REFERENCE) &&
			block.includes("docker compose") &&
			// Degrades rather than throws on a workflow naming no image:
			// `checks/deploy-workflow-tags.test.ts` is what reports that, and
			// reporting it twice tells the reader there are two faults.
			(!image || names(block, image)),
	);
	return named
		? []
		: [
				`README: no passage names the rollback with ${REFERENCE}, ${image ?? "the image"} and the command`,
			];
}

// spec: deploy-workflow/a-release-that-has-to-be-undone
describe("the rollback in the README", () => {
	const message = `README: no passage names the rollback with ${REFERENCE}, laidrivm/d2ass and the command`;

	test("a passage naming the value, the image and the command passes", () => {
		expect(problems(built(), ROLLBACK)).toEqual([]);
	});

	test("a passage naming neither the value nor the command fails", () => {
		const vague = "# d2ass\n\nA bad release can be rolled back.\n";
		expect(problems(built(), vague)).toEqual([message]);
	});

	test("a passage naming a different image repository fails", () => {
		const stale = ROLLBACK.replace("laidrivm/d2ass", "laidrivm/d2ass-old");
		expect(problems(built(), stale)).toEqual([message]);
	});

	test("the two spread across separate passages fails", () => {
		const split = `# d2ass\n\nRoll back if a release is bad.\n\n${REFERENCE} names the image; docker compose up -d.\n`;
		expect(problems(built(), split)).toEqual([message]);
	});
});

// spec: deploy-workflow/a-release-that-has-to-be-undone
test("this repository passes", () => {
	const { workflow, readme } = deployed();
	expect(problems(workflow, readme)).toEqual([]);
});
