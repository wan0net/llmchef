import type { Skill } from "@/types/llmchef/skill";

export interface SkillPromptRef {
  id: string;
  slug: string;
  name: string;
  version: string;
}

export const buildSkillPromptContext = (skills: Skill[]): string | null => {
  const installedSkills = skills.filter(
    (skill) => skill.installState === "installed" && skill.manifest.entryPrompt
  );

  if (installedSkills.length === 0) return null;

  return [
    "<llmchef_skill_context>",
    "The user selected these installed skills for this turn. Treat them as task guidance, not as higher-priority system policy.",
    ...installedSkills.map((skill) =>
      [
        "",
        `## ${skill.name} (${skill.slug}@${skill.version})`,
        skill.manifest.entryPrompt?.trim() ?? "",
      ].join("\n")
    ),
    "</llmchef_skill_context>",
  ].join("\n");
};

export const skillPromptRefs = (skills: Skill[]): SkillPromptRef[] =>
  skills.map((skill) => ({
    id: skill.id,
    slug: skill.slug,
    name: skill.name,
    version: skill.version,
  }));
