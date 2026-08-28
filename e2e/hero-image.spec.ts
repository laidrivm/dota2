import { expect, type Page } from "@playwright/test";
import { test } from "./session.ts";

/**
 * The hero image, and the square it degrades to.
 *
 * The loading half fulfils the request from a PNG this file carries rather than
 * from `icons/`: the mirror is gitignored and written only by a job run, so a
 * fresh clone and CI have none, and a suite needing one would pass on the
 * machine that ran the ingest and nowhere else.
 *
 * A tile's image is read inside `evaluate` rather than located: `alt=""` keeps
 * it out of the accessibility tree, which is the whole point of it, so no role
 * locator reaches it and a class selector is what this suite refuses.
 */

/** A 1×1 red PNG. Nothing here reads a pixel — only that it decodes. */
const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
	"base64",
);

/**
 * A hero's image path, read from the snapshot this page will load. Never
 * assembled from the name: the slug is the ingest's — `Zeus` is `zuus.png` and
 * `Queen of Pain` is `queenofpain.png` — and whose spelling is canonical is
 * `PLAN.md`'s open question, not this suite's to answer.
 */
async function iconPath(page: Page, name: string): Promise<string> {
	const bundle = (await (await page.request.get("/snapshot.json")).json()) as {
		heroes: { name: string; icon: string }[];
	};
	const icon = bundle.heroes.find((hero) => hero.name === name)?.icon;
	if (icon === undefined) throw new Error(`no ${name} in the snapshot`);
	return icon;
}

const serveIcon = (page: Page, icon: string) =>
	page.route(`**${icon}`, (route) =>
		route.fulfill({ contentType: "image/png", body: PNG }),
	);

const failIcon = (page: Page, icon: string) =>
	page.route(`**${icon}`, (route) => route.abort("failed"));

/**
 * What the tile's image is doing, or `null` when the tile rendered none. It
 * closes over nothing: only the function itself crosses into the page, so a
 * helper of this file's called from inside would be undefined there.
 *
 * `withinParent` steps up one first, for a tile reached through the name
 * rendered beside it. The box is compared against the image's own tile either
 * way, which is the claim — the source is 256x144 and the tile is a square.
 */
const imageState = (element: Element, withinParent: boolean) => {
	const scope = withinParent ? element.parentElement : element;
	const image = scope?.querySelector("img") ?? null;
	if (image === null || image.parentElement === null) return null;
	const box = image.getBoundingClientRect();
	const tile = image.parentElement.getBoundingClientRect();
	return {
		opacity: getComputedStyle(image).opacity,
		loading: image.getAttribute("loading"),
		fills:
			Math.round(box.width) === Math.round(tile.width) &&
			Math.round(box.height) === Math.round(tile.height),
	};
};

/** A tile the row does not name for it, so the wrapper carries the name. */
const namedTile = (page: Page, region: string, name: string) =>
	page
		.getByRole("region", { name: region, exact: true })
		.getByRole("img", { name, exact: true });

/**
 * A tile in a row that names its hero: the tile is `aria-hidden`, so the walk
 * starts from the name beside it and steps up to the pair's own container.
 */
const slotTile = (page: Page, name: string) =>
	page
		.getByRole("region", { name: "My team", exact: true })
		.getByText(name, { exact: true });

/** Bans the named hero through the picker, the way a user reaches one. */
async function ban(page: Page, name: string) {
	await page.getByRole("button", { name: "Add ban" }).click();
	await pick(page, name);
}

/** Takes the named hero in an open picker. */
async function pick(page: Page, name: string) {
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.getByLabel("Search heroes").fill(name);
	await page.keyboard.press("Enter");
	await expect(page.getByRole("dialog")).toBeHidden();
}

