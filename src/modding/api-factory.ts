// src/modding/api-factory.ts
// FULL FILE
import type {
  DbMod,
  LLMChefModApi,
  ReadonlyChatContextSnapshot,
  CustomSettingTab,
  ToolImplementation,
  ModMiddlewareHookName,
  ModEventPayloadMap,
  ModPromptControl,
  ModChatControl,
  ModalProvider,
  ModControlRule,
} from "@/types/llmchef/modding";
import type { ChatControl as CoreChatControlFromTypes } from "@/types/llmchef/chat";
import type { PromptControl as CorePromptControlFromTypes } from "@/types/llmchef/prompt";
import type { CanvasControl as CoreCanvasControlFromTypes, SelectionControl } from "@/types/llmchef/canvas/control";
import type { BlockRenderer } from "@/types/llmchef/canvas/block-renderer";

import { Tool } from "ai";
import { useInteractionStore } from "@/store/interaction.store";
import { useConversationStore } from "@/store/conversation.store";
import { useSettingsStore } from "@/store/settings.store";
import { useProviderStore } from "@/store/provider.store";
import { useModStore } from "@/store/mod.store";
import { emitter } from "@/lib/llmchef/event-emitter";
import { toast } from "sonner";
import type { z } from "zod";
import { splitModelId } from "@/lib/llmchef/provider-helpers";
import { useVfsStore } from "@/store/vfs.store";
import { APP_VFS_KEY } from "@/lib/llmchef/constants";
import type { fs } from "@zenfs/core";
import { controlRegistryEvent } from "@/types/llmchef/events/control.registry.events";
import { blockRendererEvent } from "@/types/llmchef/events/block-renderer.events";

