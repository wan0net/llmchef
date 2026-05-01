import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.env.VITE_PYODIDE_VERSION || "0.27.7";
const source = join(root, "node_modules", "pyodide");
const target = join(root, "public", "pyodide", `v${version}`, "full");

if (!existsSync(source)) {
  console.error(`Pyodide package not found at ${source}.`);
  console.error(`Install it first with: npm install --save-dev pyodide@${version}`);
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });

console.log(`Vendored Pyodide ${version} to ${target}`);
