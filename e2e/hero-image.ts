import { expect, type Page } from "@playwright/test";
import { iconSrc } from "../src/app/board/format.ts";

/**
 * The hero image, and the square it degrades to.
 *
 * The loading half fulfils the request from a PNG this file carries rather than
 * from `icons/`: the mirror is gitignored and written only by a job run, so a
 * fresh clone and CI have none, and a suite needing one would pass on the
 * machine that ran the ingest and nowhere else.
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
export async function iconPath(page: Page, name: string): Promise<string> {
	const bundle = (await (await page.request.get("/snapshot.json")).json()) as {
		heroes: { name: string; icon: unknown }[];
	};
	// Through the production validator rather than a second pattern here: an
	// `icon` that is empty, absent or malformed would otherwise become a route
	// glob matching every request or none, and a suite routing the wrong thing
	// reports a pass about something else.
	const icon = iconSrc(bundle.heroes.find((hero) => hero.name === name)?.icon);
	if (icon === null) throw new Error(`no routable icon for ${name}`);
	return icon;
}

export const serveIcon = (page: Page, icon: string) =>
	page.route(`**${icon}`, (route) =>
		route.fulfill({ contentType: "image/png", body: PNG }),
	);

export const failIcon = (page: Page, icon: string) =>
	page.route(`**${icon}`, (route) => route.abort("failed"));

/**
 * What the tile's image is doing, or `null` when the tile rendered none. It
 * closes over nothing: only the function itself crosses into the page, so a
 * helper of this file's called from inside would be undefined there.
 *
 * `withinParent` steps up one first, for a tile reached through the name
 * rendered beside it. `fills` compares the image against its own tile, which is
 * what the CSS claims; that the crop preserves the source's aspect is not
 * asserted here, and the PNG above is 1x1 rather than the mirror's 256x144.
 */
export const imageState = (element: Element, withinParent: boolean) => {
	const scope = withinParent ? element.parentElement : element;
	const image = scope?.querySelector("img") ?? null;
	if (image === null || image.parentElement === null) return null;
	const box = image.getBoundingClientRect();
	const tile = image.parentElement.getBoundingClientRect();
	return {
		opacity: getComputedStyle(image).opacity,
		loading: image.getAttribute("loading"),
		// `complete` turns true once the fetch has finished either way, and one
		// that failed leaves `naturalWidth` at 0. Both are needed because
		// `opacity: 0` is also the pending state: a fallback asserted without
		// them passes before the failure has reached the image at all.
		settled: image.complete,
		drew: image.naturalWidth > 0,
		fills:
			Math.round(box.width) === Math.round(tile.width) &&
			Math.round(box.height) === Math.round(tile.height),
	};
};

/** A tile the row does not name for it, so the wrapper carries the name. */
export const namedTile = (page: Page, region: string, name: string) =>
	page
		.getByRole("region", { name: region, exact: true })
		.getByRole("img", { name, exact: true });

/**
 * The name a slot renders beside its tile. The tile itself is `aria-hidden`,
 * because this row already names the hero, so it is reached through this and
 * `imageState`'s `withinParent` rather than by a locator of its own.
 */
export const slotTile = (page: Page, name: string) =>
	page
		.getByRole("region", { name: "My team", exact: true })
		.getByText(name, { exact: true });

/** Bans the named hero through the picker, the way a user reaches one. */
export async function ban(page: Page, name: string) {
	await page.getByRole("button", { name: "Add ban" }).click();
	await pick(page, name);
}

/** Takes the named hero in an open picker. */
export async function pick(page: Page, name: string) {
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.getByLabel("Search heroes").fill(name);
	await page.keyboard.press("Enter");
	await expect(page.getByRole("dialog")).toBeHidden();
}
