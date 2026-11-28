/** Reading a player from OpenDota, over a stub fetcher. */
import { expect, test } from "bun:test";
import type { Fetcher } from "./api.ts";
import { accountId, importProfile, medal } from "./profile-import.ts";
import { emptySession, reduce } from "./session.ts";

test.each([
	["86745912", "86745912"],
	["https://www.dotabuff.com/players/86745912", "86745912"],
	["https://stratz.com/players/86745912/matches", "86745912"],
	["https://www.opendota.com/players/86745912", "86745912"],
	["https://evil.com/players/86745912", null],
	["dotabuff", null],
])("%s names account %p", (text, id) => {
	expect(accountId(text)).toBe(id);
});

test.each<[unknown, number | null]>([
	[54, 5],
	[80, 8],
	[null, null],
	[95, null],
])("rank_tier %p is medal %p", (tier, expected) => {
	expect<number | null>(medal(tier)).toBe(expected);
});

const opendota =
	(profile: unknown, heroes: unknown): Fetcher =>
	async (url) =>
		Response.json(url.includes("/heroes") ? heroes : profile);

test("a profile brings its name, medal and five most played known heroes", async () => {
	const heroes = [1, 2, 3, 4, 5, 6, 7].map((id) => ({
		hero_id: String(id),
		games: id * 10,
	}));
	const found = await importProfile(
		"1",
		new Set([1, 2, 3, 4, 5, 6]),
		opendota({ profile: { personaname: " Miracle " }, rank_tier: 80 }, heroes),
	);
	expect(found).toEqual({
		nickname: "Miracle",
		rank: 8,
		signatures: [6, 5, 4, 3, 2],
	});
});

test("a player away for half a year brings their all-time heroes", async () => {
	const fetcher: Fetcher = async (url) =>
		Response.json(
			url.endsWith("?date=180")
				? [{ hero_id: 1, games: 0 }]
				: url.endsWith("/heroes")
					? [{ hero_id: 2, games: 300 }]
					: { profile: { personaname: "Away" }, rank_tier: 80 },
		);
	const found = await importProfile("1", new Set([1, 2]), fetcher);
	expect(found?.signatures).toEqual([2]);
});

test("an unknown account reads as nothing", async () => {
	const failing: Fetcher = async () => new Response(null, { status: 404 });
	expect(await importProfile("1", new Set(), failing)).toBeNull();
});

test("an import keeps what the profile leaves out", () => {
	const before = reduce(emptySession(), {
		type: "rank",
		team: "ours",
		index: 0,
		rank: 3,
	});
	const after = reduce(before, {
		type: "import",
		team: "ours",
		index: 0,
		nickname: null,
		rank: null,
		signatures: [7, 7, 8],
	});
	expect(after.ours[0]).toEqual({
		nickname: "Player 1",
		position: null,
		rank: 3,
		signatures: [7, 8],
	});
});
