import { PersistenceService } from "@/services/persistence.service";
import {
  websearchPromptTemplates,
  WEBSEARCH_TEMPLATE_IDS,
} from "@/lib/llmchef/websearch-prompt-templates";
import basicWebSearchWorkflow from "@/assets/workflows/basic-websearch.json";
import deepWebSearchWorkflow from "@/assets/workflows/deep-websearch.json";
import type {
  DeepSearchConfig,
  WebSearchConfig,
} from "@/types/llmchef/websearch";
import type { WorkflowTemplate } from "@/types/llmchef/workflow";

const WORKFLOW_WEBSEARCH_CONFIG_KEY = "workflowWebSearchConfig";
const LEGACY_WORKFLOW_WEBSEARCH_CONFIG_KEY = "workflow-websearch-config";
const WEBSEARCH_TEMPLATE_UPDATE_CUTOFF_DATE = new Date("2025-07-14T19:02:00Z");

export interface WorkflowWebSearchSettings {
  searchConfig: WebSearchConfig;
  deepSearchConfig: DeepSearchConfig;
  selectedWorkflow: string;
}

export const createDefaultWorkflowWebSearchConfig = (): WebSearchConfig => ({
  maxResults: 5,
  searchDepth: 1,
  enableImageSearch: false,
  condensationEnabled: true,
  delayBetweenRequests: 1000,
  maxContentLength: 10000,
  persistAcrossSubmissions: false,
  region: "us-en",
  safeSearch: "moderate",
});

export const createDefaultWorkflowWebSearchDeepConfig =
  (): DeepSearchConfig => ({
    enabled: false,
    maxDepth: 2,
    avenuesPerDepth: 3,
  });

export const createDefaultWorkflowWebSearchSettings =
  (): WorkflowWebSearchSettings => ({
    searchConfig: createDefaultWorkflowWebSearchConfig(),
    deepSearchConfig: createDefaultWorkflowWebSearchDeepConfig(),
    selectedWorkflow: "basic-websearch",
  });

const normalizeWorkflowWebSearchSettings = (
  value: Partial<WorkflowWebSearchSettings> | null | undefined,
): WorkflowWebSearchSettings => {
  const defaults = createDefaultWorkflowWebSearchSettings();

  return {
    searchConfig: {
      ...defaults.searchConfig,
      ...(value?.searchConfig ?? {}),
    },
    deepSearchConfig: {
      ...defaults.deepSearchConfig,
      ...(value?.deepSearchConfig ?? {}),
    },
    selectedWorkflow: value?.selectedWorkflow || defaults.selectedWorkflow,
  };
};

export class WorkflowWebSearchPersistenceService {
  static async loadSettings(): Promise<WorkflowWebSearchSettings> {
    const persisted = await PersistenceService.loadSetting<
      Partial<WorkflowWebSearchSettings>
    >(
      WORKFLOW_WEBSEARCH_CONFIG_KEY,
      null as Partial<WorkflowWebSearchSettings> | null,
    );

    if (persisted) {
      return normalizeWorkflowWebSearchSettings(persisted);
    }

    const legacySettings = this.loadLegacySettings();
    if (!legacySettings) {
      return createDefaultWorkflowWebSearchSettings();
    }

    const normalized = normalizeWorkflowWebSearchSettings(legacySettings);

    await PersistenceService.saveSetting(
      WORKFLOW_WEBSEARCH_CONFIG_KEY,
      normalized,
    );
    globalThis.localStorage?.removeItem(LEGACY_WORKFLOW_WEBSEARCH_CONFIG_KEY);

    return normalized;
  }

  static async saveSettings(settings: WorkflowWebSearchSettings): Promise<void> {
    await PersistenceService.saveSetting(
      WORKFLOW_WEBSEARCH_CONFIG_KEY,
      normalizeWorkflowWebSearchSettings(settings),
    );
  }

  static async ensurePromptTemplatesRegistered(): Promise<void> {
    const existingTemplates = await PersistenceService.loadPromptTemplates();
    const templateIds = Object.values(WEBSEARCH_TEMPLATE_IDS);

    for (const [index, template] of websearchPromptTemplates.entries()) {
      const templateId = templateIds[index];
      const existingById = existingTemplates.find((item) => item.id === templateId);
      const existingByName = existingTemplates.find(
        (item) => item.name === template.name,
      );
      const existing = existingById || existingByName;

      if (!existing) {
        await PersistenceService.savePromptTemplate({
          id: templateId,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...template,
        });
        continue;
      }

      const existingUpdatedAt =
        existing.updatedAt instanceof Date
          ? existing.updatedAt
          : new Date(existing.updatedAt);

      if (existingUpdatedAt >= WEBSEARCH_TEMPLATE_UPDATE_CUTOFF_DATE) {
        continue;
      }

      if (existing.id !== templateId) {
        await PersistenceService.deletePromptTemplate(existing.id);
      }

      await PersistenceService.savePromptTemplate({
        ...existing,
        ...template,
        id: templateId,
        updatedAt: new Date(),
      });
    }
  }

  static async ensureWorkflowTemplatesRegistered(): Promise<void> {
    const existingWorkflows = await PersistenceService.loadWorkflows();

    if (!existingWorkflows.some((workflow) => workflow.id === "basic-websearch")) {
      await PersistenceService.saveWorkflow(
        basicWebSearchWorkflow as WorkflowTemplate,
      );
    }

    if (!existingWorkflows.some((workflow) => workflow.id === "deep-websearch")) {
      await PersistenceService.saveWorkflow(
        deepWebSearchWorkflow as WorkflowTemplate,
      );
    }
  }

  static async loadWorkflowTemplateById(
    workflowId: string,
  ): Promise<WorkflowTemplate | undefined> {
    const workflows = await PersistenceService.loadWorkflows();
    return workflows.find((workflow) => workflow.id === workflowId);
  }

  private static loadLegacySettings():
    | Partial<WorkflowWebSearchSettings>
    | null {
    try {
      const serialized = globalThis.localStorage?.getItem(
        LEGACY_WORKFLOW_WEBSEARCH_CONFIG_KEY,
      );

      if (!serialized) {
        return null;
      }

      const parsed = JSON.parse(serialized);
      return parsed && typeof parsed === "object"
        ? (parsed as Partial<WorkflowWebSearchSettings>)
        : null;
    } catch (error) {
      console.warn("Failed to load legacy workflow websearch settings:", error);
      return null;
    }
  }
}
