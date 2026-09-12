#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..", "..");
const toolEntry = path.join(projectRoot, ".tools", "e2e-image-viewer", "server.mjs");

const result = spawnSync(process.execPath, [toolEntry, ...process.argv.slice(2)], {
  cwd: projectRoot,
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error(`open-e2e-image-viewer 失败: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
