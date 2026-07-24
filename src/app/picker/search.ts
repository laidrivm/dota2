/**
 * What the picker's search field does to the hero list (screens-spec §3).
 *
 * Prefix matching over words, so `bone` reaches Clinkz through its legacy name
 * and `wk` reaches Wraith King through its abbreviation, while `ing` reaches
 * nothing — a substring search on 126 heroes returns a wall.
 */

import type { HeroEntry } from "../../types.ts";

/** Hyphens separate words too, so `mage` reaches Anti-Mage. */
const words = (value: string): string[] => value.toLowerCase().split(/[\s-]+/);

const byName = (a: HeroEntry, b: HeroEntry) =>
	a.name.localeCompare(b.name, "en");

/**
 * Heroes whose name or any alias has a word starting with `query`, in
 * ascending name order — which is what makes the first match positional and
 * saves the picker any scoring.
 */
export function matchHeroes(heroes: HeroEntry[], query: string): HeroEntry[] {
	const q = query.trim().toLowerCase();
	const matches =
		q === ""
			? [...heroes]
			: heroes.filter((hero) =>
					[hero.name, ...hero.aliases].some((value) =>
						words(value).some((word) => word.startsWith(q)),
					),
				);
	return matches.sort(byName);
}
