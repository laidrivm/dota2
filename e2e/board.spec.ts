import { expect, type Page } from "@playwright/test";
import { SESSION_KEY } from "../src/app/session-storage.ts";
import { test } from "./session.ts";

/**
 * The board's own paths, and the three mechanisms the move to CSS modules put
 * under them: the removal control is revealed by a custom property its row
 * sets, mirroring is a property of the grid rather than a class on the panel it
 * moves, and the walk from a removal control up to its row and its region
 * reads `data-` markers — the class names it used to read are the bundler's
 * now.
 */

/** Takes the hero `Enter` picks, for whichever entry control opened the picker. */
const pickFirst = async (page: Page) => {
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.keyboard.press("Enter");
};

const leftEdge = (page: Page, name: string) =>
	page
		.getByRole("region", { name, exact: true })
		.evaluate((el) => el.getBoundingClientRect().x);

test("a ban's removal control is transparent until its tile is hovered", async ({
	page,
	session,
}) => {
	await session("R Radiant");
	await page.getByRole("button", { name: "Add ban" }).click();
	await pickFirst(page);

	const remove = page.getByRole("button", { name: /^Remove ban/ });
	await expect(remove).toHaveCSS("opacity", "0");
	await remove.hover();
	await expect(remove).toHaveCSS("opacity", "1");
});

test("a slot's removal control is revealed by hovering the row", async ({
	page,
	session,
}) => {
	await session("R Radiant");
	await page.getByRole("button", { name: "Pick for Carry" }).click();
	await pickFirst(page);

	// The pick leaves the pointer inside the row and focus on the control it
	// just created — both of which reveal it. Neither is the claim here.
	await page.mouse.move(0, 0);
	const remove = page.getByRole("button", { name: /from Carry$/ });
	await remove.blur();
	await expect(remove).toHaveCSS("opacity", "0");

	// Anywhere in the row, not the control itself: `:focus-visible` on the
	// button would reveal it without the row's knob having done anything.
	await page
		.getByRole("region", { name: "My team", exact: true })
		.getByText("Carry", { exact: true })
		.hover();
	await expect(remove).toHaveCSS("opacity", "1");
});

// A fresh session per side: the previous one is restored from storage, and a
// restored board renders no side control to choose the other one with.
for (const { side, reads, mirrored } of [
	{ side: "D Dire", reads: "right", mirrored: true },
	{ side: "R Radiant", reads: "left", mirrored: false },
]) {
	test(`my team reads ${reads} on ${side.slice(2)}`, async ({
		page,
		session,
	}) => {
		await session(side);

		const mine = await leftEdge(page, "My team");
		const enemy = await leftEdge(page, "Enemy team");
		// Strict both ways: `mine > enemy` being false would also accept the two
		// panels sitting at the same x, which is a collapsed grid, not a layout.
		expect(mirrored ? mine > enemy : mine < enemy).toBe(true);
	});
}

test("removing a hero moves focus to the entry control that replaces it", async ({
	page,
	session,
}) => {
	await session("R Radiant");
	// Offlane, not the session's own Carry: the panel's *first* entry control is
	// Carry's, so a walk that reached the region rather than the row would land
	// there and read as a pass.
	await page.getByRole("button", { name: "Pick for Offlane" }).click();
	await pickFirst(page);

	await page.getByRole("button", { name: /from Offlane$/ }).click();
	await expect(
		page.getByRole("button", { name: "Pick for Offlane" }),
	).toBeFocused();
});

/**
 * A hero the session holds and the snapshot no longer carries. The board has to
 * render around it, and its tile has to land on one of the two branches the
 * requirement allows — never between them.
 *
 * The session is seeded through the module's own key rather than a string
 * spelled again here, and the snapshot is the real one with a single hero
 * dropped, so nothing else about the board moves.
 */
const seed = async (page: Page, hero: { id: number }) => {
	await page.addInitScript(
		([key, stored]) => {
			localStorage.setItem(key as string, stored as string);
		},
		[
			SESSION_KEY,
			JSON.stringify({
				v: 1,
				createdAt: new Date().toISOString(),
				side: "radiant",
				myRole: 1,
				bans: [hero.id],
				teamPicks: { "1": null, "2": null, "3": hero.id, "4": null, "5": null },
				enemyPicks: [],
			}),
		],
	);
};

/**
 * Every tile in `row`, sorted into the branches the requirement allows: a tile
 * is a span that is either named to assistive technology or hidden from it, so
 * the query *is* the requirement — a tile in neither branch matches no selector
 * and shows up as a missing tile rather than as a passing one.
 */
const tilesIn = (element: Element, row: string) => {
	const slot = element.querySelector(`[data-row="${row}"]`);
	if (slot === null) return null;
	const tiles = [
		...slot.querySelectorAll("span[role='img'], span[aria-hidden='true']"),
	];
	return {
		tiles: tiles.length,
		names: tiles.flatMap((tile) => {
			const name = tile.getAttribute("aria-label");
			return name === null || name === "" ? [] : [name];
		}),
		hidden: tiles.filter((tile) => tile.getAttribute("aria-hidden") === "true")
			.length,
	};
};

// spec: draft-board/hero-missing-from-the-snapshot
test("a hero the snapshot dropped leaves its tile on one branch or the other", async ({
	page,
}) => {
	const thrown: string[] = [];
	page.on("pageerror", (error) => thrown.push(error.message));

	const bundle = (await (await page.request.get("/snapshot.json")).json()) as {
		heroes: { id: number; name: string }[];
	};
	const gone = bundle.heroes[0];
	if (gone === undefined) throw new Error("the snapshot carries no heroes");
	await seed(page, gone);
	await page.route("**/snapshot.json", (route) =>
		route.fulfill({
			contentType: "application/json",
			body: JSON.stringify({
				...bundle,
				heroes: bundle.heroes.filter((hero) => hero.id !== gone.id),
			}),
		}),
	);

	await page.goto("/");

	// The remaining panels render, which is the half of the criterion about the
	// board surviving a hero it cannot resolve.
	await expect(page.getByRole("region", { name: "Bans" })).toBeVisible();
	const mine = page.getByRole("region", { name: "My team", exact: true });
	await expect(mine).toBeVisible();
	await expect(
		page.getByRole("region", { name: "Enemy team", exact: true }),
	).toBeVisible();

	// The re-pick marker renders only where the hero came back `undefined`, so
	// it is what says these two tiles are on the path this test is about — every
	// assertion below reads the same either way without it.
	const bans = page.getByRole("region", { name: "Bans" });
	await expect(mine.getByText("re-pick")).toBeVisible();
	await expect(bans.getByText("re-pick")).toBeVisible();

	// The slot hides its tile; the row beside it names no hero either, which is
	// why the requirement had to say so rather than lean on the row.
	expect(await mine.evaluate(tilesIn, "team-3")).toEqual({
		tiles: 1,
		names: [],
		hidden: 1,
	});

	// The bans row takes the other branch, and the name it carries is the one
	// only an unresolvable hero produces.
	expect(await bans.evaluate(tilesIn, "ban")).toEqual({
		tiles: 1,
		names: ["Unknown hero"],
		hidden: 0,
	});

	expect(thrown).toEqual([]);
});