// spec: draft-board/the-image-is-drawn draft-board/the-image-does-not-load
test("a tile shows its image, and the one whose request failed shows its square", async ({
	page,
	session,
}) => {
	await serveIcon(page, await iconPath(page, "Pudge"));
	await failIcon(page, await iconPath(page, "Zeus"));

	await session("R Radiant");
	await ban(page, "Pudge");
	await ban(page, "Zeus");

	// Side by side in one row, so what tells the two states apart is the request
	// each tile made and nothing else about where it sits.
	const drawn = namedTile(page, "Bans", "Pudge");
	const square = namedTile(page, "Bans", "Zeus");
	await expect
		.poll(() => drawn.evaluate(imageState, false))
		.toEqual({
			opacity: "1",
			loading: "lazy",
			fills: true,
		});
	await expect
		.poll(() => square.evaluate(imageState, false))
		.toEqual({
			opacity: "0",
			loading: "lazy",
			fills: true,
		});

	// The square is the one the tile always had — its abbreviation over the
	// palette, which the drawn tile covers rather than drops. And the name is
	// the wrapper's alone: an image contributing one would make this two.
	await expect(square).toHaveText("ZEUS");
	await expect(drawn).toHaveText("PUDG");
	await expect(namedTile(page, "Bans", "Pudge")).toHaveCount(1);
});

// spec: draft-board/the-image-does-not-load
test("a tile shows no broken-image affordance while its request is in flight", async ({
	page,
	session,
}) => {
	// Held open rather than answered, so the assertions below run inside the
	// window between the request and its failure — the frames an `onError` loses.
	let fail: (() => void) | undefined;
	const held = new Promise<void>((resolve) => {
		fail = resolve;
	});
	const pudge = await iconPath(page, "Pudge");
	await page.route(`**${pudge}`, async (route) => {
		await held;
		await route.abort("failed");
	});

	await session("R Radiant");
	await ban(page, "Pudge");

	const tile = namedTile(page, "Bans", "Pudge");
	await expect
		.poll(() => tile.evaluate(imageState, false))
		.toMatchObject({
			opacity: "0",
		});
	await expect(tile).toHaveText("PUDG");

	fail?.();
	// Unchanged by the failure: the state that reveals the image is never
	// reached, so the failure has nothing to take back.
	await expect
		.poll(() => tile.evaluate(imageState, false))
		.toMatchObject({
			opacity: "0",
		});
	await expect(tile).toHaveText("PUDG");
});

// spec: draft-board/the-image-is-drawn
test("a slot whose hero is replaced after a failure shows the replacement", async ({
	page,
	session,
}) => {
	await serveIcon(page, await iconPath(page, "Pudge"));
	await failIcon(page, await iconPath(page, "Zeus"));

	await session("R Radiant");
	await page.getByRole("button", { name: "Pick for Offlane" }).click();
	await pick(page, "Zeus");

	// A slot's tile is hidden from assistive technology, because the row beside
	// it already names the hero — which is what this locator reads instead.
	await expect(slotTile(page, "Zeus")).toBeVisible();
	await expect(
		page
			.getByRole("region", { name: "My team", exact: true })
			.getByRole("img", { name: "Zeus", exact: true }),
	).toHaveCount(0);

	await page.getByRole("button", { name: /from Offlane$/ }).click();
	await page.getByRole("button", { name: "Pick for Offlane" }).click();
	await pick(page, "Pudge");

	// The replacement draws, having followed one that did not. It cannot reach
	// the reuse the `src` state guards against — removing the pick unmounts the
	// tile, and no call site replaces a filled slot's hero in place.
	await expect
		.poll(() => slotTile(page, "Pudge").evaluate(imageState, true))
		.toMatchObject({ opacity: "1" });
});

// spec: draft-board/the-image-is-drawn
test("the picker renders every hero on an empty query, each asking to load lazily", async ({
	page,
	session,
}) => {
	await session("R Radiant");
	const bundle = (await (await page.request.get("/snapshot.json")).json()) as {
		heroes: unknown[];
	};

	await page.getByRole("button", { name: "Add ban" }).click();
	await expect(page.getByRole("dialog")).toBeVisible();

	// The attribute and nothing about the traffic that follows: `loading="lazy"`
	// is a hint a conforming user agent may decline, so a request count — or an
	// inequality over one — would be asserting a promise the platform does not
	// make. What the application asks for is what it can be held to.
	await expect
		.poll(() =>
			page.getByRole("dialog").evaluate((el) => {
				const images = [...el.querySelectorAll("img")];
				return {
					count: images.length,
					eager: images.filter((i) => i.getAttribute("loading") !== "lazy")
						.length,
				};
			}),
		)
		.toEqual({ count: bundle.heroes.length, eager: 0 });
});
