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
 * `source` with its comments — and, as asked, its string and regex literals —
 * replaced by spaces, so what is left at a given offset is code and nothing
 * else. Lengths and newlines are preserved, so a token found in the result can
 * be read back out of the original at the same place.
 *
 * `regex` is off for CSS, which has no regex literals: a `/` there opens a
 * path inside `url()`, and treating it as a literal would erase to the next
 * one.
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
function blank(
	source: string,
	{ strings, regex }: { strings: boolean; regex: boolean },
): string {
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
			regex &&
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

/** The class selectors a module defines. Strings go, because a quoted `.name`
 * in a `content` or a `url()` names no class and would define one. */
const defined = (css: string) =>
	new Set(
		[
			...blank(css, { strings: true, regex: false }).matchAll(
				/\.([A-Za-z][\w-]*)/g,
			),
		].map((match) => match[1] as string),
	);

/**
 * Every class a source file reads off an imported CSS module, as `[module path
 * relative to the repository root, name]`.
 *
 * Both an import's specifier and a bracket read's name are strings, and the
 * blanked source no longer carries either. Blanking preserves offsets, so each
 * is taken back out of the source at the place the surrounding code was proved
 * to be code — rather than matched in a source where a string spelling
 * `import s from "./x.module.css"` would read as an import.
 */
function reads(path: string, source: string): [string, string][] {
	const found: [string, string][] = [];
	const code = blank(source, { strings: true, regex: true });
	const after = (match: RegExpExecArray | RegExpMatchArray) =>
		source.slice((match.index as number) + match[0].length);

	// `from` is not followed by `\s+` here: the specifier is blanked to spaces,
	// so a greedy run would swallow it and `after` would point past the string.
	for (const statement of code.matchAll(/\bimport\s+(\w+)\s+from\b/g)) {
		const specifier = /^\s*(["'])([^"']+)\1/.exec(after(statement));
		if (specifier === null) continue;
		const target = specifier[2] as string;
		if (!target.endsWith(".module.css")) continue;

		const module = resolve(dirname(join(root, path)), target).slice(
			root.length + 1,
		);
		// `binding` is `\w+` by construction, so it carries nothing to escape.
		const binding = statement[1] as string;

		for (const access of code.matchAll(
			new RegExp(`(?<![\\w.])${binding}(?:\\.(\\w+)|\\[)`, "g"),
		)) {
			const dotted = access[1];
			if (dotted !== undefined) {
				found.push([module, dotted]);
				continue;
			}
			// A bracket read is how a hyphenated class name is spelled, and
			// `defined` accepts those, so leaving it unmatched leaves it unchecked.
			const quoted = /^\s*(["'])([A-Za-z][\w-]*)\1\s*\]/.exec(after(access));
			if (quoted !== null) found.push([module, quoted[2] as string]);
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

describe("the classes a module defines", () => {
	test("a selector", () => {
		expect(defined(".real { color: red; }")).toEqual(new Set(["real"]));
	});

	test("not one named inside a value, which selects nothing", () => {
		expect(defined('.real { content: ".fake"; }')).toEqual(new Set(["real"]));
	});
});

describe("the classes a file reads", () => {
	// Placed beside a real module, so the resolved path is the real one.
	const at = "src/app/board/probe.tsx";
	const module = "src/app/board/hero-tile.module.css";
	const imports = 'import s from "./hero-tile.module.css";\n';
	const names = (body: string) => reads(at, imports + body).map(([, n]) => n);

	test("resolves the module a read belongs to", () => {
		expect(reads(at, `${imports}const a = s.name;`)).toEqual([
			[module, "name"],
		]);
	});

	// The fixtures are written as template literals so an interpolation can be
	// escaped into them: a plain string spelling `${` reads as one nobody meant.
	test.each([
		["a plain read", "const a = s.name;"],
		["a read inside a template expression", `const a = \`\${s.name}\`;`],
		["a read inside a nested template", `const a = \`\${\`\${s.name}\`}\`;`],
		["a read after an interpolation closes", `const a = \`\${1}\` + s.name;`],
		["a bracket read", 'const a = s["name"];'],
		["a division before a read", "const a = 1 / 2; const b = s.name;"],
	])("finds %s", (_, body) => expect(names(body)).toEqual(["name"]));

	test("finds a hyphenated name, which only a bracket read can spell", () => {
		expect(names('const a = s["hero-name"];')).toEqual(["hero-name"]);
	});

	test.each([
		["a string", "const a = 's.name';"],
		["a line comment", "// s.name"],
		["a block comment", "/* s.name */"],
		["template text", "const a = `text s.name`;"],
		["a regex literal", "const a = /s.name/;"],
		["a regex after return", "function f() { return /s.name/; }"],
		["a regex after an arrow", "const f = () => /s.name/;"],
		["a regex after typeof", "const a = typeof /s.name/;"],
	])("ignores %s", (_, body) => expect(names(body)).toEqual([]));

	test("ignores an import spelled inside a string, which imports nothing", () => {
		const source = `const a = "import s from './fake.module.css'";\nconst b = s.name;`;
		expect(reads(at, source)).toEqual([]);
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
