/**
 * The compose project, brought up against the image the other Docker-gated
 * suites build, so what it arranges can be observed rather than read.
 *
 * The project runs from a copy of `docker-compose.yml` in a directory of its
 * own, with an env file this writes. Compose reads a `.env` beside the file it
 * is given, and the repository root holds a developer's own — carrying a real
 * STRATZ key and a real database password — so running it there would hand the
 * test whatever that file happens to say and, worse, make the result depend on
 * a file no clone has. The copy carries values this chose.
 *
 * The shared network is created here when it is absent. On the deployment it
 * is the proxy's and already exists; on a developer's machine and on a CI
 * runner nothing has made one, and `external: true` is a refusal rather than a
 * request.
 */
import {
	copyFileSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { image, tidy } from "./docker.fixture.ts";

/** The repository root: this file reads artefacts of it, from `checks/`. */
const root = join(import.meta.dir, "..");

/** Fixed, for the reason the image tag is: a name reused is a project replaced. */
const PROJECT = "d2ass-checks-compose";

/** How long any one compose call may take. */
const COMPOSE_MS = 300_000;

/** The project file, read once for the two things this addresses it by. */
const project = Bun.YAML.parse(
	readFileSync(`${root}/docker-compose.yml`, "utf8"),
) as {
	services?: Record<string, { container_name?: string }>;
	networks?: Record<string, { external?: boolean } | null>;
};

/** The shared network's name, read from the file rather than written again. */
export const shared = (() => {
	const found = Object.entries(project.networks ?? {})
		.filter(([, config]) => config?.external === true)
		.map(([name]) => name);
	if (found.length !== 1)
		throw new Error(`expected one external network, found ${found.length}`);
	return found[0] as string;
})();

/**
 * What the application answers to on that network — read from the file for the
 * same reason the network is, and because this is the name the deployment's
 * virtual host resolves it by. A copy here would go on naming the old one.
 */
const address = (() => {
	const name = project.services?.app?.container_name;
	if (!name) throw new Error("the app service declares no container_name");
	return name;
})();

let dir: string | undefined;

/** Whether this run created the shared network, and so may remove it. */
let made = false;

/** Where the copied project file and its env file live for this run. */
function directory(): string {
	if (dir) return dir;
	dir = mkdtempSync(join(tmpdir(), "d2ass-compose-"));
	copyFileSync(`${root}/docker-compose.yml`, join(dir, "docker-compose.yml"));
	writeFileSync(
		join(dir, "project.env"),
		[
			`D2ASS_IMAGE=${image()}`,
			// Values this run chose, and nothing reads them anywhere else.
			"POSTGRES_PASSWORD=checks-only",
			"STRATZ_API_KEY=checks-only",
			"",
		].join("\n"),
	);
	return dir;
}

/** Run one compose command against this run's project. */
export function compose(...argv: string[]) {
	const home = directory();
	return Bun.spawnSync(
		[
			"docker",
			"compose",
			"-p",
			PROJECT,
			"-f",
			join(home, "docker-compose.yml"),
			"--env-file",
			join(home, "project.env"),
			...argv,
		],
		{ stdout: "pipe", stderr: "pipe", timeout: COMPOSE_MS, cwd: home },
	);
}

/**
 * Bring the project up and wait until the application is listening.
 *
 * Readiness is the server's own line in the log, not a sleep: the interval
 * that is long enough on this machine is the one that is flaky on a slower
 * runner.
 */
export function up() {
	// Created only where there is none, and remembered, because `down` must not
	// take away what this did not make: on a developer's machine the name may
	// already belong to something else's proxy, and removing it would break
	// whatever was using it in exchange for tidiness. `docker network create`
	// refuses a name that exists, which is what makes its status the answer.
	made =
		Bun.spawnSync(["docker", "network", "create", shared], {
			stdout: "ignore",
			stderr: "ignore",
			timeout: COMPOSE_MS,
		}).exitCode === 0;
	const started = compose("up", "-d");
	if (started.exitCode !== 0)
		throw new Error(`compose up failed:\n${started.stderr.toString()}`);

	for (let attempt = 0; attempt < 300; attempt++) {
		const logs = compose("logs", "app");
		if (logs.stdout.toString().includes("listening on")) return;
		Bun.sleepSync(200);
	}
	throw new Error(
		`the application never listened:\n${compose("logs").stdout.toString()}`,
	);
}

/** Take the project and everything it created away. */
export function down() {
	if (!dir) return;
	compose("down", "-v", "--remove-orphans");
	if (made) tidy("network", "rm", shared);
	made = false;
	rmSync(dir, { recursive: true, force: true });
	dir = undefined;
}

/**
 * Run a script in the job service, which is the application's image with the
 * same mounts and the job's environment.
 *
 * `run --rm` rather than `exec`: the job is not up, and its not being up is
 * what `snapshot-schedule` requires.
 */
export const inJob = (script: string) =>
	compose("run", "--rm", "--entrypoint", "sh", "job", "-c", script);

/**
 * When the application container last started, and how many times it has been
 * restarted.
 *
 * What the requirement says is that a published bundle is served *by the
 * process that was already running*. Content changing does not say that on its
 * own: `restart: always` means a container that died between two requests
 * comes back, reads the volume fresh, and answers correctly — the assertion
 * passing for the one reason it exists to rule out.
 */
export function incarnation() {
	const read = Bun.spawnSync(
		[
			"docker",
			"inspect",
			"--format",
			"{{.State.StartedAt}} {{.RestartCount}}",
			address,
		],
		{ stdout: "pipe", stderr: "pipe", timeout: COMPOSE_MS },
	);
	if (read.exitCode !== 0)
		throw new Error(`docker inspect failed:\n${read.stderr.toString()}`);
	return read.stdout.toString().trim();
}

/**
 * Ask the application for `path` from a container on the shared network,
 * addressing it by name.
 *
 * This is what the reverse proxy does and the only way in that exists: the
 * project publishes no port, so a request from the host cannot reach it at
 * all. `bun` rather than curl, the image being the one thing here known to
 * carry a client.
 */
export function request(path: string) {
	const asked = Bun.spawnSync(
		[
			"docker",
			"run",
			"--rm",
			"--network",
			shared,
			image(),
			"bun",
			"-e",
			// The URL is serialised rather than spliced in: a path carrying a
			// quote or a newline would otherwise end the string literal and
			// become script. Nothing passes one today, and this is shared
			// machinery that later groups will hand more varied paths.
			`const answer = await fetch(${JSON.stringify(`http://${address}:3000${path}`)});
			 console.log(answer.status);
			 console.log(await answer.text());`,
		],
		{ stdout: "pipe", stderr: "pipe", timeout: COMPOSE_MS },
	);
	const out = asked.stdout.toString();
	const newline = out.indexOf("\n");
	return {
		status: Number(out.slice(0, newline)),
		body: out.slice(newline + 1),
		stderr: asked.stderr.toString(),
	};
}
