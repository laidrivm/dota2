/**
 * What the production stage installs, and who the container runs as.
 *
 * Three of the four cases read a built image; the flags are read from the
 * `Dockerfile` itself, and deliberately. `--ignore-scripts` has no consequence
 * the other cases reach — an install script that ran during the build leaves
 * every assertion here true — so the only place it is observable is the
 * command that was written.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	available,
	buildsImage,
	buildWith,
	holds,
	requiresDocker,
	sh,
} from "./docker.fixture.ts";

/** The repository root: this file reads artefacts of it, from `checks/`. */
const root = join(import.meta.dir, "..");

/** Where the image's `WORKDIR` puts everything the context sent. */
const app = "/app";

requiresDocker();

/**
 * The production stage's install command, read out of the `Dockerfile`.
 *
 * The stage is found by its name rather than by position: a `Dockerfile` that
 * gains a stage would otherwise have this reading whichever one happens to be
 * last, and reporting on the wrong install is worse than reporting on none.
 */
function productionInstall(dockerfile?: string): string {
	const lines = (
		dockerfile ?? readFileSync(`${root}/Dockerfile`, "utf8")
	).split("\n");
	const start = lines.findIndex((line) =>
		/^FROM\s.*\sAS\s+production$/i.test(line),
	);
	if (start === -1)
		throw new Error("the Dockerfile declares no production stage");
	const rest = lines.slice(start + 1);
	// Up to the next stage, so a later one's install is not read as this one's.
	const end = rest.findIndex((line) => /^FROM\s/i.test(line));
	const stage = end === -1 ? rest : rest.slice(0, end);
	const install = stage.find((line) => /^RUN\s+bun\s+install\b/.test(line));
	if (install === undefined)
		throw new Error("the production stage runs no bun install");
	return install;
}

// spec: container-image/the-install-command-the-production-stage-runs
describe("the install command the production stage runs", () => {
	test.each(["--frozen-lockfile", "--production", "--ignore-scripts"])(
		"carries %s",
		(flag) => {
			expect(productionInstall()).toContain(flag);
		},
	);

	// The reading itself, because every assertion above rests on it having
	// found the right line: one that answered with a later stage's install, or
	// with nothing, reports on something else while looking correct.
	test("is read from the production stage, not from a later one", () => {
		const install = productionInstall(
			[
				"FROM base AS production",
				"RUN bun install --frozen-lockfile --production --ignore-scripts",
				"FROM base AS tooling",
				"RUN bun install --some-other-way",
			].join("\n"),
		);
		expect(install).toContain("--ignore-scripts");
		expect(install).not.toContain("--some-other-way");
	});

	test.each([
		["declares no production stage", "FROM base AS build\nRUN bun install\n"],
		["runs no bun install", 'FROM base AS production\nCMD ["bun", "x"]\n'],
	])("refuses a Dockerfile that %s", (_what, dockerfile) => {
		// Thrown rather than answered with an empty string: a caller that got
		// one back would assert `toContain` against it and fail with the flag's
		// name, sending a reader to the wrong line entirely.
		expect(() => productionInstall(dockerfile)).toThrow();
	});
});

describe.skipIf(!available)("the production image", () => {
	buildsImage();

	// spec: container-image/the-running-process-is-not-root
	test("runs as a user that is not root", () => {
		// Both the name and the id: `USER 0` and a user named `root` are the
		// same privilege reached two ways, and each reads as the other's
		// absence.
		expect(sh("id -u").stdout.toString().trim()).not.toBe("0");
		expect(sh("id -un").stdout.toString().trim()).not.toBe("root");
	});

	// spec: container-image/a-development-dependency-in-the-image
	test("holds no package listed only under devDependencies", () => {
		const manifest = JSON.parse(
			readFileSync(`${root}/package.json`, "utf8"),
		) as { devDependencies: Record<string, string> };
		const dev = Object.keys(manifest.devDependencies);
		// Read from the manifest rather than named here: a devDependency added
		// later joins this case without anybody remembering to add it.
		expect(dev.length).toBeGreaterThan(0);
		const present = dev.filter((name) => holds(`${app}/node_modules/${name}`));
		expect(present).toEqual([]);
	});
});

// spec: container-image/a-manifest-the-lockfile-does-not-match
describe.skipIf(!available)("a manifest the lockfile does not match", () => {
	test("fails the build rather than resolving the dependency afresh", () => {
		const manifest = JSON.parse(
			readFileSync(`${root}/package.json`, "utf8"),
		) as { dependencies: Record<string, string> };
		// A version the lockfile cannot be carrying, on a package that is
		// really there: bumping the major of an existing entry is what
		// `--frozen-lockfile` exists to refuse, where an invented package
		// name would fail for not existing at all.
		manifest.dependencies.preact = "10.29.7";
		const build = buildWith({
			"package.json": JSON.stringify(manifest, null, "\t"),
		});
		expect(build.exitCode).not.toBe(0);
		// Named, so a build failing for some later unrelated reason is not
		// read as this refusal.
		expect(build.stderr).toContain("lockfile");
	}, 900_000);
});
