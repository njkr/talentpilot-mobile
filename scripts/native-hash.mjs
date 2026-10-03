#!/usr/bin/env node
// Prints a sha256 over everything that can only change via a NEW APK:
//   - the tracked files of android/ (manifest, gradle, icons, java ...)
//   - capacitor.config.ts
//   - the resolved versions of native plugins (@capacitor/*, @capgo/*, capacitor-*) from bun.lock
// If this differs from the hash stored in manifest.json the workflow publishes a new APK;
// otherwise it publishes only a web bundle. Run from the repo root.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const h = createHash("sha256");
const add = (label, data) => h.update(`\n#${label}\n`).update(data);

const files = execFileSync("git", ["ls-files", "android"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .sort();
for (const f of files) add(f, readFileSync(f).toString("utf8").replace(/\r\n/g, "\n"));

add("capacitor.config.ts", readFileSync("capacitor.config.ts", "utf8").replace(/\r\n/g, "\n"));

const lock = readFileSync("bun.lock", "utf8").split(/\r?\n/);
const plugins = lock
  .map((l) => l.match(/^\s+"((?:@capacitor\/|@capgo\/|capacitor-)[^"]+)":\s*\["([^"]+)"/))
  .filter(Boolean)
  .map((m) => m[2]) // "@capacitor/app@8.1.1"
  .sort();
add("plugins", plugins.join("\n"));

process.stdout.write(h.digest("hex"));
