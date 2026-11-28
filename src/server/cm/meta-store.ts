/**
 * The uploaded meta on disk (design D5, D11): one file per position under
 * `CM_DATA_DIR`, `meta-pos-<n>.json`, written to a temporary name and renamed
 * over the old one, so a write that stops part-way leaves the previous upload
 * whole rather than half of the new one.
 */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MetaUpload } from "./d2pt.ts";
import { type Positions, StoredMeta } from "./meta-schema.ts";

const fileOf = (dir: string, position: number) =>
	join(dir, `meta-pos-${position}.json`);

/** Every position's upload, `null` where there is none or it cannot be read. */
export async function readStore(dir: string): Promise<Positions> {
	const read = async (position: number) => {
		try {
			// Parsed through the contract: a file this code did not write, or
			// one from before a schema change, reads as nothing stored.
			const parsed = StoredMeta.safeParse(
				JSON.parse(await readFile(fileOf(dir, position), "utf8")),
			);
			return parsed.success ? parsed.data : null;
		} catch {
			return null;
		}
	};
	const [one, two, three, four, five] = await Promise.all(
		[1, 2, 3, 4, 5].map(read),
	);
	return {
		"1": one ?? null,
		"2": two ?? null,
		"3": three ?? null,
		"4": four ?? null,
		"5": five ?? null,
	};
}

/** `upload` stored as its position's meta, replacing what was there. */
export async function writePosition(
	dir: string,
	upload: MetaUpload,
	uploadedAt: string,
	// Injected so a case can stop the write at the rename.
	commit: (from: string, to: string) => Promise<void> = rename,
): Promise<StoredMeta> {
	const stored: StoredMeta = {
		patch: upload.patch,
		uploadedAt,
		heroes: upload.heroes,
	};
	await mkdir(dir, { recursive: true });
	const target = fileOf(dir, upload.position);
	const temporary = `${target}.${crypto.randomUUID()}.tmp`;
	// The write as well as the rename: a disk that fills part-way through
	// leaves a temporary file behind otherwise, one per attempt.
	try {
		await writeFile(temporary, JSON.stringify(stored));
		await commit(temporary, target);
	} catch (error) {
		await rm(temporary, { force: true });
		throw error;
	}
	return stored;
}
