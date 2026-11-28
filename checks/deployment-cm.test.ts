/**
 * What the compose file gives the Captains Mode API: its password, to the
 * application alone, and a store of its own that outlives a redeploy. Read off
 * `docker-compose.yml` for the reason `deployment-topology.test.ts` gives.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
	app,
	CM_STORE,
	compose,
	mountsOf,
	services,
} from "./compose-file.fixture.ts";
import { root } from "./root.ts";

// spec: deployment-topology/the-password-in-the-compose-file
test("the CM password reaches the application and no other service", () => {
	// Interpolated from the host's `.env`, never a literal written here.
	expect(app.environment?.CM_PASSWORD).toMatch(/^\$\{CM_PASSWORD\}$/);
	const others = Object.entries(services).filter(([name]) => name !== "app");
	for (const [, service] of others)
		expect(Object.keys(service.environment ?? {})).not.toContain("CM_PASSWORD");
});

// spec: deployment-topology/the-password-in-the-compose-file
test(".env.example names the CM password empty and says what unset means", () => {
	const documented = readFileSync(`${root}/.env.example`, "utf8");
	expect(documented).toMatch(/^CM_PASSWORD=$/m);
	const block = documented.slice(0, documented.indexOf("CM_PASSWORD="));
	const comment = block.slice(block.lastIndexOf("\n\n")).replace(/\s+/g, " ");
	expect(comment).toMatch(/12 characters/);
	expect(comment).toMatch(/closed/);
});

// spec: deployment-topology/the-store-in-the-compose-file
test("the application alone mounts a declared volume at its CM store, named in its environment", () => {
	const store = mountsOf(app).filter((m) => m.target === CM_STORE);
	expect(store).toHaveLength(1);
	const volume = store[0]?.volume as string;
	expect(Object.keys(compose.volumes ?? {})).toContain(volume);
	for (const [name, service] of Object.entries(services))
		if (name !== "app")
			expect(mountsOf(service).map((m) => m.volume)).not.toContain(volume);
	// The path the code reads is the path the volume is at, set literally.
	expect(app.environment?.CM_DATA_DIR).toBe(CM_STORE);
});
