import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  saveInteraction: vi.fn(),
  savePromptTemplate: vi.fn(),
  saveSetting: vi.fn(),
  saveWorkflow: vi.fn(),
  importAllData: vi.fn(),
  dbTransaction: vi.fn(async (_mode: string, _tables: unknown[], scope: () => Promise<void>) => {
    await scope();
  }),
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/lib/llmchef/db", () => ({
  db: {
    transaction: mocks.dbTransaction,
    promptTemplates: {},
    appState: {},
    workflows: {},
  },
}));
vi.mock("@/services/persistence.service", () => ({
  PersistenceService: {
    saveInteraction: mocks.saveInteraction,
    savePromptTemplate: mocks.savePromptTemplate,
    saveSetting: mocks.saveSetting,
    saveWorkflow: mocks.saveWorkflow,
    importAllData: mocks.importAllData,
  },
}));
vi.mock("@/store/conversation.store", () => ({
  useConversationStore: { getState: vi.fn() },
}));
vi.mock("@/store/project.store", () => ({
  useProjectStore: { getState: vi.fn() },
}));

import { ImportExportService } from "./import-export.service";

describe("ImportExportService import hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.dbTransaction.mockImplementation(async (_mode: string, _tables: unknown[], scope: () => Promise<void>) => {
      await scope();
    });
  });

  it("rejects prompt-template bundles that contain non-prompt template types", async () => {
    const file = jsonFile({
      version: 1,
      promptTemplates: [
        {
          id: "agent-1",
          type: "agent",
          name: "Not allowed here",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    await expect(ImportExportService.importPromptTemplates(file)).rejects.toThrow(
      /Prompt template imports may only contain regular prompt templates/i,
    );
    expect(mocks.savePromptTemplate).not.toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });

  it("rolls back prompt-template imports when any template save fails", async () => {
    mocks.savePromptTemplate
      .mockResolvedValueOnce("template-1")
      .mockRejectedValueOnce(new Error("disk exploded"));

    const file = jsonFile({
      version: 1,
      promptTemplates: [
        {
          id: "prompt-1",
          type: "prompt",
          name: "One",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "prompt-2",
          type: "prompt",
          name: "Two",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    await expect(ImportExportService.importPromptTemplates(file)).rejects.toThrow(/disk exploded/i);
    expect(mocks.dbTransaction).toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });

  it("rejects agent bundles with orphaned task parent references", async () => {
    const file = jsonFile({
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

    await expect(ImportExportService.importAgents(file)).rejects.toThrow(/references missing agent/i);
    expect(mocks.savePromptTemplate).not.toHaveBeenCalled();
  });

  it("validates full configuration bundles before importing data", async () => {
    const file = jsonFile({
      version: 1,
      settings: "definitely not an object",
    });

    await expect(
      ImportExportService.importFullConfiguration(file, {
        importSettings: true,
        importApiKeys: false,
        importProviderConfigs: false,
        importProjects: false,
        importConversations: false,
        importRulesAndTags: false,
        importMods: false,
        importSyncRepos: false,
        importMcpServers: false,
        importPromptTemplates: false,
        importAgents: false,
        importWorkflows: false,
        importSkills: false,
        importCrea8MemoryProposals: false,
      }),
    ).rejects.toThrow();

    expect(mocks.importAllData).not.toHaveBeenCalled();
  });
});

function jsonFile(payload: unknown): File {
  return {
    text: async () => JSON.stringify(payload),
  } as File;
}
