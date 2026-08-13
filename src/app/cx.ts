/**
 * Joins the class names a CSS module hands back. A name the stylesheet does
 * not carry drops out of the attribute instead of reaching the DOM as the
 * string "undefined" — the mapping is built by the bundler, so its keys are
 * unknown to the type checker and a stale name is only ever a missing rule.
 */
export const cx = (...names: (string | undefined)[]) =>
	names.filter(Boolean).join(" ");
