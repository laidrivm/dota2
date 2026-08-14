import { test as base, expect, type Page } from "@playwright/test";

/**
 * The board's own paths, and the three mechanisms the move to CSS modules put
 * under them: the removal control is revealed by a custom property its row
 * sets, mirroring is a property of the grid rather than a class on the panel it
 * moves, and the walk from a removal control up to its row and its region
 * reads `data-` markers — the class names it used to read are the bundler's
 * now.
 *
 * Accessible names carry the hotkey hint, because the `.kbd` span renders
 * inside the `<label>`: an option is `R Radiant`, never `Radiant`.
 */
const test = base.extend<{ session: (side: string) => Promise<void> }>({
	session: async ({ page }, use) => {
		await use(async (side) => {
			await page.goto("/");
			await page.getByRole("radio", { name: side }).check();
			// The second choice completes the session, so the control unmounts with
			// it and `check()` would have nothing left to confirm against.
			await page.getByRole("radio", { name: "1 C Carry" }).click();
			await expect(page.getByRole("region", { name: "Bans" })).toBeVisible();
		});
	},
});

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
