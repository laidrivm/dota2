/**
 * A player read from OpenDota (v2): nickname, medal and most-played heroes.
 * The captain gives an account id or a Dotabuff, STRATZ or OpenDota profile
 * link — all three name the same Steam32 account id in `/players/<id>`.
 * Called from the captain's browser, so no server stands between them.
 */
import type { HeroId } from "../../types.ts";
import type { Fetcher } from "./api.ts";
import { NICKNAME_MAX, type RankTier, SIGNATURE_LIMIT } from "./session.ts";

const OPENDOTA = "https://api.opendota.com/api/players";

/** Heroes taken as signatures: the most played over the last half year. */
export const IMPORTED_SIGNATURES = 5;

/** The account id in `text`, or `null` when it names none. */
export function accountId(text: string): string | null {
	const trimmed = text.trim();
	if (/^\d{1,12}$/.test(trimmed)) return trimmed;
	const link =
		/^https?:\/\/(?:www\.)?(?:dotabuff\.com|stratz\.com|opendota\.com)\/players\/(\d{1,12})(?:[/?#].*)?$/.exec(
			trimmed,
		);
	return link?.[1] ?? null;
}

export interface Imported {
	nickname: string | null;
	rank: RankTier | null;
	signatures: HeroId[];
}

/** OpenDota's `rank_tier` (`54` is Legend 4, `80` Immortal) as a medal. */
export function medal(rankTier: unknown): RankTier | null {
	if (typeof rankTier !== "number" || !Number.isInteger(rankTier)) return null;
	const tier = Math.floor(rankTier / 10);
	return tier >= 1 && tier <= 8 ? (tier as RankTier) : null;
}

/** The player behind `id`, keeping only heroes `known` carries; `null` on failure. */
export async function importProfile(
	id: string,
	known: ReadonlySet<number>,
	fetcher: Fetcher = fetch,
): Promise<Imported | null> {
	try {
		const [profile, heroes] = await Promise.all([
			fetcher(`${OPENDOTA}/${id}`).then((r) => (r.ok ? r.json() : null)),
			fetcher(`${OPENDOTA}/${id}/heroes?date=180`).then((r) =>
				r.ok ? r.json() : null,
			),
		]);
		if (profile === null || !Array.isArray(heroes)) return null;
		const name = profile?.profile?.personaname;
		const nickname =
			typeof name === "string" && name.trim() !== ""
				? name.trim().slice(0, NICKNAME_MAX)
				: null;
		const signatures = heroes
			.map((h) => ({ hero: Number(h?.hero_id), games: Number(h?.games) }))
			.filter(({ hero, games }) => known.has(hero) && games > 0)
			.sort((a, b) => b.games - a.games)
			.slice(0, Math.min(IMPORTED_SIGNATURES, SIGNATURE_LIMIT))
			.map(({ hero }) => hero as HeroId);
		return { nickname, rank: medal(profile?.rank_tier), signatures };
	} catch {
		return null;
	}
}
