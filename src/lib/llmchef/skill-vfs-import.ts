import type { fs as FsType } from "@zenfs/core";
import type { SkillPackageFile } from "@/types/llmchef/skill";
import { joinPath, normalizePath } from "./file-manager-utils";
import { listFilesOp, readFileOp } from "./vfs-operations";

export interface VfsSkillPackage {
  rootPath: string;
  files: SkillPackageFile[];
}

const SKILL_MANIFEST = "skill.json";
const REPO_SKILLS_PATH = ".llmchef/skills";

export const findSkillPackagesInVfs = async (
  rootPath: string,
  options: { fsInstance: typeof FsType }
): Promise<VfsSkillPackage[]> => {
  const normalizedRoot = normalizePath(rootPath || "/");
  const candidates = await findCandidateRoots(normalizedRoot, options);
  const packages: VfsSkillPackage[] = [];

  for (const candidate of candidates) {
    packages.push({
      rootPath: candidate,
      files: await readSkillPackageFiles(candidate, options),
    });
  }

  return packages;
};

const findCandidateRoots = async (
  rootPath: string,
  options: { fsInstance: typeof FsType }
): Promise<string[]> => {
  if (await hasManifest(rootPath, options)) return [rootPath];

  const repoSkillRoot = joinPath(rootPath, REPO_SKILLS_PATH);
  const repoSkillPackages = await childDirectoriesWithManifest(
    repoSkillRoot,
    options
  );
  if (repoSkillPackages.length > 0) return repoSkillPackages;

  return childDirectoriesWithManifest(rootPath, options);
};

const childDirectoriesWithManifest = async (
  path: string,
  options: { fsInstance: typeof FsType }
): Promise<string[]> => {
  const entries = await safeListFiles(path, options);
  const candidates: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory) continue;
    if (await hasManifest(entry.path, options)) {
      candidates.push(entry.path);
    }
  }

  return candidates.sort((a, b) => a.localeCompare(b));
};

const readSkillPackageFiles = async (
  rootPath: string,
  options: { fsInstance: typeof FsType }
): Promise<SkillPackageFile[]> => {
  const files: SkillPackageFile[] = [];

  const walk = async (currentPath: string, relativePrefix = "") => {
    const entries = await safeListFiles(currentPath, options);
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const relativePath = relativePrefix
        ? `${relativePrefix}/${entry.name}`
        : entry.name;

      if (entry.isDirectory) {
        await walk(entry.path, relativePath);
        continue;
      }

      const data = await readFileOp(entry.path, {
        fsInstance: options.fsInstance,
        silent: true,
      });
      files.push({
        path: relativePath,
        content: new TextDecoder().decode(data),
      });
    }
  };

  await walk(rootPath);
  return files;
};

const hasManifest = async (
  rootPath: string,
  options: { fsInstance: typeof FsType }
): Promise<boolean> => {
  try {
    await readFileOp(joinPath(rootPath, SKILL_MANIFEST), {
      fsInstance: options.fsInstance,
      silent: true,
    });
    return true;
  } catch {
    return false;
  }
};

const safeListFiles = async (
  path: string,
  options: { fsInstance: typeof FsType }
) => {
  try {
    return await listFilesOp(path, { fsInstance: options.fsInstance });
  } catch {
    return [];
  }
};
