/**
 * What the compose project exposes, and to what.
 *
 * Read off `docker-compose.yml` rather than off a running project, because
 * every property here is a statement the file makes and a reviewer has to be
 * able to see: a published port, a database on the shared network, a mount at
 * the wrong path. What a *running* project does with them is
 * `checks/deployment-shared-files.test.ts`.
 *
 * Nothing below names a network, a volume or a path it could read instead.
 * The proxy network is found by being the external one, the private one by
 * not being, the mount targets by what the `Dockerfile` declares — so a
 * rename moves the assertion with it, and a second copy of a value cannot
 * drift from the first.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The repository root: this file reads artefacts of it, from `checks/`. */
const root = join(import.meta.dir, "..");

type Service = {
	image?: string;
	container_name?: string;
	ports?: unknown[];
	networks?: string[];
	volumes?: string[];
	restart?: string;
	profiles?: string[];
	environment?: Record<string, string>;
};

type Compose = {
	services?: Record<string, Service>;
	volumes?: Record<string, unknown>;
	networks?: Record<string, { external?: boolean } | null>;
};

const compose = Bun.YAML.parse(
	readFileSync(`${root}/docker-compose.yml`, "utf8"),
) as Compose;

const services = compose.services ?? {};

/**
 * The image's working directory, read from the `Dockerfile`.
 *
 * The server resolves the publication directory and the icon mirror relative
 * to the repository root, which in the image is this — so this is where the
 * volumes have to be mounted for the code to find them, and taking it from
 * the file that declares it is what stops the two drifting apart.
 */
const workdir = (() => {
	const found = readFileSync(`${root}/Dockerfile`, "utf8")
		.split("\n")
		.filter((line) => /^WORKDIR\s/i.test(line))
		.map((line) => line.replace(/^WORKDIR\s+/i, "").trim());
	// Every stage's, and they have to agree: a production stage working
	// somewhere else would be mounted at the build stage's path.
	expect(new Set(found).size).toBe(1);
	return found[0] as string;
})();

/** The network every other application on the host is already on. */
const shared = Object.entries(compose.networks ?? {})
	.filter(([, config]) => config?.external === true)
	.map(([name]) => name);

/** The one this project brings up for itself. */
const private_ = Object.keys(compose.networks ?? {}).filter(
	(name) => !shared.includes(name),
);

test("the file declares one shared network and one of its own", () => {
	// Guards every assertion below, each of which is about one or the other:
	// with none of either they would all pass by having nothing to check.
	expect(shared).toHaveLength(1);
	expect(private_).toHaveLength(1);
});

/** The services this project runs, by the role each plays. */
const app = services.app as Service;
const db = services.db as Service;
const job = services.job as Service;

test("the file declares the three services these cases are about", () => {
	expect(Object.keys(services).sort()).toEqual(["app", "db", "job"]);
});

// spec: deployment-topology/the-project-brought-up
describe("no service binds a host port", () => {
	test.each(Object.keys(services))("%s publishes nothing", (name) => {
		// A published port is a second way in, unencrypted, beside the proxy
		// that exists to terminate TLS — and it is reachable from the internet
		// the moment it is bound, whatever the proxy is configured to do.
		// Absent or empty, both of which publish nothing: rejecting the empty
		// list would fail a file that is correct.
		expect(services[name]?.ports ?? []).toHaveLength(0);
	});
});

// spec: deployment-topology/the-proxy-reaching-the-application
test("the application is on the shared network under a fixed name", () => {
	expect(app.networks).toContain(shared[0]);
	// The proxy resolves it by container name, so compose must not be left to
	// derive one from the project directory — which is the host's, not this
	// repository's, and changes if the checkout moves.
	expect(app.container_name).toBeTruthy();
});

// spec: deployment-topology/a-container-on-the-shared-network
test("the database is on the private network and not the shared one", () => {
	expect(db.networks).toEqual([private_[0] as string]);
});

// spec: deployment-topology/the-job-reaching-the-database
test.each([
	["app", app],
	["job", job],
])("%s is on both networks", (_name, service) => {
	expect([...(service.networks ?? [])].sort()).toEqual(
		[shared[0] as string, private_[0] as string].sort(),
	);
});

