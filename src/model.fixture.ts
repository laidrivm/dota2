/**
 * What the model's test files build a case out of: the shipped snapshot, the
 * hero ids they name it by, and an empty session to vary from.
 *
 * Its own module because the cases split across three files by the sections of
 * the model spec, and all three read the same fixture. A copy per file would
 * let the hero ids drift apart while every file still passed — and it is the
 * ids that say which case is which.
 */
import rawSnapshot from "./fixtures/snapshot.json" with { type: "json" };
import {
	EMPTY_SESSION,
	type HeroId,
	type Role,
	type Session,
	type SnapshotBundle,
} from "./types.ts";

/**
 * A cast, so nothing here checks that `snapshot.json` still matches
 * `SnapshotBundle` — and every case in all three files is written against the
 * shape this asserts. What stands in for the check is
 * `src/app/snapshot.test.ts`'s *accepts the shipped fixture*, which runs the
 * application's own `isBundle` over the same file: if the fixture drifts from
 * the contract, that fails rather than these silently testing a shape the
 * application would reject. The spelling matches the one there.
 */
export const bundle = rawSnapshot as unknown as SnapshotBundle;

/** Assert a lookup the test knows must succeed; throws instead of `!`. */
export function def<T>(v: T | null | undefined): T {
	if (v == null) throw new Error("expected a defined value");
	return v;
}

// Fixture hero ids used across tests.
export const H = {
	antiMage: 1,
	axe: 2,
	lifestealer: 54,
	invoker: 74,
	tidehunter: 29,
	pudge: 14,
	lich: 31,
	zeus: 22,
	clockwerk: 51,
	oracle: 111,
	clinkz: 56,
	razor: 15,
	undying: 85,
	lion: 26,
	spectre: 67,
	largo: 150, // insufficient-data hero
} as const;

export function session(over: Partial<Session> = {}): Session {
	return { ...EMPTY_SESSION(), createdAt: "fixed", ...over };
}

export function team(
	slots: Partial<Record<`${Role}`, HeroId>>,
): Session["teamPicks"] {
	return {
		"1": slots["1"] ?? null,
		"2": slots["2"] ?? null,
		"3": slots["3"] ?? null,
		"4": slots["4"] ?? null,
		"5": slots["5"] ?? null,
	};
}
