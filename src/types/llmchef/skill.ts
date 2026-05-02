export type SkillInstallState = "draft" | "available" | "installed" | "disabled";

export type SkillRiskLevel = "low" | "medium" | "high";

export type SkillSourceType = "local" | "vfs" | "git" | "marketplace";

export interface SkillSource {
  type: SkillSourceType;
  uri?: string;
  repoUrl?: string;
  commit?: string;
  path?: string;
}

export interface SkillPermission {
  id: string;
  reason: string;
  required: boolean;
}

export interface SkillAssetRef {
  kind: "prompt" | "agent" | "task" | "workflow" | "rule" | "tool" | "example" | "file";
  path: string;
}

export interface SkillManifest {
  schemaVersion: 1;
  slug: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  tags?: string[];
  permissions?: SkillPermission[];
  assets?: SkillAssetRef[];
  entryPrompt?: string;
}

export interface SkillPackageFile {
  path: string;
  content: string;
}

export interface Skill {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  tags: string[];
  source: SkillSource;
  manifest: SkillManifest;
  files: SkillPackageFile[];
  installState: SkillInstallState;
  riskLevel: SkillRiskLevel;
  createdAt: Date;
  updatedAt: Date;
  installedAt?: Date | null;
}

export interface DbSkill extends Omit<Skill, "createdAt" | "updatedAt" | "installedAt"> {
  createdAt: string | Date;
  updatedAt: string | Date;
  installedAt?: string | Date | null;
}
