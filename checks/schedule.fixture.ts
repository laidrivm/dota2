/**
 * The crontab entry the README names, run here against a project of this
 * file's own.
 *
 * The entry is read out of the README rather than written again, because the
 * README is where an operator installs it from: a copy here would drift, and
 * the drift would be invisible — the copy would go on passing while the line
 * actually pasted into a crontab did something else.
 *
 * Three values in it are the host's and cannot be this run's: the lock, the
 * log and the project file. Each is replaced with one under a temporary
 * directory and nothing else about the line is touched, so what executes is
 * the entry's own `date`, its own `flock` and its own `docker compose`.
 *
 * `flock` is util-linux, which macOS does not ship, so these cases skip on a
 * developer's machine there. `requiresSchedule` is what turns the same skip in
 * the CI job that owns them into a failure.
 */
import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { available, DOCKER_ENV, image, tidy } from "./docker.fixture.ts";

/** The repository root: this file reads an artefact of it, from `checks/`. */
const root = join(import.meta.dir, "..");

/** How long one invocation of the entry may take. */
const INVOKE_MS = 180_000;

/** How long a probe of the host's own tools may take. */
const PROBE_MS = 10_000;

/**
 * The entry, taken from the one fenced block in the README that names `flock`.
 *
 * Found by that token rather than by a heading or a position: a section
 * renamed or moved leaves this reading the same line, and two blocks naming it
 * is an ambiguity worth a failure rather than a guess.
 */
