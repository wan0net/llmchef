import { describe, expect, it } from "vitest";
import {
  agentsBundleSchema,
  normalizeImportedAgentTemplates,
  promptTemplatesBundleSchema,
} from "./import-export-validation";

describe("import-export validation", () => {
  it("rejects non-prompt template types in prompt template bundles", () => {
    const result = promptTemplatesBundleSchema.safeParse({
      version: 1,
      promptTemplates: [
        {
          id: "agent-1",
          type: "agent",
          name: "Bad bundle",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error.issues[0]?.message).toMatch(/regular prompt templates/i);
  });

  it("rejects orphaned task references in agent bundles", () => {
    const result = agentsBundleSchema.safeParse({
      version: 1,
      agents: [
        {
          id: "task-1",
          type: "task",
          parentId: "missing-agent",
          name: "Orphan task",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error.issues[0]?.message).toMatch(/missing agent/i);
  });

  it("remaps generated agent ids onto child tasks during normalization", () => {
    const normalized = normalizeImportedAgentTemplates([
      {
        type: "agent",
        name: "Agent without id",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        type: "task",
        name: "Child task",
        parentId: "agent:Agent without id:0",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    expect(normalized[0].id).toBeTruthy();
    expect(normalized[1].parentId).toBe(normalized[0].id);
  });
});
