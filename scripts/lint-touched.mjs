#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";

const lintable = /\.(ts|tsx)$/;
const baseRef = process.env.LLMCHEF_LINT_BASE || "origin/main";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function splitLines(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function changedFiles() {
  const files = new Set();
  try {
    const mergeBase = git(["merge-base", baseRef, "HEAD"]);
    splitLines(git(["diff", "--name-only", "--diff-filter=ACMR", mergeBase, "HEAD"]))
      .forEach((file) => files.add(file));
  } catch {
    splitLines(git(["ls-files", "--", "src/**/*.ts", "src/**/*.tsx", "scripts/**/*.ts", "scripts/**/*.tsx"]))
      .forEach((file) => files.add(file));
  }

  splitLines(git(["diff", "--name-only", "--diff-filter=ACMR"]))
    .forEach((file) => files.add(file));
  splitLines(git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]))
    .forEach((file) => files.add(file));

  return [...files].filter((file) => lintable.test(file));
}

const files = changedFiles();
if (files.length === 0) {
  console.log("No touched TypeScript files to lint. Run npm run lint:all for the full backlog.");
  process.exit(0);
}

const result = spawnSync("npx", ["eslint", ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
