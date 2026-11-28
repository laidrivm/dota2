/**
 * The CM engine's import boundary, read through the linter that enforces it:
 * a module under `src/cm/engine/` may import the model and its types, never
 * the All Pick application or the CM page's own interface. The probe sits
 * where the rule's `includes` reach, because the rule is scoped by path and a
 * file elsewhere would pass it vacuously.
 */
import { expect, test } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { root } from "./root.ts";

/** Biome's exit code and rule names for one module importing `from`. */
function lint(from: string) {
	const probe = join(root, "src", "cm", "engine", `zz-probe-${process.pid}.ts`);
	writeFileSync(
		probe,
		`import * as m from "${from}";\n\nexport const x = m;\n`,
	);
	try {
		const run = Bun.spawnSync(
			["bunx", "--no-install", "biome", "lint", probe],
			{ cwd: root, stdout: "pipe", stderr: "pipe" },
		);
		const output = `${run.stdout.toString()}${run.stderr.toString()}`;
		return { code: run.exitCode, rules: output.match(/lint\/[\w/]+/g) ?? [] };
	} finally {
		rmSync(probe, { force: true });
	}
}

// spec: module-boundaries/the-cm-engine-reaches-into-its-page
test.each([["../ui/session.ts"], ["../../app/cx.ts"]])(
	"an engine module importing %s is refused",
	(from) => {
		expect(lint(from)).toEqual({
			code: 1,
			rules: ["lint/style/noRestrictedImports"],
		});
	},
	// One biome run measured 0.2 s idle; four times that under load, rounded up.
	15_000,
);

// spec: module-boundaries/the-cm-engine-reaches-into-its-page
test.each([["../../model.ts"], ["../../types.ts"], ["./order.ts"]])(
	"an engine module importing %s passes",
	(from) => {
		expect(lint(from)).toEqual({ code: 0, rules: [] });
	},
	15_000,
);
