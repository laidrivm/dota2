/**
 * `docker-compose.yml` as the deployment checks read it: the file parsed, its
 * services by role, and the image's working directory the mounts are measured
 * against. Its own module because two test files read it, and a copy each
 * would let them check different readings of one file.
 */
import { readFileSync } from "node:fs";
import { root } from "./root.ts";

export type Service = {
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

export const compose = Bun.YAML.parse(
	readFileSync(`${root}/docker-compose.yml`, "utf8"),
) as Compose;

export const services = compose.services ?? {};

/**
 * The image's working directory, read from the `Dockerfile`.
 *
 * The server resolves the publication directory and the icon mirror relative
 * to the repository root, which in the image is this — so this is where the
 * volumes have to be mounted for the code to find them, and taking it from
 * the file that declares it is what stops the two drifting apart.
 */
export const workdir = (() => {
	const found = readFileSync(`${root}/Dockerfile`, "utf8")
		.split("\n")
		.filter((line) => /^WORKDIR\s/i.test(line))
		.map((line) => line.replace(/^WORKDIR\s+/i, "").trim());
	// Every stage's, and they have to agree: a production stage working
	// somewhere else would be mounted at the build stage's path.
	if (new Set(found).size !== 1)
		throw new Error(`the Dockerfile's stages work from ${found.length} directories`);
	return found[0] as string;
})();

/** Where the image keeps the CM API's uploaded meta. */
export const CM_STORE = `${workdir}/cm-data`;

/** The services this project runs, by the role each plays. */
export const app = services.app as Service;
export const db = services.db as Service;
export const job = services.job as Service;

/** A service's mounts, each as the volume it names and the path it is at. */
export const mountsOf = (service: Service) =>
	(service.volumes ?? []).map((entry) => {
		const [volume, target] = entry.split(":");
		return { volume, target };
	});
