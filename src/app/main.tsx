import { render } from "preact";
import { App } from "./app.tsx";

const root = document.getElementById("app");
if (!root) throw new Error("mount point #app is missing from index.html");

render(<App />, root);
