// watch.mjs — rebuilds dist/app.js whenever a file in src/ changes.
// Unminified, so what you debug in devtools matches what you wrote.

import { watch } from "node:fs";
import { spawn } from "node:child_process";

let building = false;
let queued = false;

function rebuild() {
  if (building) { queued = true; return; }
  building = true;
  const child = spawn(process.execPath, ["build.mjs", "--dev"], { stdio: "inherit" });
  child.on("exit", () => {
    building = false;
    if (queued) { queued = false; rebuild(); }
  });
}

rebuild();

let timer = null;
watch("src", { recursive: true }, (_event, filename) => {
  if (!filename || !filename.endsWith(".jsx")) return;
  clearTimeout(timer);            // editors fire several events per save
  timer = setTimeout(rebuild, 80);
});

console.log("watching src/ — Ctrl+C to stop");