// spec: deployment-topology/a-bundle-published-while-the-application-is-running
describe("the bundle and the icon mirror are mounted where the server reads", () => {
	const named = Object.keys(compose.volumes ?? {});

	test("every mount names a volume the file declares", () => {
		// Not a count: the database has one of its own that neither of the two
		// services below touches, so the shared pair is a subset rather than
		// the whole list. What matters is that no mount names a host path or a
		// volume nothing declared, which compose would create unremarked.
		const mounted = Object.values(services).flatMap((s) => s.volumes ?? []);
		expect(mounted.length).toBeGreaterThan(0);
		for (const entry of mounted)
			expect(named).toContain(entry.split(":")[0] as string);
	});

	test.each([
		["app", app],
		["job", job],
	])("%s mounts both at the paths the image works from", (_name, service) => {
		const mounts = (service.volumes ?? []).map((entry) => {
			const [volume, target] = entry.split(":");
			return { volume, target };
		});
		// Both, at the same targets, from the same named volumes: sharing is
		// the whole point, so a service mounting one of them, or mounting a
		// host path instead, breaks it silently.
		expect(mounts.map((m) => m.target).sort()).toEqual(
			[`${workdir}/icons`, `${workdir}/snapshot`].sort(),
		);
		// The same two named volumes for both services, whatever they are
		// called: sharing is the point, and two services each with a volume of
		// its own reads identically in the file.
		expect(mounts.map((m) => m.volume).sort()).toEqual(
			(app.volumes ?? []).map((e) => e.split(":")[0]).sort(),
		);
	});
});

// Cited by no criterion: this branch puts a second copy of the Postgres digest
// in the tree, and the copies have to agree. `scripts/test-db.sh` takes its
// image from the workflow, and Dependabot's `docker` ecosystem reads compose
// files and not workflows — so a bump lands here and leaves that one behind,
// with the local harness and CI then running different databases.
test("the database is pinned to the digest the workflow runs", () => {
	const workflow = readFileSync(`${root}/.github/workflows/test.yml`, "utf8");
	const pinned = [...workflow.matchAll(/image:\s*(postgres:\S+)/g)].map(
		(match) => match[1],
	);
	expect(pinned).toHaveLength(1);
	expect(db.image).toBe(pinned[0]);
});

// Cited by no criterion: the compose file composes the job's connection string,
// and doing that by interpolation would make the operator's choice of password
// a syntax question. Measured on bun 1.3.14: `/` or `#` in a password throws
// ERR_INVALID_URL before a connection is attempted, and `@` or `:` parses into
// a different password than was set.
test("the connection string carries no password to escape", () => {
	const url = job.environment?.DATABASE_URL ?? "";
	expect(url).toBeTruthy();
	// No credentials between the scheme and the host at all — an interpolated
	// one reads here as the literal `${POSTGRES_PASSWORD}` and would pass a
	// check looking only for the password's value.
	expect(url).not.toMatch(/^[a-z]+:\/\/[^/@]*:[^/@]*@/);
	expect(job.environment?.PGPASSWORD).toBeTruthy();
});

// Cited by no criterion: `.env.example` is what says which variables exist, and
// the host's own file is a copy of it — so a service gaining one the example
// does not name is a deploy that interpolates an empty string.
test("every variable the compose file reads is in .env.example", () => {
	const raw = readFileSync(`${root}/docker-compose.yml`, "utf8");
	const read = new Set(
		[...raw.matchAll(/\$\{([A-Z0-9_]+)\}/g)].map((match) => match[1] as string),
	);
	expect(read.size).toBeGreaterThan(0);
	const documented = readFileSync(`${root}/.env.example`, "utf8");
	for (const name of read)
		expect(documented).toMatch(new RegExp(`^${name}=`, "m"));
});

// spec: snapshot-schedule/the-job-is-not-kept-running
test("the job is not brought up with the project, and the other two restart", () => {
	// A profile is what keeps `up` from starting it: the job is a process that
	// exits, and a service with a restart policy that exits is a service
	// docker starts again.
	expect(job.profiles ?? []).not.toHaveLength(0);
	expect(job.restart).toBeUndefined();
	expect(app.restart).toBe("always");
	expect(db.restart).toBe("always");
});
