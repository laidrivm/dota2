/**
 * Where the rendered bundle lands, and how it gets there without a reader
 * catching half of it.
 *
 * The serving route resolves the published name on every request, so a file
 * appearing under that name before it is complete would be served truncated.
 * The bundle is therefore written under a name the route cannot resolve and
 * moved onto the published one only once the whole of it is on disk: the move
 * is what makes the file's appearance and its completeness the same event.
 * This is `icons.ts`'s reasoning for the image mirror, applied to the one file
 * the client actually fetches.
 *
 * Which directory that is belongs to the caller, as the mirror's does: the
 * deployment mounts it, the route reads it, and neither fact is this module's.
 */
import { rename } from "node:fs/promises";
import { join } from "node:path";
import type { SQL } from "bun";
import type { SnapshotBundle } from "../../types.ts";
import { renderBundle } from "./render.ts";

/**
 * The name the route serves. Exported because the route resolves it and this
 * module writes it — one fact, two sites.
 */
export const PUBLISHED = "snapshot.json";

/**
 * The name a bundle is written under first.
 *
 * Not `snapshot.json`, so the route's lookup cannot resolve it while it is
 * being written, and a dotfile besides, which keeps it out of a shell glob the
 * first time somebody clears the directory by hand. Exported for the cases
 * that reach the state a crash between the write and the move leaves.
 */
export const PART = `.${PUBLISHED}.part`;

/**
 * Write `bundle` into `dir` under the name the route serves.
 *
 * Nothing is unlinked when the write fails: the wreck is under a name nothing
 * resolves, and the next publication writes over it. What a crash leaves and
 * what a caught failure leaves are then the same thing, which is one state to
 * reason about rather than two.
 */
export async function publishBundle(
	dir: string,
	bundle: SnapshotBundle,
): Promise<void> {
	// Serialised whole before anything is opened, so a bundle that cannot be
	// serialised leaves the directory as it found it.
	const bytes = JSON.stringify(bundle);
	const part = join(dir, PART);
	await Bun.write(part, bytes);
	await rename(part, join(dir, PUBLISHED));
}

/**
 * Render the newest published snapshot and publish it into `dir`.
 *
 * The raise from the render reaches the caller unchanged and nothing is
 * written — the file already at the published name stays the one served, which
 * is what a run that found nothing to publish should leave behind.
 */
export async function exportSnapshot(sql: SQL, dir: string): Promise<void> {
	await publishBundle(dir, await renderBundle(sql));
}
