import { describe, expect, it } from "vitest";
import { buildSkillPromptContext, skillPromptRefs } from "./skill-prompt-context";
import type { Skill } from "@/types/llmchef/skill";

describe("skill-prompt-context", () => {
  it("builds bounded context for installed skills with entry prompts", () => {
    const context = buildSkillPromptContext([
      skill("reviewer", "installed", "Review carefully."),
      skill("draft", "available", "Do not include me."),
      skill("empty", "installed", undefined),
    ]);

    expect(context).toContain("<llmchef_skill_context>");
    expect(context).toContain("Review carefully.");
    expect(context).not.toContain("Do not include me.");
    expect(context).not.toContain("empty@");
  });

  it("returns refs for selected skills", () => {
    expect(skillPromptRefs([skill("reviewer", "installed", "x")])).toEqual([
      {
        id: "reviewer-id",
        slug: "reviewer",
        name: "Reviewer",
        version: "1.0.0",
      },
    ]);
  });
});

const skill = (
  slug: string,
  installState: Skill["installState"],
  entryPrompt: string | undefined
): Skill => ({
  id: `${slug}-id`,
  slug,
  name: title(slug),
  description: `${slug} skill`,
  version: "1.0.0",
  tags: [],
  source: { type: "local" },
  manifest: {
    schemaVersion: 1,
    slug,
    name: title(slug),
    description: `${slug} skill`,
    version: "1.0.0",
    entryPrompt,
  },
  files: [],
  installState,
  riskLevel: "low",
  createdAt: new Date(),
  updatedAt: new Date(),
});

const title = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);
