/**
 * Everything the board has to turn into text or a colour decision.
 *
 * These are the only branches the board has: the components below are markup
 * over the values produced here, which is what keeps them testable without a
 * DOM.
 */

import { type PickPhase, ROLES, type Role } from "../../types.ts";

/** `Keeper of the Light` → `KEEP`. Letters only, so `Anti-Mage` → `ANTI`. */
export function heroAbbr(name: string): string {
	return name
		.replace(/[^A-Za-z]/g, "")
		.slice(0, 4)
		.toUpperCase();
}

const HEX = /^#([0-9a-f]{6})$/i;

/**
 * WCAG relative luminance of a `#rrggbb` colour, or `null` when the value is
 * not one — a custom property that does not resolve comes back as an empty
 * string, and a palette entry could be malformed.
 */
export function relativeLuminance(color: string): number | null {
	const digits = HEX.exec(color.trim())?.[1];
	if (digits === undefined) return null;

	const channel = (offset: number) => {
		const c = Number.parseInt(digits.slice(offset, offset + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};

	return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

export type Ink = "dark" | "light";

/**
 * Where the tile switches from light lettering to dark: the luminance at
 * which black and white contrast equally, so whichever side a hero colour
 * falls on gets the ink that reads better on it. With the pure inks the
 * tokens now carry, every colour in the shipped palette clears WCAG AA —
 * the worst is 4.64:1. The palette is never restated in TypeScript.
 */
export const INK_THRESHOLD = 0.18;

export const inkFor = (luminance: number): Ink =>
	luminance >= INK_THRESHOLD ? "dark" : "light";

/** A colour we cannot read is assumed dark — the whole UI is. */
export function tileInk(color: string): Ink {
	const luminance = relativeLuminance(color);
	return luminance === null ? "light" : inkFor(luminance);
}

/** Always signed, never `-0.0`: `2.14 → +2.1`, `-0.04 → +0.0`. */
function signed(value: number, digits: number): string {
	const rounded = Number(value.toFixed(digits));
	return `${rounded < 0 ? "-" : "+"}${Math.abs(rounded).toFixed(digits)}`;
}

/** Suggestion score, normalised to percent as screens-spec §7.3 decided. */
export const formatScore = (pp: number): string => `${signed(pp, 1)}%`;

/** A score at or below zero must not read as a recommendation. */
export const scoreTone = (pp: number): "pos" | "muted" =>
	pp > 0 ? "pos" : "muted";

export const formatAdvantage = (pp: number): string => `${signed(pp, 1)} pp`;

/** Presented as an estimate, so no decimal place (screens-spec §2.7). */
export const formatWinProbability = (probability: number): string =>
	`~${Math.round(probability * 100)}% win`;

const PHASE_LABEL: Record<PickPhase, string> = {
	p1: "1st",
	p2: "2nd",
	last: "last",
};

export const formatPhase = (phase: PickPhase): string => PHASE_LABEL[phase];

/**
 * `p1 62% · p2 31%` — the two likeliest positions for an enemy pick. A term
 * that rounds to zero is dropped rather than shown as `0%`, and equal
 * probabilities are ordered by role so the line does not reshuffle itself
 * between recomputes.
 */
export function topRoles(probs: Record<`${Role}`, number>): string {
	return ROLES.map((role) => ({ role, probability: probs[`${role}`] ?? 0 }))
		.sort((a, b) => b.probability - a.probability || a.role - b.role)
		.slice(0, 2)
		.flatMap(({ role, probability }) => {
			const pct = Math.round(probability * 100);
			return pct > 0 ? [`p${role} ${pct}%`] : [];
		})
		.join(" · ");
}
