// Bun's bundler loads stylesheets; TypeScript has to be told they resolve.
//
// The order is load-bearing. Both patterns match `x.module.css`, and the one
// declared first wins, so `*.css` above would give a module's class mapping the
// type of a plain stylesheet and every read off it would fail to compile.
declare module "*.module.css" {
	// The bundler builds the mapping, so its keys exist only after it runs —
	// the type is the shape, not the names.
	const classes: Record<string, string>;
	export default classes;
}

// A plain stylesheet is imported for its side effect and exports nothing.
declare module "*.css" {
	export {};
}
