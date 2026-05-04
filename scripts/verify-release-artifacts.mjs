import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const pkg = await import(path.join(projectRoot, "package.json"), {
  with: { type: "json" },
});

const version = pkg.default.version;
if (!version || typeof version !== "string") {
  throw new Error("package.json version is missing or invalid.");
}

const pairs = [
  {
    publicPath: "public/release/latest.zip",
    distPath: "dist/release/latest.zip",
    label: "latest release bundle",
  },
  {
    publicPath: `public/release/llmchef-${version}.zip`,
    distPath: `dist/release/llmchef-${version}.zip`,
    label: `versioned release bundle ${version}`,
  },
];
const releaseDirectories = [
  { path: path.join(projectRoot, "public", "release"), label: "public/release" },
  { path: path.join(projectRoot, "dist", "release"), label: "dist/release" },
];

const requiredStandaloneFiles = ["dist/index.html"];

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

async function validateZip(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing: ${relativePath}`);
  }

  const stats = statSync(absolutePath);
  if (!stats.isFile() || stats.size === 0) {
    throw new Error(`Empty or invalid: ${relativePath}`);
  }

  const buffer = readFileSync(absolutePath);
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.keys(zip.files).filter((name) => !zip.files[name]?.dir);

  if (entries.length === 0) {
    throw new Error(`Archive has no files: ${relativePath}`);
  }

  if (!entries.includes("index.html")) {
    throw new Error(`Archive is missing index.html: ${relativePath}`);
  }

  return { buffer, entries };
}

for (const relativePath of requiredStandaloneFiles) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing: ${relativePath}`);
  }

  const stats = statSync(absolutePath);
  if (!stats.isFile() || stats.size === 0) {
    throw new Error(`Empty or invalid: ${relativePath}`);
  }
}

for (const directory of releaseDirectories) {
  const files = readdirSync(directory.path).filter((name) => name.endsWith(".zip"));
  const versioned = files.filter((name) => /^llmchef-.*\.zip$/.test(name));

  if (!files.includes("latest.zip")) {
    throw new Error(`${directory.label} is missing latest.zip`);
  }

  if (versioned.length !== 1 || versioned[0] !== `llmchef-${version}.zip`) {
    throw new Error(
      `${directory.label} must contain exactly one versioned release zip named llmchef-${version}.zip; found: ${versioned.join(", ") || "none"}`,
    );
  }
}

for (const pair of pairs) {
  const publicZip = await validateZip(pair.publicPath);
  const distZip = await validateZip(pair.distPath);

  const publicHash = sha256(publicZip.buffer);
  const distHash = sha256(distZip.buffer);

  if (publicHash !== distHash) {
    throw new Error(
      `Checksum mismatch for ${pair.label}: ${pair.publicPath} (${publicHash}) != ${pair.distPath} (${distHash})`,
    );
  }

  const publicEntries = publicZip.entries.slice().sort().join("\n");
  const distEntries = distZip.entries.slice().sort().join("\n");
  if (publicEntries !== distEntries) {
    throw new Error(`Archive entry mismatch for ${pair.label}.`);
  }
}

console.log(`Release artifact verification passed for LLMChef ${version}.`);
