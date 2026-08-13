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
 * A `/` opens a regex literal only where a value may begin; after one it is
 * division. The token before it is what tells them apart — a character for
 * punctuation, a word for the keywords a value may follow.
 */
const OPENS_VALUE = "(,=:[!&|?{};+-*%~^<>";
const OPENS_VALUE_WORDS = new Set([
	"return",
	"typeof",
	"instanceof",
	"in",
	"of",
	"case",
	"do",
	"else",
	"yield",
	"await",
	"new",
	"delete",
	"void",
	"throw",
]);

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
 * A template literal is two things at once, so its text is blanked and its
 * `${…}` is not: the expression is code, and a read inside one is a read.
 *
 * Not a parser: the only question asked of each character is what encloses it.
 */
function blank(source: string, strings: boolean): string {
	const out = [...source];
	const erase = (from: number, to: number) => {
		for (let k = from; k < to && k < out.length; k++) {
			if (out[k] !== "\n") out[k] = " ";
		}
	};

	// One entry per template literal currently open, holding the `{` nesting
	// inside its interpolation, or `null` while its text rather than an
	// expression is being read. An empty stack is ordinary code.
	const templates: (number | null)[] = [];
	let span = 0; // where the template text being blanked started
	let previous = "";
	let i = 0;

	const word = (at: number) => {
		let end = at;
		while (end < source.length && /[A-Za-z_$]/.test(source[end] as string))
			end++;
		return source.slice(at, end);
	};

	while (i < source.length) {
		const c = source[i] as string;
		const next = source[i + 1];
		const inText = templates.length > 0 && templates.at(-1) === null;

		if (inText) {
			if (c === "\\") {
				i += 2;
			} else if (c === "`") {
				if (strings) erase(span, i);
				templates.pop();
				i++;
				previous = "`";
			} else if (c === "$" && next === "{") {
				if (strings) erase(span, i);
				templates[templates.length - 1] = 0;
				i += 2;
				previous = "{";
			} else {
				i++;
			}
			continue;
		}

		if (c === "'" || c === '"') {
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
				if (source[i] === "\n") break;
				i++;
			}
			if (source[i] === c) i++;
			if (strings) erase(start, i);
			previous = c;
		} else if (c === "`") {
			templates.push(null);
			span = i + 1;
			i++;
		} else if (c === "}" && templates.length > 0 && templates.at(-1) === 0) {
			// The brace that closes the interpolation, so its template's text
			// resumes here.
			templates[templates.length - 1] = null;
			span = i + 1;
			i++;
		} else if (c === "{" && templates.length > 0 && templates.at(-1) !== null) {
			templates[templates.length - 1] = (templates.at(-1) as number) + 1;
			previous = c;
			i++;
		} else if (c === "}" && templates.length > 0 && templates.at(-1) !== null) {
			templates[templates.length - 1] = (templates.at(-1) as number) - 1;
			previous = c;
			i++;
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
			(previous === "" ||
				OPENS_VALUE.includes(previous) ||
				OPENS_VALUE_WORDS.has(previous))
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
		} else if (/[A-Za-z_$]/.test(c)) {
			const found = word(i);
			previous = found;
			i += found.length;
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

describe("what the scan counts as code", () => {
	const kept = (source: string) => blank(source, true).includes("s.name");

	// The fixtures are written as template literals so an interpolation can be
	// escaped into them: a plain string spelling `${` reads as one nobody meant.
	test.each([
		["a plain read", "const a = s.name;"],
		["a read inside a template expression", `const a = \`\${s.name}\`;`],
		["a read inside a nested template", `const a = \`\${\`\${s.name}\`}\`;`],
		["a read after an interpolation closes", `const a = \`\${1}\` + s.name;`],
	])("keeps %s", (_, source) => expect(kept(source)).toBe(true));

	test.each([
		["a string", "const a = 's.name';"],
		["a line comment", "// s.name"],
		["a block comment", "/* s.name */"],
		["template text", "const a = `text s.name`;"],
		["a regex literal", "const a = /s.name/;"],
		["a regex after return", "function f() { return /s.name/; }"],
		["a regex after an arrow", "const f = () => /s.name/;"],
		["a regex after typeof", "const a = typeof /s.name/;"],
	])("drops %s", (_, source) => expect(kept(source)).toBe(false));

	test("a division is not a regex, so what follows it is still code", () => {
		expect(blank("const a = 1 / 2; const b = s.name;", true)).toContain(
			"s.name",
		);
	});
});

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