export function createModApi(mod: DbMod): LLMChefModApi {
  const modId = mod.id;
  const modName = mod.name;
  const unsubscribers: (() => void)[] = [];

  const api: LLMChefModApi = {
    modId,
    modName,
    registerPromptControl: (control: ModPromptControl) => {
      emitter.emit(controlRegistryEvent.registerPromptControlRequest, {
        control: control as CorePromptControlFromTypes,
      });
      const u = () =>
        emitter.emit(controlRegistryEvent.unregisterPromptControlRequest, {
          id: control.id,
        });
      unsubscribers.push(u);
      return u;
    },
    registerChatControl: (control: ModChatControl) => {
      const controlWithDefaults: CoreChatControlFromTypes = {
        ...control,
        status: control.status ?? (() => "ready"),
      };
      emitter.emit(controlRegistryEvent.registerChatControlRequest, {
        control: controlWithDefaults,
      });
      const u = () =>
        emitter.emit(controlRegistryEvent.unregisterChatControlRequest, {
          id: control.id,
        });
      unsubscribers.push(u);
      return u;
    },
    registerCanvasControl: (control: CoreCanvasControlFromTypes) => {
      emitter.emit(controlRegistryEvent.registerCanvasControlRequest, {
        control,
      });
      const u = () =>
        emitter.emit(controlRegistryEvent.unregisterCanvasControlRequest, {
          id: control.id,
        });
      unsubscribers.push(u);
      return u;
    },
    registerSelectionControl: (control: SelectionControl) => {
      emitter.emit(controlRegistryEvent.registerSelectionControlRequest, {
        control,
      });
      const u = () =>
        emitter.emit(controlRegistryEvent.unregisterSelectionControlRequest, {
          id: control.id,
        });
      unsubscribers.push(u);
      return u;
    },
    registerBlockRenderer: (renderer: BlockRenderer) => {
      emitter.emit(blockRendererEvent.registerBlockRendererRequest, {
        renderer,
      });
      const u = () =>
        emitter.emit(blockRendererEvent.unregisterBlockRendererRequest, {
          id: renderer.id,
        });
      unsubscribers.push(u);
      return u;
    },
    registerRule: (rule: ModControlRule) => {
      // Control rules are registered in memory only, not saved to database
      emitter.emit(controlRegistryEvent.registerControlRuleRequest, {
        rule,
      });
      const u = () => {
        emitter.emit(controlRegistryEvent.unregisterControlRuleRequest, {
          id: rule.id,
        });
      };
      unsubscribers.push(u);
      return u;
    },
    registerTool: <P extends z.ZodSchema<any>>(
      toolName: string,
      definition: Tool<P>,
      implementation?: ToolImplementation<P>
    ) => {
      console.log(`[${modName}] Registering tool: ${toolName}`);
      emitter.emit(controlRegistryEvent.registerToolRequest, {
        modId,
        toolName,
        definition,
        implementation,
      });
      const u = () =>
        emitter.emit(controlRegistryEvent.unregisterToolRequest, { toolName });
      unsubscribers.push(u);
      return u;
    },
    on: <K extends keyof ModEventPayloadMap>(
      eventName: K,
      callback: (payload: ModEventPayloadMap[K]) => void
    ) => {
      emitter.on(eventName, callback);
      const u = () => emitter.off(eventName, callback);
      unsubscribers.push(u);
      return u;
    },
    emit: <K extends keyof ModEventPayloadMap>(
      eventName: K,
      payload: ModEventPayloadMap[K]
    ) => {
      emitter.emit(eventName, payload);
    },
    addMiddleware: <H extends ModMiddlewareHookName>(
      hookName: H,
      callback: (
        payload: any
      ) =>
        | import("@/types/llmchef/modding").ModMiddlewareReturnMap[H]
        | Promise<import("@/types/llmchef/modding").ModMiddlewareReturnMap[H]>
    ) => {
      emitter.emit(controlRegistryEvent.registerMiddlewareRequest, {
        hookName,
        modId,
        callback,
      });
      const u = () =>
        emitter.emit(controlRegistryEvent.unregisterMiddlewareRequest, {
          hookName,
          modId,
          callback,
        });
      unsubscribers.push(u);
      return u;
    },
    registerSettingsTab: (tab: CustomSettingTab) => {
      useModStore.getState()._addSettingsTab(tab);
      const u = () => useModStore.getState()._removeSettingsTab(tab.id);
      unsubscribers.push(u);
      return u;
    },
    getContextSnapshot: (): ReadonlyChatContextSnapshot => {
      const iS = useInteractionStore.getState();
      const cS = useConversationStore.getState();
      const sS = useSettingsStore.getState();
      const pS = useProviderStore.getState();
      const { providerId } = splitModelId(pS.selectedModelId);

      const selectedConversationId =
        cS.selectedItemType === "conversation" ? cS.selectedItemId : null;

      return Object.freeze({
        selectedConversationId: selectedConversationId,
        interactions: Object.freeze(
          iS.currentConversationId === selectedConversationId
            ? iS.interactions.map((i) => Object.freeze({ ...i }))
            : []
        ),
        isStreaming: iS.status === "streaming",
        selectedProviderId: providerId,
        selectedModelId: pS.selectedModelId,
        activeSystemPrompt: sS.globalSystemPrompt,
        temperature: sS.temperature,
        maxTokens: sS.maxTokens,
        theme: sS.theme,
        gitUserName: sS.gitUserName,
        gitUserEmail: sS.gitUserEmail,
      });
    },
    showToast: (t, m) => {
      toast[t](`[Mod: ${modName}] ${m}`);
    },
    log: (l, ...a) => {
      // Use safe console access instead of dynamic property access
      if (l === 'log') {
        console.log(`[Mod: ${modName}]`, ...a);
      } else if (l === 'error') {
        console.error(`[Mod: ${modName}]`, ...a);
      } else if (l === 'warn') {
        console.warn(`[Mod: ${modName}]`, ...a);
      } else if (l === 'info') {
        console.info(`[Mod: ${modName}]`, ...a);
      } else {
        console.log(`[Mod: ${modName}]`, ...a);
      }
    },
    registerModalProvider: (modalId: string, provider: ModalProvider) => {
      emitter.emit(controlRegistryEvent.registerModalProviderRequest, {
        modalId,
        provider,
      });
      const u = () =>
        emitter.emit(controlRegistryEvent.unregisterModalProviderRequest, {
          modalId,
        });
      unsubscribers.push(u);
      return u;
    },
    getVfsInstance: async (_vfsKey: string): Promise<typeof fs | null> => {
      return useVfsStore.getState().initializeVFS(APP_VFS_KEY, { force: true });
    },
  };

  return api;
}
