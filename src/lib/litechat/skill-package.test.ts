import { describe, expect, it } from "vitest";
import {
  estimateSkillRisk,
  normalizeSkillSlug,
  parseSkillPackage,
  serializeSkillPackage,
  validateSkillManifest,
} from "./skill-package";
import type { Skill } from "@/types/litechat/skill";

describe("skill-package", () => {
  it("normalizes skill slugs", () => {
    expect(normalizeSkillSlug("  My Great Skill! ")).toBe("my-great-skill");
  });

  it("validates and normalizes manifests", () => {
    const manifest = validateSkillManifest({
      schemaVersion: 1,
      slug: "My Skill",
      name: "My Skill",
      description: "Does a useful thing.",
      version: "1.0.0",
      tags: [" agent ", "", 42],
    });

    expect(manifest.slug).toBe("my-skill");
    expect(manifest.tags).toEqual(["agent"]);
  });

  it("parses skill packages and estimates risk from permissions", () => {
    const skill = parseSkillPackage(
      [
        {
          path: "README.md",
          content: "# My Skill\n",
        },
        {
          path: "skill.json",
          content: JSON.stringify({
            schemaVersion: 1,
            slug: "repo-helper",
            name: "Repo Helper",
            description: "Works with repositories.",
            version: "1.0.0",
            permissions: [
              {
                id: "git",
                reason: "Reads repository metadata.",
                required: true,
              },
            ],
          }),
        },
      ],
      { type: "vfs", path: "/skills/repo-helper" }
    );

    expect(skill.slug).toBe("repo-helper");
    expect(skill.riskLevel).toBe("medium");
    expect(skill.files.map((file) => file.path)).toEqual([
      "README.md",
      "skill.json",
    ]);
  });

  it("marks unsafe permissions as high risk", () => {
    expect(
      estimateSkillRisk({
        schemaVersion: 1,
        slug: "unsafe",
        name: "Unsafe",
        description: "Needs broad access.",
        version: "1.0.0",
        permissions: [
          {
            id: "api-keys",
            reason: "Needs provider credentials.",
            required: true,
          },
        ],
      })
    ).toBe("high");
  });

  it("serializes manifest first in canonical JSON form", () => {
    const skill: Skill = {
      id: "skill_1",
      slug: "demo",
      name: "Demo",
      description: "Demo skill.",
      version: "1.0.0",
      tags: [],
      source: { type: "local" },
      manifest: {
        schemaVersion: 1,
        slug: "demo",
        name: "Demo",
        description: "Demo skill.",
        version: "1.0.0",
      },
      files: [{ path: "README.md", content: "# Demo\n" }],
      installState: "available",
      riskLevel: "low",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      installedAt: null,
    };

    const files = serializeSkillPackage(skill);
    expect(files[0].path).toBe("README.md");
    expect(files[1].path).toBe("skill.json");
    expect(files[1].content).toContain('"schemaVersion": 1');
  });
});
