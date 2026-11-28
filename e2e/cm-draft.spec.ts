import { expect, type Page, test } from "@playwright/test";
import { CM_TEST_PASSWORD } from "../playwright.config.ts";

/**
 * The CM draft in the browser: the order, a taken hero, undo, and the focus a
 * pick leaves behind. Every case signs in with the right password, so the
 * wrong-password budget `cm.spec.ts` spends stays its own.
 */

async function signedInAt(page: Page, pickOrder: "First pick" | "Second pick") {
	await page.goto("/cm");
	await page.getByLabel("CM password").fill(CM_TEST_PASSWORD);
	await page.getByLabel("CM password").press("Enter");
	await page.getByRole("radio", { name: "Radiant" }).check();
	await page.getByRole("radio", { name: pickOrder }).check();
}

const draft = (page: Page) => page.getByRole("region", { name: "Draft" });

/** Enters `count` steps, each with the first free hero, or `name`'s. */
async function enter(page: Page, count: number, name?: string) {
	for (let n = 0; n < count; n++) {
		await draft(page)
			.getByRole("button", { name: /^Enter / })
			.click();
		await choose(page, name);
	}
}

/** Takes `name`, or the first free hero, in the picker once it is open. */
async function choose(page: Page, name?: string) {
	await expect(page.getByRole("dialog")).toBeVisible();
	if (name !== undefined) await page.getByLabel("Search heroes").fill(name);
	await page.keyboard.press("Enter");
	await expect(page.getByRole("dialog")).toBeHidden();
}

// spec: cm-draft/the-order-from-the-second-pick
test("picking second, step 3 is the captain's, and step 24 completes the draft", async ({
	page,
}) => {
	await signedInAt(page, "Second pick");
	await expect(draft(page).getByText("Step 1 · enemy ban")).toBeVisible();
	await enter(page, 2);
	await expect(draft(page).getByText("Step 3 · your ban")).toBeVisible();
	await enter(page, 1);
	await expect(draft(page).getByText("Step 4 · your ban")).toBeVisible();

	await enter(page, 21);
	await expect(draft(page).getByText("Draft complete").first()).toBeVisible();
	for (const team of ["Your", "Enemy"]) {
		await expect(
			page.getByLabel(`${team} bans`).getByRole("listitem"),
		).toHaveCount(7);
		await expect(
			page.getByLabel(`${team} picks`).getByRole("listitem"),
		).toHaveCount(5);
	}
	await expect(
		draft(page).getByRole("button", { name: "Draft complete" }),
	).toBeDisabled();
	// The entry control is gone, so focus lands on the way back.
	await expect(draft(page).getByRole("button", { name: "Undo" })).toBeFocused();
	await expect(page.getByRole("radio", { name: "Dire" })).toBeDisabled();
});

// spec: cm-draft/a-banned-hero-offered-again
test("a hero banned at step 2 is shown taken at step 8, and choosing it changes nothing", async ({
	page,
}) => {
	await signedInAt(page, "First pick");
	await enter(page, 1);
	await enter(page, 1, "Pudge");
	await enter(page, 5);
	await expect(draft(page).getByText("Step 8 · your pick")).toBeVisible();
	// Each entered hero is named to assistive technology, in its row and the strip.
	await expect(
		page.getByLabel("Your bans").getByRole("img", { name: "Pudge" }),
	).toBeVisible();
	await expect(
		page.getByLabel("Draft order").getByRole("img", { name: "Pudge" }),
	).toBeVisible();

	await draft(page).getByRole("button", { name: "Enter your pick" }).click();
	await page.getByLabel("Search heroes").fill("Pudge");
	const pudge = page.getByRole("dialog").getByRole("button", { name: /Pudge/ });
	await expect(pudge).toHaveAttribute("aria-disabled", "true");
	await expect(pudge).toContainText("taken");
	// Playwright waits on an aria-disabled button; the click itself is the case.
	await pudge.dispatchEvent("click");
	await page.getByLabel("Search heroes").press("Enter");
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(draft(page).getByText("Step 8 · your pick")).toBeVisible();
});

// spec: cm-draft/undoing-a-pick
test("undoing step 9 puts it back in progress with its hero free again", async ({
	page,
}) => {
	await signedInAt(page, "First pick");
	await enter(page, 8);
	await enter(page, 1, "Lion");
	await expect(draft(page).getByText("Step 10 · your ban")).toBeVisible();

	await draft(page).getByRole("button", { name: "Undo" }).click();
	await expect(draft(page).getByText("Step 9 · enemy pick")).toBeVisible();
	await draft(page).getByRole("button", { name: "Enter enemy pick" }).click();
	await page.getByLabel("Search heroes").fill("Lion");
	await expect(
		page.getByRole("dialog").getByRole("button", { name: /Lion/ }),
	).toHaveAttribute("aria-disabled", "false");
});

test("a pick hands focus back, a signature leaves by its tile, and ten is the limit", async ({
	page,
}) => {
	await signedInAt(page, "First pick");
	await enter(page, 1);
	await expect(
		draft(page).getByRole("button", { name: /^Enter / }),
	).toBeFocused();

	const player = page.getByRole("group", { name: "Player 1" });
	const add = player.getByRole("button", { name: "Add signature" });
	const signatures = page
		.getByLabel("Player 1 signatures")
		.getByRole("listitem");
	await add.click();
	await choose(page);
	await expect(signatures).toHaveCount(1);
	await expect(add).toBeFocused();
	await player.getByRole("button", { name: /^Remove / }).click();
	await expect(signatures).toHaveCount(0);
	await expect(add).toBeFocused();

	for (let n = 0; n < 10; n++) {
		await add.click();
		await choose(page);
	}
	const full = player.getByRole("button", { name: "10 signatures, the limit" });
	await expect(full).toBeDisabled();
	// The add control is disabled, so focus lands on the tenth tile's removal.
	await expect(
		player.getByRole("button", { name: /^Remove / }).last(),
	).toBeFocused();
});
