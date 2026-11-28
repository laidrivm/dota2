import { defineConfig, devices } from "@playwright/test";

/**
 * The suite runs against `bun run dev`, which builds and serves `dist/` — the
 * production pipeline short of minification, so a defect the bundler
 * introduces is under test here rather than only in `build.test.ts`.
 * `/snapshot.json` and the fonts keep their own routes and are served from
 * source either way.
 *
 * The port follows `Bun.serve`'s own precedence rather than hard-coding 3000:
 * `webServer` inherits this environment, so a developer with `PORT` set gets
 * the suite and the server on the same port instead of probing a stranger.
 */
const port = process.env.BUN_PORT ?? process.env.PORT ?? "3000";

/** The CM password the suite's server runs with; `e2e/cm.spec.ts` imports it. */
export const CM_TEST_PASSWORD = "e2e-only-cm-password";
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
		// The CM API stays closed without one; this value exists for the suite
		// alone, and `e2e/cm.spec.ts` signs in with it.
		env: { CM_PASSWORD: CM_TEST_PASSWORD },
	},
});
