import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function parseSemver(input) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid semver: ${input}`);
  }

  return {
    raw: input.trim(),
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split(".") : [],
  };
}

function compareIdentifiers(a, b) {
  const aNumeric = /^\d+$/.test(a);
  const bNumeric = /^\d+$/.test(b);

  if (aNumeric && bNumeric) return Number(a) - Number(b);
  if (aNumeric) return -1;
  if (bNumeric) return 1;
  return a.localeCompare(b);
}

function compareSemver(a, b) {
  for (const key of ["major", "minor", "patch"]) {
    const diff = a[key] - b[key];
    if (diff !== 0) return diff;
  }

  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;

  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < length; i += 1) {
    const aId = a.prerelease[i];
    const bId = b.prerelease[i];
    if (aId === undefined) return -1;
    if (bId === undefined) return 1;
    const diff = compareIdentifiers(aId, bId);
    if (diff !== 0) return diff;
  }

  return 0;
}

function git(...args) {
  return execFileSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
  }).trim();
}

const packageJson = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const packageLock = JSON.parse(readFileSync(path.join(projectRoot, "package-lock.json"), "utf8"));

const packageVersion = parseSemver(packageJson.version);
const lockVersion = parseSemver(packageLock.version);
const rootLockVersion = parseSemver(packageLock.packages?.[""]?.version ?? "");

if (compareSemver(packageVersion, lockVersion) !== 0) {
  throw new Error(`package-lock.json version ${packageLock.version} does not match package.json ${packageJson.version}`);
}

if (compareSemver(packageVersion, rootLockVersion) !== 0) {
  throw new Error(`package-lock root package version ${packageLock.packages?.[""]?.version} does not match package.json ${packageJson.version}`);
}

const tagLines = git("tag", "--list").split("\n").map((line) => line.trim()).filter(Boolean);
const semverTags = tagLines.filter((tag) => /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag));
const parsedTags = semverTags.map((tag) => parseSemver(tag)).sort(compareSemver);
const latestTag = parsedTags.at(-1) ?? null;

const headTagLines = git("tag", "--points-at", "HEAD").split("\n").map((line) => line.trim()).filter(Boolean);
const headSemverTags = headTagLines.filter((tag) => /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag));

if (headSemverTags.length > 1) {
  throw new Error(`HEAD has multiple semver tags: ${headSemverTags.join(", ")}`);
}

if (headSemverTags.length === 1) {
  const headTagVersion = parseSemver(headSemverTags[0]);
  if (compareSemver(packageVersion, headTagVersion) !== 0) {
    throw new Error(`HEAD tag ${headSemverTags[0]} does not match package.json version ${packageJson.version}`);
  }
} else if (latestTag && compareSemver(packageVersion, latestTag) <= 0) {
  throw new Error(`package.json version ${packageJson.version} must be greater than latest semver tag ${latestTag.raw} when HEAD is untagged`);
}

const releaseArtifact = `llmchef-${packageJson.version}.zip`;
console.log(`Version consistency check passed.`);
console.log(`package.json version: ${packageJson.version}`);
console.log(`latest semver tag: ${latestTag?.raw ?? "none"}`);
console.log(`head semver tag: ${headSemverTags[0] ?? "none"}`);
console.log(`expected versioned artifact: ${releaseArtifact}`);
