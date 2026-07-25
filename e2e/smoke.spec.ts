import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * The smoke suite: the paths a user actually walks, proven in a browser
 * because `bun test` runs without a DOM.
 *
 * Every scan follows an assertion that its target state is on screen — the
 * app renders nothing until the snapshot resolves, and a scan of an empty
 * document passes vacuously.
 *
 * Accessible names carry the hotkey hint, because the `.kbd` span renders
 * inside the `<label>`: an option is `R Radiant`, never `Radiant`.
 */

test("a keyboard alone reaches the board, and a reload keeps it", async ({
	page,
}) => {
	await page.goto("/");

	const side = page.getByRole("group", { name: "Side" });
	await expect(side).toBeVisible();

	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

	// The header holds nothing focusable before setup, so the first stop is the
	// side group — which is the claim "reachable by keyboard alone" makes.
	await page.keyboard.press("Tab");
	const radiant = page.getByRole("radio", { name: "R Radiant" });
	await expect(radiant).toBeFocused();

	// The ring is drawn on the enclosing label by `:has(input:focus-visible)`;
	// the input itself carries `outline: none`. Walking up from
	// `document.activeElement` compares the two labels without naming a
	// selector — and `:focus-visible` only matches because the focus arrived
	// from the Tab above, never from a scripted `focus()`.
	const [focusedRing, unfocusedRing] = await page.evaluate(() => {
		const ring = (element: Element) => {
			const style = getComputedStyle(element);
			return `${style.outlineStyle} ${style.outlineWidth}`;
		};
		const label = document.activeElement?.parentElement;
		const sibling = [...(label?.parentElement?.children ?? [])].find(
			(child) => child !== label,
		);
		if (!label || !sibling) throw new Error("no label pair around the radio");
		return [ring(label), ring(sibling)];
	});
	expect(focusedRing).not.toBe(unfocusedRing);
	expect(focusedRing).not.toContain("none");

	await page.keyboard.press("Space");
	await expect(radiant).toBeChecked();

	// A side alone is not a set-up session: the board needs both fields.
	await expect(page.getByRole("region", { name: "Bans" })).toBeHidden();

	// One Tab leaves the whole side group — a radio group is a single stop.
	await page.keyboard.press("Tab");
	await expect(page.getByRole("radio", { name: "1 C Carry" })).toBeFocused();

	// Arrow keys move within the group: from Carry, one step down is Mid. The
	// second choice completes the session, so the controls unmount with it and
	// the header below is where the choice can still be read.
	await page.keyboard.press("ArrowDown");

	const bans = page.getByRole("region", { name: "Bans" });
	// The summary's whole name, not a substring: every my-team slot carries a
	// `Pick for <role>` button, so `/Mid/` alone matches two controls.
	const summary = page.getByRole("button", { name: "Radiant · Mid edit" });
	await expect(bans).toBeVisible();
	await expect(side).toBeHidden();
	await expect(summary).toBeVisible();

	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

	await page.reload();

	await expect(bans).toBeVisible();
	await expect(side).toBeHidden();
	await expect(summary).toBeVisible();
});

test("the document hotkeys set up a session with nothing focused", async ({
	page,
}) => {
	await page.goto("/");
	await expect(page.getByRole("group", { name: "Side" })).toBeVisible();

	await page.keyboard.press("r");
	await expect(page.getByRole("radio", { name: "R Radiant" })).toBeChecked();

	await page.keyboard.press("3");
	await expect(page.getByRole("region", { name: "Bans" })).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Radiant · Offlane edit" }),
	).toBeVisible();
});

test("a cold-cache snapshot failure recovers through retry", async ({
	page,
}) => {
	// An abort, not a delayed response: `fetchBundle` carries
	// `AbortSignal.timeout(8000)` and a stall would burn it inside the test.
	await page.route("**/snapshot.json", (route) =>
		route.abort("connectionfailed"),
	);
	await page.goto("/");

	// The message has to be *inside* the live region — a region that announces
	// nothing is the failure this asserts against.
	await expect(page.getByRole("status")).toContainText(
		"No snapshot could be loaded",
	);
	const retry = page.getByRole("button", { name: "Retry" });
	await expect(retry).toBeVisible();

	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

	await page.unroute("**/snapshot.json");
	// A value that only survives if the document does — retry must re-fetch,
	// not navigate.
	await page.evaluate(() => {
		(window as Window & { e2eWitness?: number }).e2eWitness = 1;
	});

	await retry.click();

	await expect(page.getByRole("group", { name: "Side" })).toBeVisible();
	expect(
		await page.evaluate(
			() => (window as Window & { e2eWitness?: number }).e2eWitness,
		),
	).toBe(1);
});
