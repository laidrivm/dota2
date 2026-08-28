import { test as base, expect } from "@playwright/test";

/**
 * A set-up session, which every board spec needs before there is a board: the
 * app renders Setup until a side and a role are chosen.
 *
 * Accessible names carry the hotkey hint, because the `.kbd` span renders
 * inside the `<label>`: an option is `R Radiant`, never `Radiant`.
 */
export const test = base.extend<{ session: (side: string) => Promise<void> }>({
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
