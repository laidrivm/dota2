import { describe, expect, test } from "bun:test";
import { lstatSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { blank } from "../../scripts/scan.ts";

const TSX = new Bun.Transpiler({ loader: "tsx" });

/**
 * A class and its rule stay in step: every class a component reads off a CSS
 * module is one that module defines, and every class a module defines is one
 * some component reads.
 *
 * Both directions fail silently, which is why both are checked. The bundler
 * owns the names, so a read that matches nothing is `undefined` rather than an
 * error — the rule stops applying, the component still renders, and neither the
 * type checker nor the e2e suite, which locates by role and text and never by
 * class, says a word. A rule left behind by a move is the same failure facing
 * the other way: it ships in the bundle styling nothing.
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
 * The class selectors a module defines.
 *
 * Only a rule's prelude is read — the text running up to the `{` that opens
 * its block. That is the one place a class selector can be: inside a block a
 * `.` opens a decimal or a file extension in `url(...)`, and a quoted `.name`
 * in a `content` selects nothing either.
 */
const defined = (css: string) => {
	const found = new Set<string>();

	for (const rule of blank(css, "css").matchAll(/([^;{}]*)\{/g)) {
		for (const name of (rule[1] as string).matchAll(/\.([A-Za-z][\w-]*)/g)) {
			found.add(name[1] as string);
		}
	}

	return found;
};

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
	// JSX is not TypeScript. To a lexical scan `/>` opens a regex literal, so
	// does `</span>`, and an apostrophe in element text opens a string — each
	// erasing the rest of its line and losing a read, which is the direction
	// that passes wrongly. Bun's transpiler removes JSX and keeps both the
	// import and the reads, so what gets scanned is plain JavaScript.
	let transpiled: string;
	try {
		transpiled = TSX.transformSync(source);
	} catch {
		// It does not parse, so it performs no import of a CSS module. Every
		// tracked file is offered here, most of them not source at all.
		return [];
	}

	const found: [string, string][] = [];
	const code = blank(transpiled, "ts");
	const after = (match: RegExpExecArray | RegExpMatchArray) =>
		transpiled.slice((match.index as number) + match[0].length);

	// `from` is not followed by `\s+` here: the specifier is blanked to spaces,
	// so a greedy run would swallow it and `after` would point past the string.
	for (const statement of code.matchAll(
		/\bimport\s+([A-Za-z_$][\w$]*)\s+from\b/g,
	)) {
		const specifier = /^\s*(["'])([^"']+)\1/.exec(after(statement));
		if (specifier === null) continue;
		const target = specifier[2] as string;
		if (!target.endsWith(".module.css")) continue;

		const module = resolve(dirname(join(root, path)), target).slice(
			root.length + 1,
		);
		// A `$` is a valid identifier character and a regex metacharacter, so the
		// binding is escaped before it becomes part of a pattern.
		const binding = (statement[1] as string).replace(/[$]/g, "\\$&");

		for (const access of code.matchAll(
			new RegExp(
				// Optional access is what `noUncheckedIndexedAccess` invites, so a
				// read spelled `s?.name` is a read like any other.
				`(?<![\\w.$])${binding}(?:\\??\\.(\\w+)|(?:\\?\\.)?\\[)`,
				"g",
			),
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

	// CSS has no `//` comment; reading one would blank the rest of the line.
	test("one after an unquoted URL on the same line", () => {
		const css = ".a { background: url(//cdn/x.png); } .b { color: red; }";
		expect(defined(css)).toEqual(new Set(["a", "b"]));
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
		["an optional read", "const a = s?.name;"],
		["an optional bracket read", 'const a = s?.["name"];'],
		["a division before a read", "const a = 1 / 2; const b = s.name;"],
	])("finds %s", (_, body) => expect(names(body)).toEqual(["name"]));

	test.each([
		["a bracket read", 'const a = s["hero-name"];'],
		["an optional bracket read", 'const a = s?.["hero-name"];'],
	])("finds a hyphenated name, which only %s can spell", (_, body) =>
		expect(names(body)).toEqual(["hero-name"]),
	);

	// JSX is what a lexical scan reads as regex and string syntax; each of these
	// erased the rest of its line before the transpiler was put in front of it.
	test.each([
		["a self-closing tag", "<T hero={hero} /> {s.name}"],
		["a closing tag", "<p>x</p> {s.name}"],
		["an apostrophe in element text", "<p>it's fine</p> {s.name}"],
	])("finds a read after %s", (_, body) =>
		expect(names(`export const T = () => <>${body}</>;`)).toEqual(["name"]),
	);

	test("finds a read off a binding spelled with a dollar", () => {
		const source = `import $s from "./hero-tile.module.css";\nconst a = $s.name;`;
		expect(reads(at, source)).toEqual([[module, "name"]]);
	});

	// What the scan erases is `scripts/scan.test.ts`'s; this is only that a
	// binding named in something erased is not a read.
	test("ignores a name in a comment", () =>
		expect(names("// s.name")).toEqual([]));

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

	// The other direction. A module's own descendant selectors are not reads —
	// `.chip input` and `.snapshotError p` name one class between them — so
	// `defined` yielding a name is not evidence anything reads it. Keyed by
	// `<module> <name>`, the shape `scripts/no-suppressions.ts` keys its own
	// pairs by: two modules may each define a class of the same name.
	const wasRead = new Set(
		readers.flatMap(([, names]) => names.map((pair) => pair.join(" "))),
	);

	test.each([...classes])(
		"%s defines only names a file reads",
		(module, names) => {
			for (const name of names) expect(wasRead).toContain(`${module} ${name}`);
		},
	);
});
