/**
 * Every version in `package.json` names one version and not a set of them.
 *
 * `bunfig.toml`'s `[install] exact = true` states the policy and its reason —
 * a malicious release ships as a patch or minor bump, which a caret adopts
 * unread — but it governs only what `bun add` writes. A range typed into the
 * file by hand, or into `overrides`, which `bun add` never touches, passes
 * every gate this repository has. This is the gate it passes.
 *
 * A module of its own rather than the test that exercises it, the shape
 * `repo-layout.ts` and `file-size.ts` already have: what it answers is a
 * question about a manifest that does not exist yet, so it is a rule, and a
 * rule written inside its own test is one the fabricated inputs exist to
 * justify rather than to guard.
 */

/**
 * The fields holding shell commands rather than version specs, which is the
 * whole of what this scan exempts. Everything else is walked, `overrides` and
 * any field added later alike — a scan scoped by a list of the collections it
 * covers is one a new collection is silently outside of, and a dependency
 * field nobody thought to add to that list is exactly where an unread range
 * would sit.
 */
const EXEMPT = new Set(["scripts", "simple-git-hooks"]);

/**
 * Every way a spec names more than the one version it appears to: a widening
 * operator or comparator, a disjunction, a wildcard, a partial version — `6`
 * is every 6 and `6.16` every 6.16, which is the form that reads least like a
 * range and is the widest of them — and a hyphen span.
 *
 * Written as what a range is rather than as what a version is, because the
 * scan walks every field and most of them hold neither: `"module"`, `"d2ass"`
 * and `"./index.x.ts"` all have to pass, and a pattern asking what a version
 * looks like has to tell them apart from one. The cost is that a date would
 * read as a span; no field here holds one, and the report names the field.
 */
const RANGE =
	/^[\^~<>=]|\|\||^[x*]$|^\d+(\.\d+)?$|^\d+(\.\d+)*\.[x*]$|^\d[\d.]*\s*-\s*\d/i;

/** Every version in `manifest` that names a set, and an empty list when none. */
export function ranges(manifest: string): string[] {
	const found: string[] = [];

	const walk = (value: unknown, path: string) => {
		if (typeof value === "string") {
			if (RANGE.test(value))
				found.push(`package.json: ${path} is ${value}, not one version`);
			return;
		}
		// `null` first: it is an object to `typeof`, and `Object.entries` throws
		// on it rather than returning nothing.
		if (value === null || typeof value !== "object") return;
		for (const [key, inner] of Object.entries(value))
			walk(inner, `${path}.${key}`);
	};

	const parsed = JSON.parse(manifest) as Record<string, unknown>;
	for (const [key, value] of Object.entries(parsed))
		if (!EXEMPT.has(key)) walk(value, key);

	return found;
}
