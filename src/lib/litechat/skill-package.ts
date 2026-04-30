import type {
  Skill,
  SkillManifest,
  SkillPackageFile,
  SkillPermission,
  SkillRiskLevel,
  SkillSource,
} from "@/types/litechat/skill";

const MANIFEST_PATH = "skill.json";

const HIGH_RISK_PERMISSIONS = new Set([
  "mods",
  "network",
  "api-keys",
  "git-credentials",
  "unsafe-code",
  "real-fs-write",
]);

const MEDIUM_RISK_PERMISSIONS = new Set([
  "vfs-write",
  "git",
  "mcp",
  "tools",
  "workflows",
]);

export const normalizeSkillSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export const validateSkillManifest = (manifest: unknown): SkillManifest => {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Skill manifest must be an object.");
  }

  const candidate = manifest as Partial<SkillManifest>;
  const slug = normalizeSkillSlug(String(candidate.slug ?? ""));
  if (!slug) throw new Error("Skill manifest requires a valid slug.");
  if (!candidate.name?.trim()) throw new Error("Skill manifest requires a name.");
  if (!candidate.description?.trim()) {
    throw new Error("Skill manifest requires a description.");
  }
  if (!candidate.version?.trim()) {
    throw new Error("Skill manifest requires a version.");
  }

  return {
    schemaVersion: 1,
    slug,
    name: candidate.name.trim(),
    description: candidate.description.trim(),
    version: candidate.version.trim(),
    author: candidate.author?.trim() || undefined,
    tags: normalizeStringList(candidate.tags),
    permissions: normalizePermissions(candidate.permissions),
    assets: Array.isArray(candidate.assets) ? candidate.assets : [],
    entryPrompt: candidate.entryPrompt?.trim() || undefined,
  };
};

export const parseSkillPackage = (
  files: SkillPackageFile[],
  source: SkillSource
): Omit<Skill, "id" | "createdAt" | "updatedAt"> => {
  const manifestFile = files.find((file) => file.path === MANIFEST_PATH);
  if (!manifestFile) {
    throw new Error(`Skill package requires ${MANIFEST_PATH}.`);
  }

  const manifest = validateSkillManifest(JSON.parse(manifestFile.content));
  return {
    slug: manifest.slug,
    name: manifest.name,
    description: manifest.description,
    version: manifest.version,
    author: manifest.author,
    tags: manifest.tags ?? [],
    source,
    manifest,
    files: sortSkillFiles(files),
    installState: "available",
    riskLevel: estimateSkillRisk(manifest),
    installedAt: null,
  };
};

export const serializeSkillPackage = (skill: Skill): SkillPackageFile[] =>
  sortSkillFiles([
    {
      path: MANIFEST_PATH,
      content: `${JSON.stringify(skill.manifest, null, 2)}\n`,
    },
    ...skill.files.filter((file) => file.path !== MANIFEST_PATH),
  ]);

export const estimateSkillRisk = (manifest: SkillManifest): SkillRiskLevel => {
  const permissionIds = new Set(
    (manifest.permissions ?? []).map((permission) => permission.id)
  );

  if ([...permissionIds].some((id) => HIGH_RISK_PERMISSIONS.has(id))) {
    return "high";
  }

  if ([...permissionIds].some((id) => MEDIUM_RISK_PERMISSIONS.has(id))) {
    return "medium";
  }

  return "low";
};

const normalizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizePermissions = (value: unknown): SkillPermission[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Partial<SkillPermission> => {
      return !!item && typeof item === "object";
    })
    .map((item) => ({
      id: String(item.id ?? "").trim(),
      reason: String(item.reason ?? "").trim(),
      required: item.required !== false,
    }))
    .filter((permission) => permission.id && permission.reason);
};

const sortSkillFiles = (files: SkillPackageFile[]): SkillPackageFile[] =>
  [...files].sort((a, b) => a.path.localeCompare(b.path));
