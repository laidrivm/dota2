import { expect, type Page, test } from "@playwright/test";
import { CM_TEST_PASSWORD } from "../playwright.config.ts";

/**
 * The CM board's reading of the draft: where the assignment puts each pick,
 * and the ranked heroes for the step in progress, on the shipped snapshot.
 */

async function signedInAt(page: Page, pickOrder: "First pick" | "Second pick") {
	await page.goto("/cm");
	await page.getByLabel("CM password").fill(CM_TEST_PASSWORD);
	await page.getByLabel("CM password").press("Enter");
	await page.getByRole("radio", { name: "Radiant" }).check();
	await page.getByRole("radio", { name: pickOrder }).check();
}

const draft = (page: Page) => page.getByRole("region", { name: "Draft" });

test("a captain's step lists five heroes with their parts, and one enters its hero", async ({
	page,
}) => {
	await signedInAt(page, "First pick");
	const suggested = page.getByRole("region", { name: "Suggested bans" });
	const entries = suggested.getByRole("listitem").filter({
		has: page.getByRole("button"),
	});
	await expect(entries).toHaveCount(5);
	await expect(entries.first().getByLabel("Score parts")).toContainText("meta");

	const first = entries.first().getByRole("button");
	const name = (await first.innerText()).split("\n")[0]?.trim() ?? "";
	await first.click();
	await expect(draft(page).getByText("Step 2 · your ban")).toBeVisible();
	await expect(
		page.getByLabel("Your bans").getByRole("img", { name }),
	).toBeVisible();
	await expect(
		draft(page).getByRole("button", { name: /^Enter / }),
	).toBeFocused();
});

// spec: cm-model/an-enemy-step
test("an enemy step lists what the enemy is expected to take, and enters nothing", async ({
	page,
}) => {
	await signedInAt(page, "Second pick");
	const expected = page.getByRole("region", { name: "Enemy's expected bans" });
	await expect(expected.getByRole("listitem").first()).toBeVisible();
	await expect(expected.getByRole("button")).toHaveCount(0);
});

// spec: cm-model/the-assignment-is-shown
test("each of the captain's picks shows its position and the player holding it", async ({
	page,
}) => {
	await signedInAt(page, "First pick");
	const ours = page.getByRole("region", { name: "Your team" });
	await ours.getByLabel("Nickname").first().fill("Carry");
	await ours.getByLabel("Nickname").first().blur();
	await ours.getByLabel("Position").first().selectOption("1");
	for (let n = 0; n < 7; n++) {
		await draft(page)
			.getByRole("button", { name: /^Enter / })
			.click();
		await expect(page.getByRole("dialog")).toBeVisible();
		await page.keyboard.press("Enter");
		await expect(page.getByRole("dialog")).toBeHidden();
	}
	await draft(page).getByRole("button", { name: "Enter your pick" }).click();
	// The seven bans took the first free heroes A to Z; Spectre is far past them.
	await page.getByLabel("Search heroes").fill("Spectre");
	await page.keyboard.press("Enter");
	const pick = page.getByLabel("Your picks").getByRole("listitem");
	await expect(pick).toHaveCount(1);
	await expect(pick).toContainText("pos 1 · Carry");
});
