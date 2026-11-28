/**
 * The meta routes' contracts (design D4), as schemas the responses are parsed
 * through before they leave and the types are derived from.
 */
import { z } from "zod";

const rateOrNull = z.number().min(0).max(1).nullable();

export const MetaHero = z.object({
	rating: z.number().min(0).max(100).nullable(),
	tier: z.string().nullable(),
	matches: z.number().int().nonnegative().nullable(),
	winRate: z.number().nullable(),
	phaseWinRates: z.object({
		first: rateOrNull,
		second: rateOrNull,
		last: rateOrNull,
	}),
});
export type MetaHero = z.infer<typeof MetaHero>;

export const StoredMeta = z.object({
	patch: z.string(),
	uploadedAt: z.iso.datetime({ offset: true }),
	heroes: z.record(z.string(), MetaHero),
});
export type StoredMeta = z.infer<typeof StoredMeta>;

/** `GET /api/cm/meta`: every position present, `null` where none is stored. */
export const Positions = z.object({
	"1": StoredMeta.nullable(),
	"2": StoredMeta.nullable(),
	"3": StoredMeta.nullable(),
	"4": StoredMeta.nullable(),
	"5": StoredMeta.nullable(),
});
export type Positions = z.infer<typeof Positions>;

/** `POST /api/cm/meta`'s answer to an upload it stored. */
export const Uploaded = z.object({
	position: z.number().int().min(1).max(5),
	heroes: z.number().int().nonnegative(),
	patch: z.string(),
	uploadedAt: z.iso.datetime({ offset: true }),
});
