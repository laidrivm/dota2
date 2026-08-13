import { describe, expect, test } from "bun:test";
import { lstatSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Every class a component reads off a CSS module is one that module defines.
 *
 * This is the migration's one silent failure: the bundler owns the names, so a
 * read that matches nothing is `undefined` rather than an error. The rule stops
 * applying, the component still renders, and neither the type checker nor the
 * e2e suite — which locates by role and text, never by class — says a word.
 */

// The listing is taken at the repository root, never at `cwd`, the shape
// `scripts/no-suppressions.ts` uses: `git ls-files` run in a subdirectory
// reports only what is under it and names it relative to it.
const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"]);
if (top.exitCode !== 0) throw new Error(top.stderr.toString());
const root = top.stdout.toString().trim();

const ls = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: root });
if (ls.exitCode !== 0) throw new Error(ls.stderr.toString());

/**
 * Exempt because it is prose, and prose is the only thing here that writes an
 * import of a stylesheet without performing one — the four artefacts of this
 * change all do. Naming the source extensions instead is a list that grows
 * silently: `.ts` and `.tsx` would leave `.jsx` and `.mjs` unscanned, and the
 * first such file to arrive would be exempt with nobody deciding that.
 */
const PROSE = [".md"];

const tracked = ls.stdout
	.toString()
	.split("\0")
	.filter(Boolean)
	.filter((path) => !PROSE.some((ext) => path.endsWith(ext)))
	// Tracked but absent from the work tree, or a gitlink that reads as a
	// directory — neither is a file to open.
	.filter((path) =>
		lstatSync(join(root, path), { throwIfNoEntry: false })?.isFile(),
	);

const read = (path: string) => readFileSync(join(root, path), "utf8");

/**
 * `source` with its comments and regex literals — and, when `strings` is set,
 * its string literals — replaced by spaces, so what is left at a given offset
 * is code and nothing else. Lengths and newlines are preserved, so the result
 * can be matched in place of the original.
 *
 * A left-to-right scan carrying state, because deciding what a character means
 * without knowing what it sits inside is one mistake, and the shapes it takes
 * — an escaped quote ending a string early, a `/*` inside a line comment, a
 * quote inside a regex literal swallowing the rest of the file — are one bug.
 * Not a parser: the only question asked of each character is what encloses it.
 */
function blank(source: string, strings: boolean): string {
	const out = [...source];
	const erase = (from: number, to: number) => {
		for (let k = from; k < to && k < out.length; k++) {
			if (out[k] !== "\n") out[k] = " ";
		}
	};

	// A `/` opens a regex literal only where a value may begin; after one it is
	// division. The last non-space character is what tells them apart.
	const OPENS_VALUE = "(,=:[!&|?{};+-*%~^<>";
	let previous = "";
	let i = 0;

	while (i < source.length) {
		const c = source[i] as string;
		const next = source[i + 1];

		if (c === "'" || c === '"' || c === "`") {
			const start = i;
			i++;
			while (i < source.length && source[i] !== c) {
				if (source[i] === "\\") {
					i += 2;
					continue;
				}
				// A raw newline cannot sit inside a '' or "" literal, so a quote
				// that opened no string stops here instead of swallowing the rest
				// of the file and taking the scan silent with it.
				if (source[i] === "\n" && c !== "`") break;
				i++;
			}
			if (source[i] === c) i++;
			if (strings) erase(start, i);
			previous = c;
		} else if (c === "/" && next === "/") {
			const start = i;
			while (i < source.length && source[i] !== "\n") i++;
			erase(start, i);
		} else if (c === "/" && next === "*") {
			const start = i;
			i += 2;
			while (i < source.length && !(source[i] === "*" && source[i + 1] === "/"))
				i++;
			i += 2;
			erase(start, i);
		} else if (
			c === "/" &&
			(previous === "" || OPENS_VALUE.includes(previous))
		) {
			const start = i;
			i++;
			let inClass = false;
			while (i < source.length) {
				if (source[i] === "\\") {
					i += 2;
					continue;
				}
				if (source[i] === "[") inClass = true;
				else if (source[i] === "]") inClass = false;
				// An unterminated literal is a syntax error, not something to scan
				// past: stop at the newline rather than run to end of input.
				else if (source[i] === "\n") break;
				else if (source[i] === "/" && !inClass) break;
				i++;
			}
			if (source[i] === "/") i++;
			erase(start, i);
			previous = "/";
		} else {
			if (c.trim() !== "") previous = c;
			i++;
		}
	}

	return out.join("");
}

/** The class selectors a module defines. */
const defined = (css: string) =>
	new Set(
		[...blank(css, false).matchAll(/\.([A-Za-z][\w-]*)/g)].map(
			(match) => match[1] as string,
		),
	);

/** Every `<binding>.<name>` a source file reads off an imported CSS module, as
 * `[module path relative to the repository root, name]`. */
function reads(path: string, source: string): [string, string][] {
	const found: [string, string][] = [];
	// The import's specifier is itself a string, so it is read from the source
	// that still has them; the reads are read from the source that does not.
	const spelled = blank(source, false);
	const code = blank(source, true);

	for (const [, binding, specifier] of spelled.matchAll(
		/import\s+(\w+)\s+from\s+["']([^"']+\.module\.css)["']/g,
	)) {
		const module = resolve(
			dirname(join(root, path)),
			specifier as string,
		).slice(root.length + 1);
		for (const [, name] of code.matchAll(
			new RegExp(`(?<![\\w.])${binding}\\.(\\w+)`, "g"),
		)) {
			found.push([module, name as string]);
		}
	}

	return found;
}

const classes = new Map(
	tracked
		.filter((path) => path.endsWith(".module.css"))
		.map((module) => [module, defined(read(module))] as const),
);

const readers = tracked
	.map((path) => [path, reads(path, read(path))] as const)
	.filter(([, names]) => names.length > 0);

describe("class names read off a CSS module", () => {
	// A sweep that found nothing would pass every assertion below vacuously.
	test("there are modules, and files reading them", () => {
		expect(classes.size).toBeGreaterThan(0);
		expect(readers.length).toBeGreaterThan(0);
	});

	test.each(readers)("%s reads only names its module defines", (_, names) => {
		for (const [module, name] of names) {
			expect(classes.get(module) ?? new Set()).toContain(name);
		}
	});
});
