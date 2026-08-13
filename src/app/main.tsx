import { render } from "preact";
import { App } from "./app.tsx";
// The stylesheet index.html used to link. Delivering it through the bundle is
// what lets component rules travel with the components that import them.
import "./styles/styles.css";

const root = document.getElementById("app");
if (!root) throw new Error("mount point #app is missing from index.html");

render(<App />, root);
