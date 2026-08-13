// Bun's bundler loads stylesheets; TypeScript has to be told they resolve.
// A `.module.css` default export is the bundler's class-name mapping, whose
// keys exist only after it runs — so the type is the shape, not the names.
declare module "*.css" {
	const classes: Record<string, string>;
	export default classes;
}
