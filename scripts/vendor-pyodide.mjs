import { cpSync, existsSync, mkdirSync } from "node:fs";
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
cpSync(source, target, { recursive: true });

const requiredPackageFiles = [
  "micropip-0.9.0-py3-none-any.whl",
  "packaging-24.2-py3-none-any.whl",
];

const missingPackageFiles = requiredPackageFiles.filter(
  (fileName) => !existsSync(join(target, fileName)),
);

if (missingPackageFiles.length > 0) {
  console.error("Required offline Pyodide package files are missing:");
  for (const fileName of missingPackageFiles) {
    console.error(`- ${join(target, fileName)}`);
  }
  process.exit(1);
}

console.log(`Vendored Pyodide ${version} to ${target}`);
