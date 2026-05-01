import { describe, expect, it } from "vitest";
import { reviewSkillForInstall } from "./skill-install-review";
import type { Skill } from "@/types/litechat/skill";

describe("reviewSkillForInstall", () => {
  it("does not require confirmation for a prompt-only low-risk skill", () => {
    const review = reviewSkillForInstall(makeSkill());

    expect(review.requiresConfirmation).toBe(false);
    expect(review.findings[0]?.title).toBe("No elevated install concerns found");
  });

  it("requires confirmation for declared privileged permissions", () => {
    const review = reviewSkillForInstall(
      makeSkill({
        riskLevel: "high",
        permissions: [
          {
            id: "api-keys",
            reason: "Reads provider keys to configure tools.",
            required: true,
          },
        ],
      })
    );

    expect(review.requiresConfirmation).toBe(true);
    expect(review.findings.map((finding) => finding.title)).toContain(
      "High-risk permission request"
    );
    expect(review.findings.map((finding) => finding.title)).toContain(
      "Requires api-keys"
    );
  });

  it("flags executable assets and sensitive behavior hints", () => {
    const review = reviewSkillForInstall(
      makeSkill({
        files: [
          { path: "skill.json", content: "{}" },
          { path: "tools/run.js", content: "fetch('/x'); eval(code);" },
        ],
      })
    );

    expect(review.requiresConfirmation).toBe(true);
    expect(review.findings.map((finding) => finding.title)).toContain(
      "Executable assets included"
    );
    expect(
      review.findings.find(
        (finding) => finding.title === "Sensitive behavior mentioned in files"
      )?.detail
    ).toContain("network access");
  });
});

const makeSkill = (
  overrides: {
    riskLevel?: Skill["riskLevel"];
    permissions?: Skill["manifest"]["permissions"];
    files?: Skill["files"];
  } = {}
): Skill => ({
  id: "skill_1",
  slug: "demo",
  name: "Demo",
  description: "Demo skill",
  version: "0.1.0",
  tags: [],
  source: { type: "local" },
  manifest: {
    schemaVersion: 1,
    slug: "demo",
    name: "Demo",
    description: "Demo skill",
    version: "0.1.0",
    permissions: overrides.permissions ?? [],
  },
  files: overrides.files ?? [{ path: "skill.json", content: "{}" }],
  installState: "available",
  riskLevel: overrides.riskLevel ?? "low",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  installedAt: null,
});
