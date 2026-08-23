/**
 * The hero image mirror.
 *
 * `app-shell` forbids the running application any request off its own origin,
 * so an image URL carried through from its source would be a bundle the client
 * cannot render without breaking that requirement. Each image is fetched once
 * and stored under a directory this application serves, and what a hero carries
 * is the path it landed on.
 *
 * The serving route resolves that directory per request, so a file appearing
 * under its final name before it is complete would be served truncated. Every
 * download therefore lands on a name the route cannot serve and is moved to its
 * final one only once the whole file is on disk: the move is what makes the
 * file's appearance and its completeness the same event.
 */
import { rename, unlink } from "node:fs/promises";
import { join } from "node:path";

/**
 * How long one image download may stay open, the body's arrival included.
 * `fetch` waits indefinitely by default, and `Bun.write` waits on the body it
 * is given — so a CDN that accepts the connection and then stalls would hold
 * the whole run, which promises one outcome and an exit code.
 */
const DOWNLOAD_TIMEOUT_MS = 30_000;

/** What a hero's `icon` column holds: a path on this origin, never a URL. */
export const iconPath = (shortName: string) => `/icons/${shortName}.png`;

/** The file a hero's image lands on, and the name it lands on first. */
const finalName = (shortName: string) => `${shortName}.png`;
// Not `.png`, so the route's own listing cannot match it while it is being
// written. The dot keeps it out of a shell glob as well, which is worth the
// character the first time somebody clears the directory by hand.
const partName = (shortName: string) => `.${shortName}.png.part`;

/** A hero as the mirror needs it: where its image lives, and what to call it. */
export type MirroredHero = { shortName: string; imageUrl: string };

/**
 * Fetch every hero's image that is not already mirrored into `dir`.
 *
 * A hero already present is not fetched again: the files are immutable under
 * their names, and refetching 127 of them nightly would be the run's largest
 * transfer for no change. A hero with no file whose fetch fails ends the run —
 * a tile with a broken image is worse than a run that retries tomorrow.
 *
 * Exactly one size is mirrored. A screen needing a second is the change that
 * adds it, not a second download this one performs speculatively.
 */
export async function mirrorIcons(
	heroes: MirroredHero[],
	dir: string,
	doFetch: typeof globalThis.fetch = globalThis.fetch,
): Promise<void> {
	for (const hero of heroes) {
		// The names arrive in a vendor's response, and `join` follows a `../`
		// out of the directory as readily as it appends a filename. Anchored at
		// both ends rather than searched for separators: what may be written
		// here is a hero's slug, and anything else is refused whole.
		if (!/^[a-z0-9_-]+$/.test(hero.shortName))
			throw new Error(
				`the source named a hero ${JSON.stringify(hero.shortName)}, which is not a name this mirror will write`,
			);
		const final = join(dir, finalName(hero.shortName));
		if (await Bun.file(final).exists()) continue;
		const part = join(dir, partName(hero.shortName));
		try {
			const response = await doFetch(hero.imageUrl, {
				signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
			});
			if (!response.ok)
				throw new Error(`the source answered ${response.status}`);
			// Resolves once the whole body is on disk, which is the precondition
			// the move below turns into the file's existence.
			//
			// Measured against bun 1.3.14: `Bun.write` materialises the file
			// only when the body completes, so writing straight to `final`
			// would look identical from outside and no test here distinguishes
			// the two. That is an implementation detail of one runtime and one
			// body size, not a promise — the move is what the requirement rests
			// on, and it costs a rename.
			await Bun.write(part, response);
		} catch (cause) {
			// A body that failed halfway leaves a partial file behind. It is
			// under a name nothing serves, but a later run would take it for a
			// download in flight rather than the wreck of one.
			await unlink(part).catch(() => {});
			throw new Error(
				`the image for ${hero.shortName} could not be mirrored: ${cause instanceof Error ? cause.message : String(cause)}`,
			);
		}
		await rename(part, final);
	}
}
