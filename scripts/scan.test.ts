import { describe, expect, test } from "bun:test";
import { blank, comments } from "./scan.ts";

/** `MARK` stands in for whatever a caller is looking for: it survives the scan
 * when it sits in code, and goes when it sits in something the language quotes
 * or comments out. */
const kept = (source: string, language: "css" | "ts") =>
	blank(source, language).includes("MARK");

describe("scanning TypeScript", () => {
	test.each([
		["a string", "const a = 'MARK';"],
		["a line comment", "// MARK"],
		["a block comment", "/* MARK */"],
		["template text", "const a = `text MARK`;"],
		["a regex literal", "const a = /MARK/;"],
		["a regex after return", "function f() { return /MARK/; }"],
		["a regex after an arrow", "const f = () => /MARK/;"],
		["a regex after typeof", "const a = typeof /MARK/;"],
	])("erases %s", (_, source) => expect(kept(source, "ts")).toBe(false));

	test.each([
		["plain code", "const MARK = 1;"],
		["a template expression", `const a = \`\${MARK}\`;`],
		["a nested template expression", `const a = \`\${\`\${MARK}\`}\`;`],
		["code after an interpolation closes", `const a = \`\${1}\` + MARK;`],
		["code after a division, which is not a regex", "const a = 1 / 2; MARK;"],
		// A quote that opened no string — one inside a regex literal, say — would
		// otherwise swallow the rest of the file and take the scan silent with it.
		["code after a quote left open on its line", "const a = 'x\nMARK;"],
		["code after a comment that names a quote", "// it's fine\nMARK;"],
	])("keeps %s", (_, source) => expect(kept(source, "ts")).toBe(true));

	test("preserves offsets, so a match reads back out of the source", () => {
		const source = 'const a = "hidden"; const b = 1;';

		expect(blank(source, "ts")).toHaveLength(source.length);
		expect(blank(source, "ts").indexOf("const b")).toBe(
			source.indexOf("const b"),
		);
	});
});

/**
 * What the walk collects, as against what survives it. These are the shapes
 * `blank`'s cases cannot reach: which comment a scan met, on which line, and of
 * which kind — all three erased alike in the blanked form.
 */
