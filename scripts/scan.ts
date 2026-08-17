/**
 * One left-to-right scan of a source file, offered in the two views its callers
 * need: `blank`, which erases everything the language does not evaluate, and
 * `comments`, which hands back what it erased where the erasure was a comment.
 *
 * Its own module, and one walk parameterised by what it collects rather than
 * two kept in step by review: deciding what a character means without knowing
 * what it sits inside is a single mistake, and every caller reading source here
 * routes through the one place that cannot make it.
 */

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
 * What each language encloses text in, and therefore what this scan erases.
 * Stated here rather than left to a default, because the two mistakes worth
 * making are both silent: CSS has no `//` comment, so reading one would blank
 * a rule from `url(//cdn/x.png)` to the end of the line, and it has no regex
 * literal, so a `/` inside a path would erase to the next one.
 */
const SYNTAX = {
	css: { lineComments: false, regex: false, templates: false },
	ts: { lineComments: true, regex: true, templates: true },
} as const;

/** A comment as the walk met it: text without its delimiters, and where. */
type Found = { text: string; start: number; block: boolean };

/**
 * The scan itself: `source` with its comments, strings and — where the language
 * has them — template text and regex literals replaced by spaces, plus every
 * comment it passed through. Lengths and newlines are preserved, so a token
 * found in the blanked form can be read back out of the original at the same
 * place.
 *
 * A template literal is two things at once, so its text is blanked and its
 * `${…}` is not: the expression is code, and a read inside one is a read — and
 * a comment inside one is a comment, which is why the interpolation is walked
 * rather than skipped.
 *
 * Not a parser: the only question asked of each character is what encloses it.
 */
function walk(source: string, language: keyof typeof SYNTAX) {
	const { lineComments, regex, templates } = SYNTAX[language];
	// Indexed by UTF-16 unit, as `source[i]` is, so an astral character does not
	// shift every offset after it.
	const out = source.split("");
	const found: Found[] = [];
	const erase = (from: number, to: number) => {
		for (let k = from; k < to && k < out.length; k++) {
			if (out[k] !== "\n") out[k] = " ";
		}
	};

	// One entry per template literal currently open, holding the `{` nesting
	// inside its interpolation, or `null` while its text rather than an
	// expression is being read. An empty stack is ordinary code.
	const open: (number | null)[] = [];
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
		const inText = open.length > 0 && open.at(-1) === null;

		if (inText) {
			if (c === "\\") {
				i += 2;
			} else if (c === "`") {
				erase(span, i);
				open.pop();
				i++;
				previous = "`";
			} else if (c === "$" && next === "{") {
				erase(span, i);
				open[open.length - 1] = 0;
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
			erase(start, i);
			previous = c;
		} else if (c === "`" && templates) {
			open.push(null);
			span = i + 1;
			i++;
		} else if (c === "}" && open.length > 0 && open.at(-1) === 0) {
			// The brace that closes the interpolation, so its template's text
			// resumes here.
			open[open.length - 1] = null;
			span = i + 1;
			i++;
		} else if (c === "{" && open.length > 0 && open.at(-1) !== null) {
			open[open.length - 1] = (open.at(-1) as number) + 1;
			previous = c;
			i++;
		} else if (c === "}" && open.length > 0 && open.at(-1) !== null) {
			open[open.length - 1] = (open.at(-1) as number) - 1;
			previous = c;
			i++;
		} else if (lineComments && c === "/" && next === "/") {
			const start = i;
			while (i < source.length && source[i] !== "\n") i++;
			// Read out of `source` rather than `out`, which `erase` is about to
			// blank: the text is what the caller came for.
			found.push({ text: source.slice(start + 2, i), start, block: false });
			erase(start, i);
		} else if (c === "/" && next === "*") {
			const start = i;
			i += 2;
			while (i < source.length && !(source[i] === "*" && source[i + 1] === "/"))
				i++;
			// `i` stands on the `*` of the closing pair, or past the end when the
			// comment never closed — either way the text stops short of `*/`.
			found.push({ text: source.slice(start + 2, i), start, block: true });
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
			const token = word(i);
			previous = token;
			i += token.length;
		} else {
			if (c.trim() !== "") previous = c;
			i++;
		}
	}

	return { blanked: out.join(""), found };
}

/**
 * `source` with everything the language does not evaluate replaced by spaces,
 * so what is left at a given offset is code and nothing else.
 */
export function blank(source: string, language: keyof typeof SYNTAX): string {
	return walk(source, language).blanked;
}

/** A comment, its text without its delimiters, and the line it opens on. */
type Comment = { text: string; line: number; block: boolean };

/**
 * Every comment in `source`, in the order the scan met them.
 *
 * `line` is counted from the offsets the walk recorded rather than tracked
 * inside it, so the arithmetic cannot drift out of step with a branch that
 * jumps the cursor — an escaped newline inside a template, say. The walk
 * reports comments in ascending order, so one cursor over the source counts
 * every break once.
 */
export function comments(
	source: string,
	language: keyof typeof SYNTAX,
): Comment[] {
	let line = 1;
	let at = 0;
	return walk(source, language).found.map(({ text, start, block }) => {
		for (; at < start; at++) if (source[at] === "\n") line++;
		return { text, line, block };
	});
}
