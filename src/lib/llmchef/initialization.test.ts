import { beforeEach, describe, expect, it, vi } from "vitest";

import { performFullInitialization } from "./initialization";
import { conversationEvent } from "@/types/llmchef/events/conversation.events";
import { modEvent } from "@/types/llmchef/events/mod.events";
import { projectEvent } from "@/types/llmchef/events/project.events";
import { promptEvent } from "@/types/llmchef/events/prompt.events";
import { providerEvent } from "@/types/llmchef/events/provider.events";
import { rulesEvent } from "@/types/llmchef/events/rules.events";
import { settingsEvent } from "@/types/llmchef/events/settings.events";
import type { Conversation } from "@/types/llmchef/chat";
import type { LLMChefModApi, ModEventPayloadMap } from "@/types/llmchef/modding";

const mocks = vi.hoisted(() => {
  const conversationState = {
    conversations: [] as Conversation[],
    selectedItemId: "conversation-1",
    selectedItemType: "conversation",
    getConversationById: vi.fn((id: string | null) => {
      if (!id) return undefined;
      return conversationState.conversations.find((conversation) => conversation.id === id);
    }),
  };

  return {
    conversationState,
    modState: {
      dbMods: [] as unknown[],
      setLoadedMods: vi.fn(),
    },
    projectState: {
      getEffectiveProjectSettings: vi.fn((projectId: string | null) => ({
        modelId: projectId ? `model-for-${projectId}` : "default-model",
        temperature: null,
        maxTokens: null,
        topP: null,
        topK: null,
        presencePenalty: null,
        frequencyPenalty: null,
      })),
    },
    promptState: {
      initializePromptState: vi.fn(),
    },
    uiState: {
      setGlobalError: vi.fn(),
    },
    applyBundledConfig: vi.fn(async () => {}),
    loadMods: vi.fn(async () => []),
    initializeCanvasEventHandlers: vi.fn(),
    runStartupSync: vi.fn(async () => {}),
    emitterEmit: vi.fn(),
    toastError: vi.fn(),
  };
});

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

vi.mock("@/store/conversation.store", () => ({
  useConversationStore: {
    getState: vi.fn(() => mocks.conversationState),
  },
}));

vi.mock("@/store/mod.store", () => ({
  useModStore: {
    getState: vi.fn(() => mocks.modState),
  },
}));

vi.mock("@/store/project.store", () => ({
  useProjectStore: {
    getState: vi.fn(() => mocks.projectState),
  },
}));

vi.mock("@/store/prompt.store", () => ({
  usePromptStateStore: {
    getState: vi.fn(() => mocks.promptState),
  },
}));

vi.mock("@/store/ui.store", () => ({
  useUIStateStore: {
    getState: vi.fn(() => mocks.uiState),
  },
}));

vi.mock("@/modding/loader", () => ({
  loadMods: mocks.loadMods,
}));

vi.mock("@/services/interaction.service", () => ({
  InteractionService: {
    initializeCanvasEventHandlers: mocks.initializeCanvasEventHandlers,
  },
}));

vi.mock("@/services/bundled-config.service", () => ({
  BundledConfigService: {
    applyBundledConfig: mocks.applyBundledConfig,
  },
}));

vi.mock("@/services/startup-sync.service", () => ({
  StartupSyncService: {
    runStartupSync: mocks.runStartupSync,
  },
}));

vi.mock("./event-emitter", () => ({
  emitter: {
    emit: mocks.emitterEmit,
  },
}));

const loadedConversation: Conversation = {
  id: "conversation-1",
  title: "Conversation 1",
  projectId: "project-42",
  metadata: {},
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  syncRepoId: null,
  lastSyncedAt: null,
};

describe("performFullInitialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.conversationState.conversations = [];
    mocks.conversationState.selectedItemId = "conversation-1";
    mocks.conversationState.selectedItemType = "conversation";
  });

  it("resolves initial prompt settings from conversations loaded during startup", async () => {
    const modApi = createStartupModApi();

    await performFullInitialization([], modApi);

    expect(mocks.projectState.getEffectiveProjectSettings).toHaveBeenCalledWith("project-42");
    expect(modApi.emit).toHaveBeenCalledWith(
      promptEvent.initializePromptStateRequest,
      expect.objectContaining({
        effectiveSettings: expect.objectContaining({ modelId: "model-for-project-42" }),
      }),
    );
  });
});

function createStartupModApi(): LLMChefModApi {
  const listeners = new Map<string, Array<(payload: unknown) => void>>();
  const requested = new Set<string>();

  const emit = vi.fn(<K extends keyof ModEventPayloadMap>(eventName: K, payload: ModEventPayloadMap[K]) => {
    requested.add(eventName as string);
    flushIfReady(eventName as string);
    listeners.get(eventName as string)?.forEach((callback) => callback(payload));
  });

  const on = vi.fn(<K extends keyof ModEventPayloadMap>(eventName: K, callback: (payload: ModEventPayloadMap[K]) => void) => {
    const bucket = listeners.get(eventName as string) ?? [];
    bucket.push(callback as (payload: unknown) => void);
    listeners.set(eventName as string, bucket);
    flushIfReady(eventName as string);
    return () => {
      const current = listeners.get(eventName as string) ?? [];
      listeners.set(
        eventName as string,
        current.filter((candidate) => candidate !== callback),
      );
    };
  });

  const flushIfReady = (eventName: string) => {
    const eventMap: Record<string, string> = {
      [settingsEvent.loaded]: settingsEvent.loadSettingsRequest,
      [providerEvent.initialDataLoaded]: providerEvent.loadInitialDataRequest,
      [rulesEvent.dataLoaded]: rulesEvent.loadRulesAndTagsRequest,
      [conversationEvent.conversationsLoaded]: conversationEvent.loadConversationsRequest,
      [projectEvent.loaded]: projectEvent.loadProjectsRequest,
      [modEvent.dbModsLoaded]: modEvent.loadDbModsRequest,
    };

    const requestEvent = eventMap[eventName];
    if (!requestEvent || !requested.has(requestEvent)) {
      return;
    }

    if (eventName === conversationEvent.conversationsLoaded) {
      mocks.conversationState.conversations = [loadedConversation];
    }

    queueMicrotask(() => {
      listeners.get(eventName)?.splice(0).forEach((callback) => callback(undefined));
    });
  };

  return {
    modId: "core",
    modName: "core",
    emit,
    on,
    registerPromptControl: vi.fn(() => () => {}),
    registerChatControl: vi.fn(() => () => {}),
    registerCanvasControl: vi.fn(() => () => {}),
    registerSelectionControl: vi.fn(() => () => {}),
    registerBlockRenderer: vi.fn(() => () => {}),
    registerRule: vi.fn(() => () => {}),
    registerTool: vi.fn(() => () => {}),
    addMiddleware: vi.fn(() => () => {}),
    registerSettingsTab: vi.fn(() => () => {}),
    getContextSnapshot: vi.fn(() => ({
      selectedConversationId: null,
      interactions: [],
      isStreaming: false,
      selectedProviderId: null,
      selectedModelId: null,
      activeSystemPrompt: null,
      temperature: null,
      maxTokens: null,
      theme: "system",
      gitUserName: null,
      gitUserEmail: null,
    })),
    showToast: vi.fn(),
    log: vi.fn(),
    registerModalProvider: vi.fn(() => () => {}),
    getVfsInstance: vi.fn(async () => null),
  };
}