export const ENTRY = (() => {
	const found = [
		...readFileSync(join(root, "README.md"), "utf8").matchAll(
			/```[a-z]*\n([\s\S]*?)```/g,
		),
	]
		.map((block) => (block[1] as string).trim())
		.filter((block) => block.includes("flock"));
	if (found.length !== 1)
		throw new Error(
			`expected one fenced block naming flock in the README, found ${found.length}`,
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

/**
 * Whether the host can run the entry at all.
 *
 * Both tools are probed rather than the platform named: a machine with
 * util-linux installed runs these cases, and one without it skips them for the
 * reason that is actually true of it.
 */
export const schedulable =
	available &&
	["flock --version", "date -Iseconds"].every(
		(probe) =>
			Bun.spawnSync(["sh", "-c", probe], {
				stdout: "ignore",
				stderr: "ignore",
				timeout: PROBE_MS,
			}).exitCode === 0,
	);

/**
 * Declare that this file's cases are not allowed to skip in CI.
 *
 * The same bargain `requiresDocker` makes, over the tools the entry needs
 * beside a daemon: `scripts/test-docker.sh` sets `DOCKER_REQUIRED`, and a
 * runner without `flock` fails here rather than reporting a green run in which
 * the schedule was never exercised.
 */
export const requiresSchedule = () =>
	test("the job that requires docker is given flock and an ISO date", () => {
		expect(Bun.env.DOCKER_REQUIRED === "1" && !schedulable).toBe(false);
	});

/** Fixed, as the image tag is: a name reused is a project replaced. */
const PROJECT = "d2ass-checks-schedule";

let home: string | undefined;

/** Where this run keeps its lock, its log and its stand-in project. */
const directory = () =>
	(home ??= mkdtempSync(join(tmpdir(), "d2ass-schedule-")));

/**
 * A project whose `job` service is `script`, written where the entry can be
 * pointed at it.
 *
 * The deployment's own job needs a database, a key and a network to say
 * anything, and says nothing about a status it cannot be made to exit with —
 * a run that completes, a run that fails at a step, a run still going. This is
 * how each of those is arranged.
 *
 * Written as JSON, which YAML is a superset of, so compose reads it and no
 * script inside needs quoting to survive the file.
 */
export function standIn(script: string) {
	const file = join(directory(), "docker-compose.yml");
	writeFileSync(
		file,
		JSON.stringify({
			services: { job: { image: image(), entrypoint: ["sh", "-c", script] } },
		}),
	);
	return file;
}

/** A path under this run's directory, for a lock or a log. */
export const under = (name: string) => join(directory(), name);

/** The entry's command with the host's three paths replaced by this run's. */
function tailored(file: string, log: string) {
	let command = COMMAND;
	for (const [was, now] of [
		[LOCK, under("run.lock")],
		[LOG, log],
		[FILE, file],
	]) {
		const parts = command.split(was as string);
		// Exactly one, asserted rather than assumed: a replacement matching
		// nothing leaves the host's own path in the line, and the case would
		// then write to the deployment's log or lock the deployment's file.
		if (parts.length !== 2)
			throw new Error(`expected one ${was} in the entry: ${COMMAND}`);
		command = parts.join(now as string);
	}
	return command;
}

/**
 * The environment an invocation runs under.
 *
 * `COMPOSE_PROJECT_NAME` because the entry names no project and compose
 * derives one from the directory holding the file — which here is a fresh
 * temporary name per run, leaving nothing to address the containers by
 * afterwards or to take away.
 */
const scheduleEnv = (project: string) => ({
	...DOCKER_ENV,
	COMPOSE_PROJECT_NAME: project,
});

/** Run the entry once against `file`, and wait for it. */
export function invoke(file: string, log: string, project = PROJECT) {
	const run = Bun.spawnSync(["sh", "-c", tailored(file, log)], {
		stdout: "pipe",
		stderr: "pipe",
		timeout: INVOKE_MS,
		cwd: directory(),
		env: scheduleEnv(project),
	});
	if (run.exitedDueToTimeout)
		throw new Error(`the entry did not finish within ${INVOKE_MS}ms`);
	return run;
}

/**
 * Start the entry without waiting, for the cases about a run in flight.
 *
 * Output is discarded rather than piped: the entry redirects its own into the
 * log, and a pipe nobody reads blocks the process this is meant to leave
 * running.
 */
export const start = (file: string, log: string) =>
	Bun.spawn(["sh", "-c", tailored(file, log)], {
		stdout: "ignore",
		stderr: "ignore",
		cwd: directory(),
		env: scheduleEnv(PROJECT),
	});

/**
 * Kill everything the run is made of, giving none of it a chance to release
 * anything.
 *
 * By this run's directory, which every one of its processes carries on its
 * command line — the shell has the whole command, `flock` has what follows it,
 * and the `docker compose` under that has the project file — and which nothing
 * else on the machine has.
 *
 * All three rather than the two the lock's own path would match, measured:
 * `flock` opens the lock and *inherits it down*, so the command it starts holds
 * the same descriptor. Killing the shell and `flock` alone leaves the docker
 * client holding the lock, and the next invocation is refused — which is the
 * scenario passing for the reason it exists to rule out.
 */
export const killRun = () =>
	Bun.spawnSync(["pkill", "-9", "-f", directory()], {
		stdout: "ignore",
		stderr: "ignore",
		timeout: PROBE_MS,
	});

/** This run's containers, of any state, as `id state` lines. */
export function containers(project = PROJECT, service?: string) {
	const filters = [`label=com.docker.compose.project=${project}`];
	if (service) filters.push(`label=com.docker.compose.service=${service}`);
	const read = Bun.spawnSync(
		[
			"docker",
			"ps",
			"-a",
			...filters.flatMap((filter) => ["--filter", filter]),
			"--format",
			"{{.ID}} {{.State}}",
		],
		{ stdout: "pipe", stderr: "pipe", timeout: PROBE_MS, env: DOCKER_ENV },
	);
	if (read.exitCode !== 0)
		throw new Error(`docker ps failed:\n${read.stderr.toString()}`);
	return read.stdout.toString().trim().split("\n").filter(Boolean);
}

/** Wait until exactly one container is running, and answer with it. */
export function inFlight() {
	for (let attempt = 0; attempt < 300; attempt++) {
		const running = containers().filter((line) => line.endsWith(" running"));
		if (running.length === 1) return running[0] as string;
		Bun.sleepSync(200);
	}
	throw new Error(`no single run ever started: ${containers().join(", ")}`);
}

/** What one invocation left in the record. */
export type Record = { at: string; body: string[]; status: number };

/**
 * The log read as the invocations that wrote it: each one's instant, whatever
 * its run wrote, and the status it ended with.
 *
 * Split on the status line, which is the entry's own last word for a run —
 * the instant is the line after it, so nothing has to know how many lines a
 * report takes.
 */
export function records(log: string): Record[] {
	const found: Record[] = [];
	let lines: string[] = [];
	for (const line of readFileSync(log, "utf8").split("\n")) {
		const ended = /^exit (\d+)$/.exec(line);
		if (!ended) {
			if (line.trim() !== "") lines.push(line);
			continue;
		}
		const [at = "", ...body] = lines;
		found.push({ at, body, status: Number(ended[1]) });
		lines = [];
	}
	return found;
}

/** Take this run's project and its directory away. */
export function clean() {
	if (!home) return;
	if (available)
		tidy(
			"compose",
			"-p",
			PROJECT,
			"-f",
			join(home, "docker-compose.yml"),
			"down",
			"--remove-orphans",
		);
	rmSync(home, { recursive: true, force: true });
	home = undefined;
}
