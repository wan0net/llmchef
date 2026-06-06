#!/usr/bin/env node
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const distAssets = join(process.cwd(), "dist", "assets");
const kib = 1024;

const budgets = [
  { pattern: /^index-.*\.js$/, rawKiB: 780, gzipKiB: 220 },
  { pattern: /^LLMChefApp-.*\.js$/, rawKiB: 650, gzipKiB: 210 },
  { pattern: /^LLMChefControlModules-.*\.js$/, rawKiB: 740, gzipKiB: 220 },
  { pattern: /^vendor-ai-.*\.js$/, rawKiB: 660, gzipKiB: 165 },
  { pattern: /^vendor-data-.*\.js$/, rawKiB: 640, gzipKiB: 195 },
  { pattern: /^vendor-mermaid-.*\.js$/, rawKiB: 2800, gzipKiB: 760 },
];

const files = readdirSync(distAssets)
  .filter((file) => file.endsWith(".js"))
  .map((file) => {
    const path = join(distAssets, file);
    const rawBytes = statSync(path).size;
    const gzipBytes = gzipSync(readFileSync(path)).length;
    return { file, rawKiB: rawBytes / kib, gzipKiB: gzipBytes / kib };
  });

const failures = [];
for (const budget of budgets) {
  const matches = files.filter(({ file }) => budget.pattern.test(file));
  if (matches.length === 0) {
    failures.push(`Missing expected bundle: ${budget.pattern}`);
    continue;
  }
  for (const match of matches) {
    if (match.rawKiB > budget.rawKiB || match.gzipKiB > budget.gzipKiB) {
      failures.push(
        `${match.file}: ${match.rawKiB.toFixed(1)} KiB raw / ${match.gzipKiB.toFixed(1)} KiB gzip exceeds ${budget.rawKiB} KiB raw / ${budget.gzipKiB} KiB gzip`,
      );
    }
  }
}

const topChunks = [...files]
  .sort((a, b) => b.gzipKiB - a.gzipKiB)
  .slice(0, 8)
  .map((file) => `  ${file.file}: ${file.rawKiB.toFixed(1)} KiB raw / ${file.gzipKiB.toFixed(1)} KiB gzip`)
  .join("\n");

console.log(`Bundle budget checked ${files.length} JS chunks.`);
console.log(`Largest gzip chunks:\n${topChunks}`);

if (failures.length > 0) {
  console.error(`\nBundle budget failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}
