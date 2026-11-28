import { render } from "preact";
// The All Pick page's tokens and base rules, shared rather than copied.
import "../app/styles/styles.css";
import { CmApp } from "./ui/cm-app.tsx";

const root = document.getElementById("app");
if (!root) throw new Error("mount point #app is missing from cm.html");

render(<CmApp />, root);
