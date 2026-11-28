import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { CM_TEST_PASSWORD } from "../playwright.config.ts";

/**
 * The Captains Mode page's sign-in, signed out again, and the All Pick page
 * left alone. The wrong-password budget is shared by every caller of one
 * server, so the suite spends one wrong password per run and no more.
 */

// spec: cm-access/signing-out
test("a wrong then the right password reaches the page, and sign-out returns", async ({
	page,
}) => {
	await page.goto("/cm");
	const field = page.getByLabel("CM password");
	await expect(field).toBeVisible();
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

	await field.fill("not the password at all");
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page.getByRole("alert")).toHaveText("Wrong password.");
	await expect(field).toBeFocused();

	await field.fill(CM_TEST_PASSWORD);
	await field.press("Enter");
	const signOut = page.getByRole("button", { name: "Sign out" });
	await expect(signOut).toBeVisible();
	expect(new URL(page.url()).pathname).toBe("/cm");

	await signOut.click();
	await expect(page.getByLabel("CM password")).toBeVisible();
	// The form again after a reload is what says the cookie is gone, not only
	// that the screen changed.
	await page.reload();
	await expect(page.getByLabel("CM password")).toBeVisible();
});

// spec: cm-draft/setup-collapses-into-the-board
test("setting the side and the pick order opens the board at step 1", async ({
	page,
}) => {
	await page.goto("/cm");
	const field = page.getByLabel("CM password");
	await field.fill(CM_TEST_PASSWORD);
	await field.press("Enter");

	await page.getByRole("radio", { name: "Dire" }).check();
	await expect(page.getByText("Step 1")).toHaveCount(0);
	await page.getByRole("radio", { name: "First pick" }).check();
	await expect(page.getByText("Step 1 · your ban")).toBeVisible();
	await expect(page.getByRole("region", { name: "Your team" })).toBeVisible();
	await expect(page.getByRole("region", { name: "Enemy team" })).toBeVisible();
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

// spec: app-shell/the-all-pick-page-never-reaches-the-cm-api
test("the All Pick page makes no request to the CM API", async ({ page }) => {
	const reached: string[] = [];
	page.on("request", (request) => {
		const { pathname } = new URL(request.url());
		if (pathname.startsWith("/api/cm")) reached.push(pathname);
	});

	await page.goto("/");
	await page.getByRole("radio", { name: "R Radiant" }).check();
	await page.getByRole("radio", { name: "1 C Carry" }).click();
	await expect(page.getByRole("region", { name: "Bans" })).toBeVisible();

	expect(reached).toEqual([]);
});
