#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const configPath = path.join(__dirname, "architecture-fitness.config.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
      continue;
    }
    results.push(fullPath);
  }
  return results;
}

function countLines(filePath) {
  const content = readFileSync(filePath, "utf8");
  if (content.length === 0) return 0;
  return content.split("\n").length;
}

const scanRoot = path.join(projectRoot, config.root);
const extensions = new Set(config.extensions);
const allowlist = new Map(Object.entries(config.allowlist ?? {}));

const files = walk(scanRoot)
  .filter((filePath) => extensions.has(path.extname(filePath)))
  .map((filePath) => {
    const relativePath = path.relative(projectRoot, filePath).replaceAll(path.sep, "/");
    const lines = countLines(filePath);
    const maxLines = allowlist.get(relativePath) ?? config.defaultMaxLines;
    return {
      relativePath,
      lines,
      maxLines,
      allowedOverride: allowlist.has(relativePath),
    };
  })
  .sort((a, b) => b.lines - a.lines || a.relativePath.localeCompare(b.relativePath));

const failures = [];
for (const file of files) {
  if (file.lines > file.maxLines) {
    const rule = file.allowedOverride ? `allowlist cap ${file.maxLines}` : `default cap ${file.maxLines}`;
    failures.push(`${file.relativePath}: ${file.lines} lines exceeds ${rule}`);
  }
}

const missingAllowlistEntries = [];
for (const relativePath of allowlist.keys()) {
  const fullPath = path.join(projectRoot, relativePath);
  try {
    const stats = statSync(fullPath);
    if (!stats.isFile()) {
      missingAllowlistEntries.push(`${relativePath}: allowlist entry does not point to a file`);
    }
  } catch {
    missingAllowlistEntries.push(`${relativePath}: allowlist entry is stale`);
  }
}

const topFiles = files
  .slice(0, config.reportTopN ?? 10)
  .map((file) => {
    const marker = file.allowedOverride ? "allowlisted" : "default";
    return `  ${file.relativePath}: ${file.lines} lines (cap ${file.maxLines}, ${marker})`;
  })
  .join("\n");

console.log(`Architecture fitness checked ${files.length} source modules under ${config.root}.`);
console.log(`Default file cap: ${config.defaultMaxLines} lines.`);
console.log(`Largest modules:\n${topFiles}`);

if (missingAllowlistEntries.length > 0) {
  failures.push(...missingAllowlistEntries);
}

if (failures.length > 0) {
  console.error(`\nArchitecture fitness failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}
