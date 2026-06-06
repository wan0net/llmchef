import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadSetting: vi.fn(),
  saveSetting: vi.fn(),
  loadPromptTemplates: vi.fn(),
  savePromptTemplate: vi.fn(),
  deletePromptTemplate: vi.fn(),
  loadWorkflows: vi.fn(),
  saveWorkflow: vi.fn(),
}));

vi.mock("./persistence.service", () => ({
  PersistenceService: {
    loadSetting: mocks.loadSetting,
    saveSetting: mocks.saveSetting,
    loadPromptTemplates: mocks.loadPromptTemplates,
    savePromptTemplate: mocks.savePromptTemplate,
    deletePromptTemplate: mocks.deletePromptTemplate,
    loadWorkflows: mocks.loadWorkflows,
    saveWorkflow: mocks.saveWorkflow,
  },
}));

import {
  createDefaultWorkflowWebSearchSettings,
  WorkflowWebSearchPersistenceService,
} from "./workflow-websearch-persistence.service";
import { WEBSEARCH_TEMPLATE_IDS } from "@/lib/llmchef/websearch-prompt-templates";

describe("workflow websearch persistence service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates defaults when no settings are persisted", async () => {
    mocks.loadSetting.mockImplementation(async (_key: string, defaultValue: unknown) => defaultValue);

    await expect(
      WorkflowWebSearchPersistenceService.loadSettings(),
    ).resolves.toEqual(createDefaultWorkflowWebSearchSettings());
  });

  it("merges partial persisted settings with defaults", async () => {
    mocks.loadSetting.mockResolvedValue({
      searchConfig: {
        maxResults: 9,
        timeRange: "week",
      },
      deepSearchConfig: {
        enabled: true,
      },
      selectedWorkflow: "deep-websearch",
    });

    await expect(
      WorkflowWebSearchPersistenceService.loadSettings(),
    ).resolves.toMatchObject({
      searchConfig: expect.objectContaining({
        maxResults: 9,
        searchDepth: 1,
        timeRange: "week",
      }),
      deepSearchConfig: expect.objectContaining({
        enabled: true,
        maxDepth: 2,
      }),
      selectedWorkflow: "deep-websearch",
    });
  });

  it("saves normalized settings via app-state persistence", async () => {
    mocks.saveSetting.mockResolvedValue(undefined);

    const settings = createDefaultWorkflowWebSearchSettings();
    settings.searchConfig.maxResults = 11;

    await WorkflowWebSearchPersistenceService.saveSettings(settings);

    expect(mocks.saveSetting).toHaveBeenCalledWith(
      "workflowWebSearchConfig",
      expect.objectContaining({
        searchConfig: expect.objectContaining({ maxResults: 11 }),
      }),
    );
  });

  it("repairs stale prompt templates that were stored under the wrong id", async () => {
    mocks.loadPromptTemplates.mockResolvedValue([
      {
        id: "legacy-template-id",
        name: "Web Search Query Generator",
        description: "stale",
        variables: [],
        prompt: "old",
        tags: [],
        isPublic: false,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      },
    ]);
    mocks.savePromptTemplate.mockResolvedValue(undefined);
    mocks.deletePromptTemplate.mockResolvedValue(undefined);

    await WorkflowWebSearchPersistenceService.ensurePromptTemplatesRegistered();

    expect(mocks.deletePromptTemplate).toHaveBeenCalledWith("legacy-template-id");
    expect(mocks.savePromptTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: WEBSEARCH_TEMPLATE_IDS.QUERY_GENERATOR,
        name: "Web Search Query Generator",
      }),
    );
  });

  it("seeds missing websearch workflows and can look them up by id", async () => {
    mocks.loadWorkflows
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "basic-websearch",
          name: "Basic Web Search",
          description: "",
          steps: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]);
    mocks.saveWorkflow.mockResolvedValue(undefined);

    await WorkflowWebSearchPersistenceService.ensureWorkflowTemplatesRegistered();

    expect(mocks.saveWorkflow).toHaveBeenCalledTimes(2);

    const workflow =
      await WorkflowWebSearchPersistenceService.loadWorkflowTemplateById(
        "basic-websearch",
      );

    expect(workflow).toMatchObject({ id: "basic-websearch" });
  });
});
