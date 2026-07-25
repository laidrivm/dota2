import { defineConfig, devices } from "@playwright/test";

/**
 * The suite runs against `bun run dev`, not against `dist/` — the dev server
 * is the only thing that serves `/snapshot.json`, and the build output's
 * contents are already asserted by `build.test.ts`.
 *
 * The port follows `Bun.serve`'s own precedence rather than hard-coding 3000:
 * `webServer` inherits this environment, so a developer with `PORT` set gets
 * the suite and the server on the same port instead of probing a stranger.
 */
const port = process.env.BUN_PORT ?? process.env.PORT ?? "3000";
const baseURL = `http://localhost:${port}`;

export default defineConfig({
	testDir: "e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	// A flake gets fixed, not retried.
	retries: 0,
	// One worker would hide exactly the bugs parallelism exists to catch.
	workers: process.env.CI ? 2 : undefined,
	reporter: [["list"], ["html", { open: "never" }]],
	use: { baseURL },
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: "bun run dev",
		url: baseURL,
		// Locally the running dev server is reused; CI always starts its own.
		reuseExistingServer: !process.env.CI,
	},
});
