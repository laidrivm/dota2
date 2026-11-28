/**
 * The CM session cookie: `<expiry seconds>.<base64url HMAC-SHA256>` of
 * `cm-session:<expiry>`, keyed by the deployment's password (design D2).
 * Nothing is stored server-side, and a changed password stops every cookie
 * the old one signed from verifying.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE = "cm_session";
/** Thirty days, the cookie's `Max-Age` and the signed expiry alike. */
export const LIFETIME_SECONDS = 30 * 86_400;

const sign = (password: string, expiry: number) =>
	createHmac("sha256", password)
		.update(`cm-session:${expiry}`)
		.digest("base64url");

/** Equal-length digests, so the comparison costs the same whatever differs. */
const sameText = (a: string, b: string) =>
	timingSafeEqual(
		createHash("sha256").update(a).digest(),
		createHash("sha256").update(b).digest(),
	);

export const passwordMatches = (given: string, password: string) =>
	sameText(given, password);

/** A cookie value expiring `LIFETIME_SECONDS` after `nowMs`. */
export function mint(password: string, nowMs: number) {
	const expiry = Math.floor(nowMs / 1000) + LIFETIME_SECONDS;
	return { value: `${expiry}.${sign(password, expiry)}`, expiry };
}

/**
 * The expiry, in seconds, of a cookie value that verifies under `password`
 * and has not expired at `nowMs`; `null` for anything else, malformed values
 * included — the whole value is matched, never a prefix of it.
 */
export function verify(
	value: string | undefined,
	password: string,
	nowMs: number,
): number | null {
	const match = /^(\d{1,12})\.([A-Za-z0-9_-]{43})$/.exec(value ?? "");
	if (!match) return null;
	const expiry = Number(match[1]);
	if (!sameText(match[2] ?? "", sign(password, expiry))) return null;
	return expiry * 1000 > nowMs ? expiry : null;
}
