import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { staticRoutes } from "./static-routes.ts";

let origin: string;
let server: ReturnType<typeof Bun.serve>;

beforeAll(() => {
	server = Bun.serve({ port: 0, routes: staticRoutes() });
	origin = server.url.origin;
});

afterAll(() => server.stop(true));

describe("snapshot route", () => {
	test("serves the fixture as JSON", async () => {
		const response = await fetch(`${origin}/snapshot.json`);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toStartWith(
			"application/json",
		);
		expect((await response.json()).patch.id).toBe("7.41d");
	});

	test("is revalidated, since the pipeline republishes this URL", async () => {
		const response = await fetch(`${origin}/snapshot.json`);
		expect(response.headers.get("cache-control")).toBe("no-cache");
	});
});

describe("font routes", () => {
	const woff2 = "/fonts/IBMPlexSans-Regular-Latin1.woff2";

	test("serve a face with its own content type", async () => {
		const response = await fetch(`${origin}${woff2}`);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("font/woff2");
	});

	test("cache faces forever, because their names pin their bytes", async () => {
		const response = await fetch(`${origin}${woff2}`);
		expect(response.headers.get("cache-control")).toBe(
			"public, max-age=31536000, immutable",
		);
	});

	test("revalidate fonts.css, which can gain a face", async () => {
		const response = await fetch(`${origin}/fonts/fonts.css`);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toStartWith("text/css");
		expect(response.headers.get("cache-control")).toBe("no-cache");
	});

	test("serve the whole file on a second request", async () => {
		const first = await fetch(`${origin}${woff2}`);
		const firstSize = (await first.arrayBuffer()).byteLength;
		const second = await fetch(`${origin}${woff2}`);

		expect(firstSize).toBeGreaterThan(0);
		expect((await second.arrayBuffer()).byteLength).toBe(firstSize);
	});

	test.each([
		"/fonts/nonexistent.woff2",
		"/fonts/../../package.json",
		"/fonts/..%2f..%2fpackage.json",
	])("do not serve %s", async (path) => {
		const response = await fetch(`${origin}${path}`);
		expect(response.status).toBe(404);
	});
});
