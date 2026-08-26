/**
 * What a response says about the quota, and the arithmetic that paces a run
 * inside it.
 *
 * Pure: nothing here reads a clock or waits on one. `stratz.ts` owns the
 * waiting, because a module that only answers "when may the next request go
 * out" can be read against a case without a timer in front of it — and the
 * pacing is the part a wrong answer costs a whole run's quota.
 *
 * The API states a ceiling and a remainder per window and names the window,
 * carrying both on every response; it never says how long a window is. So the
 * ceilings are read and the lengths are named here, and the two are kept
 * apart because only one of them is this repository's to know.
 */

/**
 * How long each window the API names lasts.
 *
 * The one thing a response does not carry: it states a ceiling and a remainder
 * per window and names the window, but never says how long the window is. So
 * the length comes from the name, and a name absent here is a window this
 * client cannot pace at all — there is no span to count requests over. Such a
 * window is left out of `stated` rather than kept and skipped: a ceiling held
 * and then ignored reads as paced, and a service naming a window this
 * repository has never seen is better answered by the run ending when that
 * window reports nothing left than by a guessed length.
 */
export const WINDOW_MS: Record<string, number> = {
	second: 1_000,
	minute: 60_000,
	hour: 3_600_000,
	day: 86_400_000,
};

/** One window the response stated: what it admits, and over how long. */
export type Ceiling = { limit: number; span: number };

/**
 * The windows a response states, by name.
 *
 * Matched by shape rather than enumerated: the probe recorded four
 * `x-ratelimit-limit-*` ceilings, and an enumeration here would miss a fifth
 * window the service added. Read off the ceiling headers alone: the remainder
 * beside each is what a spent window is read from, and pacing needs only how
 * many a window admits.
 *
 * A ceiling that is not a positive whole number states no window. An
 * unparseable one bounds nothing and a zero one would hold every request for
 * ever; a fractional one is worse than either, since the count it is compared
 * against is a length — `readyAt` would index between two instants, get
 * `undefined`, and pace that window by nothing at all. Neither does a window
 * whose name carries no length, for the reason `WINDOW_MS` gives: every
 * ceiling this answers with is one the client can hold.
 */
export function stated(headers: Headers): Map<string, Ceiling> {
	const found = new Map<string, Ceiling>();
	for (const [header, value] of headers) {
		const named = /^x-ratelimit-limit-(.+)$/i.exec(header);
		if (named?.[1] === undefined) continue;
		const name = named[1].toLowerCase();
		const limit = Number(value);
		if (!Number.isInteger(limit) || limit <= 0) continue;
		const span = WINDOW_MS[name];
		if (span === undefined) continue;
		found.set(name, { limit, span });
	}
	return found;
}

/** What a spent window means: a wait a run outlasts, or the end of the run. */
export type Verdict = { name: string; span: number; longest: boolean };

/**
 * The window this response reports nothing left in, and whether it is the
 * longest the response states — or `undefined` where every window has room.
 *
 * A blank value is excluded because `Number("")` is 0, which would end a
 * healthy run on an empty header. An unparseable one needs no exclusion of its
 * own: it yields `NaN`, and every comparison against `NaN` is false.
 *
 * The longest spent window is the one returned, because that is the answer
 * that decides the run: a response reporting both a spent day and a spent
 * minute is a run that ends, not one that waits a minute and ends anyway.
 */
export function drained(headers: Headers): Verdict | undefined {
	const windows = stated(headers);
	const longest = Math.max(0, ...[...windows.values()].map(({ span }) => span));
	let worst: { name: string; span: number } | undefined;
	for (const [header, value] of headers) {
		const named = /^x-ratelimit-remaining-(.+)$/i.exec(header);
		if (named?.[1] === undefined) continue;
		if (value.trim() === "" || !(Number(value) <= 0)) continue;
		const name = named[1].toLowerCase();
		const span =
			windows.get(name)?.span ?? WINDOW_MS[name] ?? Number.POSITIVE_INFINITY;
		if (worst === undefined || span > worst.span) worst = { name, span };
	}
	return worst === undefined
		? undefined
		: { ...worst, longest: worst.span >= longest };
}

/**
 * When the request now due may go out, given every window the last response
 * stated and the instants this client has already issued at.
 *
 * `issued` holds one timestamp per request, oldest first, rather than one ring
 * per window: a window's occupancy is a count over the tail of that one list,
 * and one list cannot disagree with itself about how many requests there were.
 *
 * ponytail: the list is scanned per window per request, so the work per
 * request is the largest ceiling times the number of windows — a few tens of
 * thousands of comparisons against a network call. A ring per window arrives
 * when that stops being free.
 */
export function readyAt(
	issued: number[],
	ceilings: Map<string, Ceiling>,
	now: number,
): number {
	let ready = now;
	for (const { limit, span } of ceilings.values()) {
		// The requests still inside this window, and the one that has to leave
		// it before there is room: with `limit` inside, that is the `limit`th
		// from the end.
		const inside = issued.filter((at) => now - at < span);
		if (inside.length < limit) continue;
		const leaves = (inside[inside.length - limit] as number) + span;
		if (leaves > ready) ready = leaves;
	}
	return ready;
}

/**
 * `issued` with every instant older than the longest window anything is paced
 * by dropped, in place.
 *
 * In place because the caller holds the list across requests: an instant
 * inside no window bounds nothing, and a list nobody pruned grows for as long
 * as the run does. With no window of a length this client knows, the list is
 * emptied — nothing is paced by it, so nothing is lost by dropping it.
 */
export function prune(
	issued: number[],
	ceilings: Map<string, Ceiling>,
	now: number,
): void {
	const longest = Math.max(
		0,
		...[...ceilings.values()].map(({ span }) => span),
	);
	while (issued.length > 0 && now - (issued[0] as number) >= longest)
		issued.shift();
}
