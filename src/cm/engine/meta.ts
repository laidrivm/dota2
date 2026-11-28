/**
 * The captain's uploaded d2pt meta folded into the snapshot the engine reads
 * (design D9), so every other part of the engine stays a function of one
 * snapshot. At a position with an upload:
 *
 *   meta(h, k) = s_k · (rating − 50) / 50
 *
 * with `s_k` chosen so the mapped ratings spread as the snapshot's meta does
 * at `k` (standard deviation over the heroes each rates), which keeps an
 * uploaded position comparable with one that is not. A hero the upload rates
 * plays there; one it leaves unrated, or does not list, does not.
 */
import type { HeroEntry, SnapshotBundle } from "../../types.ts";
import { PLAYABLE_SHARE } from "./value.ts";

type Key = "1" | "2" | "3" | "4" | "5";
const KEYS: Key[] = ["1", "2", "3", "4", "5"];

/** What the engine reads of `GET /api/cm/meta`: each hero's rating by position. */
export type Uploads = Partial<
	Record<Key, { heroes: Record<string, { rating: number | null }> } | null>
>;

/** Population standard deviation; 0 for fewer than two values. */
function spread(values: number[]): number {
	if (values.length < 2) return 0;
	const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
	return Math.sqrt(
		values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length,
	);
}

/** `bundle` with each uploaded position's meta taken from its ratings. */
export function withUploads(
	bundle: SnapshotBundle,
	uploads: Uploads,
): SnapshotBundle {
	const uploaded = KEYS.filter((k) => uploads[k] != null);
	if (uploaded.length === 0) return bundle;

	let heroes: HeroEntry[] = bundle.heroes;
	for (const k of uploaded) {
		// The filter above leaves only positions with an upload.
		const rated = (uploads[k] as NonNullable<Uploads[Key]>).heroes;
		const ratingOf = (hero: HeroEntry) =>
			rated[String(hero.id)]?.rating ?? null;
		const snapshotMeta = bundle.heroes.flatMap((hero) => {
			const at = hero.positions[k];
			return hero.sufficient && at?.sufficient ? [at.meta] : [];
		});
		const ratings = bundle.heroes.flatMap((hero) => {
			const rating = ratingOf(hero);
			return rating === null ? [] : [rating];
		});
		// The spread of (rating − 50) / 50, which a shift does not move.
		const unitSpread = spread(ratings) / 50;
		const scale = unitSpread === 0 ? 0 : spread(snapshotMeta) / unitSpread;
		heroes = heroes.map((hero) => {
			const rating = ratingOf(hero);
			const { [k]: at, ...others } = hero.positions;
			// No entry at `k` is what unplayable means to the engine.
			if (rating === null) return { ...hero, positions: others };
			const position = {
				share: Math.max(at?.share ?? 0, PLAYABLE_SHARE),
				meta: (scale * (rating - 50)) / 50,
				sufficient: true,
			};
			return { ...hero, positions: { ...others, [k]: position } };
		});
	}
	return { ...bundle, heroes };
}
