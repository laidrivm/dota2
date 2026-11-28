/** The d2pt reader on its own, for shapes the route's cases do not reach. */
import { expect, test } from "bun:test";
import { dataFile, rows } from "./d2pt.fixture.ts";
import { readMeta } from "./d2pt.ts";

const ids = Array.from({ length: 130 }, (_, i) => i + 1);

test("rows naming their own position read once however many ways lead to them", () => {
	// devalue keeps shared identity: the same rows reached under no position
	// and under their own, pos 3.
	const heroes = rows(ids, 60);
	const upload = readMeta(
		dataFile({
			patch: "7.41f",
			all: { heroes },
			three: { position: "pos 3", heroes },
		}),
		new Set(ids),
	);
	expect(upload?.position).toBe(3);
	expect(Object.keys(upload?.heroes ?? {})).toHaveLength(60);
});