describe("the comments a scan met", () => {
	test("a block comment reports the line it opens on", () => {
		expect(comments("const a = 1;\n/* one\ntwo */\n", "ts")).toEqual([
			{ text: " one\ntwo ", line: 2, block: true },
		]);
	});

	test("a `//` inside a block comment opens no line comment", () => {
		expect(comments("/*\n// inner\n*/\n", "ts")).toEqual([
			{ text: "\n// inner\n", line: 1, block: true },
		]);
	});

	test("a `/*` inside a line comment opens no block", () => {
		// If it did, every comment below would be swallowed and the scan would go
		// quiet for the rest of the file.
		expect(comments("// see /* the note\n// after\n", "ts")).toEqual([
			{ text: " see /* the note", line: 1, block: false },
			{ text: " after", line: 2, block: false },
		]);
	});

	test("a comment inside a template interpolation is one", () => {
		// The interpolation is code, so what is commented out inside it is a
		// comment — which is why the walk enters it rather than skipping it.
		expect(comments(`const a = \`\${/* here */ 1}\`;\n`, "ts")).toEqual([
			{ text: " here ", line: 1, block: true },
		]);
	});

	test("a comment marker in template text is text", () => {
		expect(comments("const a = `// not one`;\n", "ts")).toEqual([]);
	});

	test("a comment marker inside a string is not one", () => {
		expect(comments('const s = "// not one";\n', "ts")).toEqual([]);
	});

	test("an escaped quote does not end its string early", () => {
		expect(comments('const s = "he said \\"/*\\"";\n// after\n', "ts")).toEqual(
			[{ text: " after", line: 2, block: false }],
		);
	});

	test("a plain comment opener in a string opens no block either", () => {
		// The control for the case above: without the escape both scanners agree.
		expect(comments('const opener = "/*";\n// after\n', "ts")).toEqual([
			{ text: " after", line: 2, block: false },
		]);
	});

	test("a quote inside a regex literal opens no string", () => {
		// It closes nowhere. Were it a string opener the scan would run to the end
		// of the file and report nothing, the one failure it must never have.
		expect(comments("const re = /['\"]/;\n// after\n", "ts")).toEqual([
			{ text: " after", line: 2, block: false },
		]);
	});

	test("a `/*` inside a regex literal opens no block", () => {
		expect(comments("const re = /[/*]/;\n// after\n", "ts")).toEqual([
			{ text: " after", line: 2, block: false },
		]);
	});

	test("an escaped backtick does not close its template", () => {
		expect(comments("const a = `x\\`y`;\n// after\n", "ts")).toEqual([
			{ text: " after", line: 2, block: false },
		]);
	});

	test("an escaped newline inside a template still ends a line", () => {
		expect(comments("const s = `a\\\nb`;\n// after\n", "ts")).toEqual([
			{ text: " after", line: 3, block: false },
		]);
	});

	test("an unterminated template swallows what follows", () => {
		// Deliberate, and the same choice `blank` makes: the source is a syntax
		// error, and guessing where the author meant it to close would report a
		// comment on evidence the scan does not have.
		expect(comments("const a = `x\n// not one\n", "ts")).toEqual([]);
	});

	test("an unterminated block comment runs to the end of input", () => {
		// The same choice as the template above, and the one both callers rest
		// on: `spec-coverage.ts` derives the lines a block encloses from this
		// text, so a block that never closes encloses every line below it.
		expect(comments("const a = 1;\n/* never closed\nand on\n", "ts")).toEqual([
			{ text: " never closed\nand on\n", line: 2, block: true },
		]);
	});

	test("a CRLF pair ends one line", () => {
		// The `\r` stays in the text: a line comment runs to the newline, and both
		// callers' grammars treat it as the whitespace it is.
		expect(comments("const a = 1;\r\n// after\r\n", "ts")).toEqual([
			{ text: " after\r", line: 2, block: false },
		]);
	});

	test("CSS has no line comment, so a `//` in a url is not one", () => {
		expect(comments(".a { background: url(//cdn/x.png); }\n", "css")).toEqual(
			[],
		);
	});

	test("CSS still has block comments", () => {
		expect(comments("/* note */\n.a {}\n", "css")).toEqual([
			{ text: " note ", line: 1, block: true },
		]);
	});

	test("every comment reported is one the same source blanked", () => {
		// The two views are one walk parameterised by what it collects, and this
		// is what says so: collecting in one branch while erasing in another
		// would pass every case above and still hand a caller a comment the
		// other caller reads as code.
		const source = [
			'const s = "// not one";',
			"// a line comment",
			"const re = /[`]/; /* trailing block */",
			`const t = \`text \${/* inside */ 1}\`;`,
			"/* one that",
			"   spans lines */",
		].join("\n");
		const erased = blank(source, "ts");
		const found = comments(source, "ts");

		// Named first, so the loop below cannot pass by finding nothing.
		expect(found.map((c) => c.text)).toEqual([
			" a line comment",
			" trailing block ",
			" inside ",
			" one that\n   spans lines ",
		]);
		for (const { text } of found) expect(erased).not.toContain(text);
	});
});

describe("scanning CSS", () => {
	test.each([
		["a comment", "/* MARK */ .a {}"],
		["a string", '.a { content: "MARK"; }'],
	])("erases %s", (_, source) => expect(kept(source, "css")).toBe(false));

	// CSS has neither, and reading one would erase a rule that is really there.
	test.each([
		["a line comment", ".a { background: url(//cdn/MARK.png); }"],
		["a regex literal", ".a { margin: /MARK/; }"],
	])("keeps what TypeScript would take for %s", (_, source) =>
		expect(kept(source, "css")).toBe(true),
	);
});
