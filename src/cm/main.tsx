import { render } from "preact";
// The All Pick page's tokens and base rules, shared rather than copied.
import "../app/styles/styles.css";
import { CmApp } from "./ui/cm-app.tsx";
import { type SearchScope, serveSearch } from "./worker.ts";

// The same bundle runs twice: as the page, and as its search worker, which
// the page starts from this very file (`new Worker(import.meta.url)`), so the
// worker is cached and invalidated with the page's own hashed name. A worker
// has no document, and that is how it knows which one it is.
if (typeof document === "undefined") {
	serveSearch(globalThis as unknown as SearchScope);
} else {
	const root = document.getElementById("app");
	if (!root) throw new Error("mount point #app is missing from cm.html");
	render(<CmApp />, root);
}
