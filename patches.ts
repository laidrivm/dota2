/**
 * Patch detection: which patch a run's windows are measured from.
 *
 * The list comes from OpenDota rather than the statistics API, whose own
 * version list stopped roughly eight months before this change was written
 * while its match data did not (`design.md` §*Patch detection leaves the
 * statistics API*). What the rest of the run reads is the row in `patches`,
 * never the response: a release the source lists ahead of the run instant is
 * held without being current, and a patch already held keeps the
 * `detected_at` the first run wrote.
 */
import type { SQL } from "bun";

/** Where the patch list is published. */
const PATCH_LIST = "https://api.opendota.com/api/constants/patch";

/** Attempts one request gets in total, the first included. */
const ATTEMPTS = 4;

/** The wait before the first retry; each later one doubles it. */
const FIRST_BACKOFF_MS = 1000;

/** How long one attempt may stay open, the body's arrival included. */
const ATTEMPT_TIMEOUT_MS = 30_000;

const sleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A patch as `patches` holds it. */
export type Patch = {
	patchId: string;
	baseVersion: string;
	isMajor: boolean;
	detectedAt: Date;
};

/**
 * The list as it arrived, or a throw once the attempts are spent.
 *
 * The policy is the statistics client's — four attempts, doubling from a
 * second, thirty seconds each — written again rather than shared, because it
 * is a second vendor's: no key, no quota windows, no GraphQL envelope, and
 * nothing here that would move when the statistics API's terms do. A third
 * caller is what would make this one policy rather than two that agree.
 *
 * Every status is retried, a `404` included. It costs three waits on a run
 * that cannot proceed either way, and telling a vendor's outage from its
 * rename is not a distinction this run could act on.
 */
async function fetchList(doFetch: typeof globalThis.fetch): Promise<unknown> {
	let last = "";
	for (let n = 1; n <= ATTEMPTS; n++) {
		try {
			const response = await doFetch(PATCH_LIST, {
				signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
			});
			// Read inside the same attempt: a body that never finishes
			// streaming is the stall the bound above exists for.
			if (response.ok) return await response.json();
			last = `the patch source answered ${response.status}`;
		} catch {
			last = "the patch list request did not complete";
		}
		if (n < ATTEMPTS) await sleep(FIRST_BACKOFF_MS * 2 ** (n - 1));
	}
	throw new Error(
		`the patch list could not be read: ${last}; ${ATTEMPTS} attempts made`,
	);
}

/**
 * The patch the list ends on, split into the columns `patches` declares.
 *
 * Newest is the last entry rather than the latest `date`, because an entry
 * carrying no date has no place in an ordering by date — it would sort to one
 * end and be read as some other entry's problem, where the source's own order
 * still names it as the one this run depends on.
 */
function newest(listed: unknown): Patch {
	if (!Array.isArray(listed) || listed.length === 0)
		throw new Error("the patch source listed no patch");
	// `?? {}` because the entry is a vendor's: a `null` in the list would
	// otherwise raise a type error naming a property, where every other
	// malformed shape here is reported as the source's failure.
	const entry = (listed[listed.length - 1] ?? {}) as {
		name?: unknown;
		date?: unknown;
	};
	const name = typeof entry.name === "string" ? entry.name.trim() : "";
	if (name === "")
		throw new Error("the newest patch the source lists carries no name");
	const detectedAt = new Date(String(entry.date));
	if (Number.isNaN(detectedAt.getTime()))
		throw new Error(
			`the newest patch the source lists, ${name}, carries no release instant`,
		);
	// The source lists majors only, so in practice this branch guards the
	// vendor's format rather than describing a patch it has ever served: were
	// `7.41b` to appear, it is held under base version `7.41` instead of
	// inventing a major that does not exist.
	const isMajor = !/[a-z]$/i.test(name);
	return {
		patchId: name,
		baseVersion: isMajor ? name : name.slice(0, -1),
		isMajor,
		detectedAt,
	};
}

/**
 * Hold the newest patch the source lists, then answer which held patch is
 * current as of `at`.
 *
 * The insert does nothing to a patch already held, which is what keeps
 * `detected_at` the release instant the first run recorded rather than
 * whatever the source states today.
 */
export async function detectPatch(
	sql: SQL,
	at: Date,
	doFetch: typeof globalThis.fetch = globalThis.fetch,
): Promise<Patch> {
	const listed = newest(await fetchList(doFetch));
	await sql`INSERT INTO patches (patch_id, base_version, is_major, detected_at)
		VALUES (${listed.patchId}, ${listed.baseVersion}, ${listed.isMajor},
			${listed.detectedAt})
		ON CONFLICT (patch_id) DO NOTHING`;
	const [row] = await sql`SELECT patch_id, base_version, is_major, detected_at
		FROM patches WHERE detected_at <= ${at}
		ORDER BY detected_at DESC LIMIT 1`;
	if (row === undefined)
		throw new Error(
			`no held patch was released by ${at.toISOString()}; the source lists ${listed.patchId} as released later`,
		);
	return {
		patchId: row.patch_id,
		baseVersion: row.base_version,
		isMajor: row.is_major,
		detectedAt: row.detected_at,
	};
}
