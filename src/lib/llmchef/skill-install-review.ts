import type { Skill, SkillPackageFile } from "@/types/llmchef/skill";

export type SkillInstallFindingSeverity = "info" | "warning" | "danger";

export interface SkillInstallFinding {
  severity: SkillInstallFindingSeverity;
  title: string;
  detail: string;
}

export interface SkillInstallReview {
  riskLabel: string;
  requiresConfirmation: boolean;
  findings: SkillInstallFinding[];
}

const EXECUTABLE_PATH_PATTERNS = [
  /^tools\//i,
  /^mods\//i,
  /^scripts\//i,
  /\.(mjs|cjs|js|ts|tsx|py|sh|bash|zsh|ps1)$/i,
];

const SENSITIVE_CONTENT_PATTERNS: Array<[RegExp, string]> = [
  [/\b(eval|Function)\s*\(/, "dynamic code execution"],
  [/\bfetch\s*\(|XMLHttpRequest\b|WebSocket\b/, "network access"],
  [/\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/, "browser storage access"],
  [/\bdocument\.cookie\b|\bnavigator\.clipboard\b/, "browser secret surface access"],
  [/\bapi[_-]?key\b|\btoken\b|\bcredential\b/i, "credential-related text"],
];

export const reviewSkillForInstall = (skill: Skill): SkillInstallReview => {
  const findings: SkillInstallFinding[] = [];
  const permissions = skill.manifest.permissions ?? [];

  if (skill.riskLevel === "high") {
    findings.push({
      severity: "danger",
      title: "High-risk permission request",
      detail: "This skill asks for permissions that can affect secrets, real files, network access, mods, or unsafe code.",
    });
  } else if (skill.riskLevel === "medium") {
    findings.push({
      severity: "warning",
      title: "Privileged workflow permission",
      detail: "This skill asks for access to tools, workflows, MCP, Git, or VFS writes.",
    });
  }

  for (const permission of permissions) {
    findings.push({
      severity: permission.required ? "warning" : "info",
      title: permission.required
        ? `Requires ${permission.id}`
        : `Optionally uses ${permission.id}`,
      detail: permission.reason,
    });
  }

  const executableFiles = skill.files.filter(isExecutableSkillFile);
  if (executableFiles.length > 0) {
    findings.push({
      severity: skill.riskLevel === "high" ? "danger" : "warning",
      title: "Executable assets included",
      detail: summarizePaths(executableFiles),
    });
  }

  const sensitiveMatches = collectSensitiveContentMatches(skill.files);
  if (sensitiveMatches.length > 0) {
    findings.push({
      severity: "warning",
      title: "Sensitive behavior mentioned in files",
      detail: sensitiveMatches.join(", "),
    });
  }

  if (findings.length === 0) {
    findings.push({
      severity: "info",
      title: "No elevated install concerns found",
      detail: "This skill does not request permissions or include obvious executable assets.",
    });
  }

  return {
    riskLabel: skill.riskLevel,
    requiresConfirmation:
      skill.riskLevel !== "low" || permissions.length > 0 || executableFiles.length > 0,
    findings,
  };
};

const isExecutableSkillFile = (file: SkillPackageFile): boolean =>
  EXECUTABLE_PATH_PATTERNS.some((pattern) => pattern.test(file.path));

const collectSensitiveContentMatches = (files: SkillPackageFile[]): string[] => {
  const matches = new Set<string>();
  for (const file of files) {
    for (const [pattern, label] of SENSITIVE_CONTENT_PATTERNS) {
      if (pattern.test(file.content)) {
        matches.add(label);
      }
    }
  }
  return [...matches].sort();
};

const summarizePaths = (files: SkillPackageFile[]): string => {
  const paths = files.map((file) => file.path).sort();
  const visible = paths.slice(0, 4).join(", ");
  const remaining = paths.length - 4;
  return remaining > 0 ? `${visible}, and ${remaining} more` : visible;
};
