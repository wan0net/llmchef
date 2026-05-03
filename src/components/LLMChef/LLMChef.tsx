// src/components/LLMChef/LLMChef.tsx
// FULL FILE
import React, {
  useEffect,
  useCallback,
  useState,
  useRef,
  useMemo,
} from "react";
import { PromptWrapper } from "@/components/LLMChef/prompt/PromptWrapper";
import { ChatCanvas } from "@/components/LLMChef/canvas/ChatCanvas";
import { ChatControlWrapper } from "@/components/LLMChef/chat/ChatControlWrapper";
import { useConversationStore } from "@/store/conversation.store";
import { useProjectStore } from "@/store/project.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useUIStateStore } from "@/store/ui.store";
import { useControlRegistryStore } from "@/store/control.store";
import type { PromptTurnObject, InputAreaRef } from "@/types/llmchef/prompt";
import { ConversationService } from "@/services/conversation.service";
import { Toaster } from "@/components/ui/sonner";
import { InputArea } from "@/components/LLMChef/prompt/InputArea";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Menu, ShieldCheck, X } from "lucide-react";
import {
  initializeControlModules,
  performFullInitialization,
  registerControlModules,
} from "@/lib/llmchef/initialization";
import { APP_VFS_KEY } from "@/lib/llmchef/constants";
import { usePromptStateStore } from "@/store/prompt.store";
import type {
  ControlModule,
  ControlModuleConstructor,
} from "@/types/llmchef/control";
import { createModApi } from "@/modding/api-factory";
import { useVfsStore } from "@/store/vfs.store";
import type { SidebarItemType } from "@/types/llmchef/chat";
import { EventActionCoordinatorService } from "@/services/event-action-coordinator.service";
import { ModalManager } from "@/components/LLMChef/common/ModalManager";
import { promptEvent } from "@/types/llmchef/events/prompt.events";
import { vfsEvent } from "@/types/llmchef/events/vfs.events";
import { uiEvent } from "@/types/llmchef/events/ui.events";
import { settingsEvent } from "@/types/llmchef/events/settings.events";
import { projectEvent } from "@/types/llmchef/events/project.events";
import type { LLMChefModApi } from "@/types/llmchef/modding";
import { WorkflowService } from "@/services/workflow.service";
import { Crea8MemoryAutomationService } from "@/services/crea8-memory-automation.service";
import { useTranslation } from "react-i18next";
import { nanoid } from "nanoid";
import type { AttachedFileMetadata } from "@/store/input.store";

let initializedControlModules: ControlModule[] = [];
let appInitializationPromise: Promise<ControlModule[]> | null = null;
let hasInitializedSuccessfully = false;
const DocumentsWorkspace = React.lazy(() =>
  import("@/components/LLMChef/documents/DocumentsWorkspace").then((module) => ({
    default: module.DocumentsWorkspace,
  })),
);

const getUninitializedControlConstructors = (
  controls: ControlModuleConstructor[],
): ControlModuleConstructor[] => {
  const initializedIds = new Set(
    initializedControlModules.map((module) => module.id),
  );
  return controls.filter((Ctor) => {
    try {
      return !initializedIds.has(new Ctor().id);
    } catch {
      return true;
    }
  });
};

interface LLMChefProps {
  controls?: ControlModuleConstructor[];
}

export const LLMChef: React.FC<LLMChefProps> = ({ controls = [] }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const inputAreaRef = useRef<InputAreaRef>(null);
  const coreModApiRef = useRef<LLMChefModApi | null>(null);
  const { t } = useTranslation('common');

  const {
    selectedItemId,
    selectedItemType,
    getConversationById: getConversationByIdFromStore,
  } = useConversationStore(
    useShallow((state) => ({
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      getConversationById: state.getConversationById,
    }))
  );

  const { getEffectiveProjectSettings, getProjectById, projects } = useProjectStore(
    useShallow((state) => ({
      getEffectiveProjectSettings: state.getEffectiveProjectSettings,
      getProjectById: state.getProjectById,
      projects: state.projects,
    }))
  );
  const { interactions, status: interactionStatus } = useInteractionStore(
    useShallow((state) => ({
      interactions: state.interactions,
      status: state.status,
    }))
  );
  const {
    globalError,
    isSidebarCollapsed,
    isChatControlPanelOpen,
    workspaceMode,
    setWorkspaceMode,
  } =
    useUIStateStore(
      useShallow((state) => ({
        globalError: state.globalError,
        isSidebarCollapsed: state.isSidebarCollapsed,
        isChatControlPanelOpen: state.isChatControlPanelOpen,
        workspaceMode: state.workspaceMode,
        setWorkspaceMode: state.setWorkspaceMode,
      }))
    );

  const allChatControls = useControlRegistryStore(
    useShallow((state) => Object.values(state.chatControls))
  );

  const sidebarControls = useMemo(
    () =>
      allChatControls.filter(
        (c) => (c.panel ?? "main") === "sidebar" && (c.show ? c.show() : true)
      ),
    [allChatControls]
  );
  const sidebarFooterControls = useMemo(
    () =>
      allChatControls.filter(
        (c) => c.panel === "sidebar-footer" && (c.show ? c.show() : true)
      ),
    [allChatControls]
  );
  const headerControls = useMemo(
    () =>
      allChatControls.filter(
        (c) => c.panel === "header" && (c.show ? c.show() : true)
      ),
    [allChatControls]
  );

  const toggleMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    // Close the mobile sidebar when a conversation or project is selected
    // Don't close for settings or other modal interactions
    if (isMobileSidebarOpen && selectedItemId && (selectedItemType === "conversation" || selectedItemType === "project")) {
      setIsMobileSidebarOpen(false);
    }
  }, [isMobileSidebarOpen, selectedItemId, selectedItemType]);

  useEffect(() => {
    if (!coreModApiRef.current) {
      coreModApiRef.current = createModApi({
        id: "core-llmchef-app",
        name: "LLMChef App Core",
        sourceUrl: null,
        scriptContent: null,
        enabled: true,
        loadOrder: -1000,
        createdAt: new Date(),
      });
    }
    const modApiToUse = coreModApiRef.current;

    EventActionCoordinatorService.initialize();
    WorkflowService.initialize();
    Crea8MemoryAutomationService.initialize();

    const initializeApp = async () => {
      if (hasInitializedSuccessfully) {
        setIsInitializing(false);
        return;
      }

      setIsInitializing(true);
      try {
        initializedControlModules = await performFullInitialization(
          controls,
          modApiToUse
        );
        hasInitializedSuccessfully = true;
      } catch (error) {
        console.error("[LLMChef] App: Top-level initialization error:", error);
        hasInitializedSuccessfully = false;
      } finally {
        setIsInitializing(false);
      }
    };

    if (!appInitializationPromise) {
      appInitializationPromise = initializeApp().then(
        () => initializedControlModules
      );
    }
  }, [controls]);

  useEffect(() => {
    if (isInitializing || !hasInitializedSuccessfully || !coreModApiRef.current) {
      return;
    }

    const pendingControls = getUninitializedControlConstructors(controls);
    if (pendingControls.length === 0) return;

    let cancelled = false;
    const modApi = coreModApiRef.current;
    void (async () => {
      try {
        const modules = await initializeControlModules(pendingControls, modApi);
        if (cancelled) {
          for (const module of modules) module.destroy(modApi);
          return;
        }
        registerControlModules(modules, modApi);
        initializedControlModules = [...initializedControlModules, ...modules];
      } catch (error) {
        console.error("[LLMChef] Failed to stage-load control modules:", error);
        toast.error(
          `Control module load failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [controls, isInitializing]);

  const prevContextRef = useRef<{
    itemId: string | null;
    itemType: SidebarItemType | null;
    effectiveSettingsString: string;
  }>({ itemId: null, itemType: null, effectiveSettingsString: "" });

  useEffect(() => {
    if (isInitializing || !hasInitializedSuccessfully || !coreModApiRef.current)
      return;
    const modApi = coreModApiRef.current;

    const currentContext = {
      itemId: selectedItemId,
      itemType: selectedItemType,
    };

    let currentProjectId: string | null = null;
    if (selectedItemType === "project") {
      currentProjectId = selectedItemId;
    } else if (selectedItemType === "conversation" && selectedItemId) {
      const conversation = getConversationByIdFromStore(selectedItemId);
      currentProjectId = conversation?.projectId ?? null;
    }

    const effectiveSettings = getEffectiveProjectSettings(currentProjectId);
    const effectiveSettingsString = JSON.stringify(effectiveSettings);

    if (
      currentContext.itemId !== prevContextRef.current.itemId ||
      currentContext.itemType !== prevContextRef.current.itemType ||
      effectiveSettingsString !== prevContextRef.current.effectiveSettingsString
    ) {
      modApi.emit(promptEvent.initializePromptStateRequest, {
        effectiveSettings,
      });
      modApi.emit(uiEvent.contextChanged, {
        selectedItemId,
        selectedItemType,
      });
      prevContextRef.current = { ...currentContext, effectiveSettingsString };
    }
  }, [
    selectedItemId,
    selectedItemType,
    getConversationByIdFromStore,
    getEffectiveProjectSettings,
    isInitializing,
  ]);

  useEffect(() => {
    if (isInitializing || !hasInitializedSuccessfully || !coreModApiRef.current)
      return;
    const modApi = coreModApiRef.current;

    const updatePromptStateFromEffectiveSettings = () => {
      let currentProjectId: string | null = null;
      if (selectedItemType === "project") {
        currentProjectId = selectedItemId;
      } else if (selectedItemType === "conversation" && selectedItemId) {
        const conversation = getConversationByIdFromStore(selectedItemId);
        currentProjectId = conversation?.projectId ?? null;
      }
      const effectiveSettings = getEffectiveProjectSettings(currentProjectId);
      modApi.emit(promptEvent.initializePromptStateRequest, {
        effectiveSettings,
      });
    };

    const unsubSettings = modApi.on(
      settingsEvent.loaded,
      updatePromptStateFromEffectiveSettings
    );
    const unsubProjectUpdated = modApi.on(
      projectEvent.updated,
      updatePromptStateFromEffectiveSettings
    );
    const unsubGlobalSystemPrompt = modApi.on(
      settingsEvent.globalSystemPromptChanged,
      updatePromptStateFromEffectiveSettings
    );
    const unsubTemperature = modApi.on(
      settingsEvent.temperatureChanged,
      updatePromptStateFromEffectiveSettings
    );
    const unsubTopP = modApi.on(
      settingsEvent.topPChanged,
      updatePromptStateFromEffectiveSettings
    );
    const unsubMaxTokens = modApi.on(
      settingsEvent.maxTokensChanged,
      updatePromptStateFromEffectiveSettings
    );
    const unsubTopK = modApi.on(
      settingsEvent.topKChanged,
      updatePromptStateFromEffectiveSettings
    );
    const unsubPresencePenalty = modApi.on(
      settingsEvent.presencePenaltyChanged,
      updatePromptStateFromEffectiveSettings
    );
    const unsubFrequencyPenalty = modApi.on(
      settingsEvent.frequencyPenaltyChanged,
      updatePromptStateFromEffectiveSettings
    );

    return () => {
      unsubSettings();
      unsubProjectUpdated();
      unsubGlobalSystemPrompt();
      unsubTemperature();
      unsubTopP();
      unsubMaxTokens();
      unsubTopK();
      unsubPresencePenalty();
      unsubFrequencyPenalty();
    };
  }, [
    selectedItemId,
    selectedItemType,
    getConversationByIdFromStore,
    getEffectiveProjectSettings,
    isInitializing,
  ]);

  useEffect(() => {
    if (isInitializing || !hasInitializedSuccessfully || !coreModApiRef.current)
      return;
    const modApi = coreModApiRef.current;

    const isVfsModalOpen = isChatControlPanelOpen["core-vfs-modal-panel"];
    let targetPath = "/";

    if (selectedItemType === "project") {
      targetPath = getProjectById(selectedItemId)?.path ?? "/";
    } else if (selectedItemType === "conversation") {
      const convo = getConversationByIdFromStore(selectedItemId);
      targetPath = getProjectById(convo?.projectId ?? null)?.path ?? "/";
    } else if (!isVfsModalOpen) {
      targetPath = "/";
    }

    const vfsStore = useVfsStore.getState();
    if (vfsStore.vfsKey !== APP_VFS_KEY) {
      modApi.emit(vfsEvent.setVfsKeyRequest, { key: APP_VFS_KEY });
    }
    void useVfsStore
      .getState()
      .initializeVFS(APP_VFS_KEY)
      .then(() => useVfsStore.getState().setCurrentPath(targetPath))
      .catch((err) => {
        console.error("[LLMChefVFS] Failed to prepare VFS context:", err);
      });
  }, [
    selectedItemId,
    selectedItemType,
    getConversationByIdFromStore,
    getProjectById,
    projects,
    isInitializing,
    isChatControlPanelOpen,
  ]);

  const createAndSelectConversation = async (data: {
    title: string;
    projectId: string | null;
  }): Promise<string> => {
    const conversationState = useConversationStore.getState();
    const newId = await conversationState.addConversation(data);
    console.log("New conversation ID:", newId);
    await conversationState.selectItem(newId, "conversation");
    console.log("conv selected:", newId);
    return newId;
  };

  const handlePromptSubmit = useCallback(async (turnData: PromptTurnObject) => {
    if (!coreModApiRef.current) {
      toast.error(t('applicationCoreNotReady'));
      return;
    }

    const conversationState = useConversationStore.getState();
    let currentConvId =
      conversationState.selectedItemType === "conversation"
        ? conversationState.selectedItemId
        : null;

    const currentProjectId =
      conversationState.selectedItemType === "project"
        ? conversationState.selectedItemId
        : conversationState.selectedItemType === "conversation"
        ? conversationState.getConversationById(
            conversationState.selectedItemId
          )?.projectId ?? null
        : null;

    if (!currentConvId) {
      try {
        currentConvId = await createAndSelectConversation({
          title: "New Chat",
          projectId: currentProjectId,
        });
        console.log("New conversation ID 2:", currentConvId);
      } catch (error) {
        console.error(
          "[LLMChef] App: Failed to create new conversation",
          error
        );
        toast.error(t('failedToStartNewChat'));
        return;
      }
    }

    try {
      const currentPromptState = usePromptStateStore.getState();
      const finalTurnData = {
        ...turnData,
        metadata: {
          ...turnData.metadata,
          modelId: currentPromptState.modelId,
        },
      };
      await ConversationService.submitPrompt(finalTurnData);
    } catch (error) {
      console.error("[LLMChef] App: Error submitting prompt:", error);
      toast.error(t('failedToSendMessage'));
    }
  }, [t]);

  const currentConversationIdForCanvas =
    selectedItemType === "conversation" ? selectedItemId : null;
  const currentProjectId = useMemo(() => {
    if (selectedItemType === "project") return selectedItemId;
    if (selectedItemType === "conversation" && selectedItemId) {
      return getConversationByIdFromStore(selectedItemId)?.projectId ?? null;
    }
    return null;
  }, [getConversationByIdFromStore, selectedItemId, selectedItemType]);

  const handleAskDocuments = useCallback(
    async (question: string, files: Omit<AttachedFileMetadata, "id">[]) => {
      setWorkspaceMode("chat");
      await handlePromptSubmit({
        id: nanoid(),
        content: question,
        parameters: {},
        metadata: {
          attachedFiles: files.map((file) => ({
            id: nanoid(),
            ...file,
          })),
          autoTitleEnabledForTurn: true,
        },
      });
    },
    [handlePromptSubmit, setWorkspaceMode],
  );

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">
            {t('initializingLLMChef')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ModalManager />
      <div className="llmchef-shell flex h-full w-full overflow-hidden border border-border bg-background text-foreground md:m-2 md:h-[calc(100%-1rem)] md:w-[calc(100%-1rem)] md:rounded-lg">
        <div
          className={cn(
            "hidden md:flex flex-col border-r border-border bg-sidebar",
            "transition-[width] duration-300 ease-in-out",
            "flex-shrink-0 overflow-hidden",
            isSidebarCollapsed ? "w-16" : "w-64"
          )}
        >
          <div
            className={cn(
              "flex h-12 flex-shrink-0 items-center border-b border-border px-3",
              isSidebarCollapsed ? "justify-center" : "gap-2"
            )}
          >
            <span className="llmchef-brand-mark flex h-7 w-7 items-center justify-center rounded-md text-white shadow-sm">
              <ShieldCheck className="h-4 w-4" />
            </span>
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-[-0.02em] text-sidebar-foreground">
                  LLMChef
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  Local-first AI workspace
                </div>
              </div>
            )}
          </div>
          <div className="flex-grow overflow-y-auto overflow-x-hidden">
            <div className={cn(isSidebarCollapsed ? "hidden" : "block")}>
              <ChatControlWrapper
                controls={sidebarControls}
                panelId="sidebar"
                renderMode="full"
                className="h-full"
              />
            </div>
            <div className={cn(isSidebarCollapsed ? "block" : "hidden")}>
              <ChatControlWrapper
                controls={sidebarControls}
                panelId="sidebar"
                renderMode="icon"
                className="flex flex-col items-center gap-2 p-2"
              />
            </div>
          </div>
          <div
            className={cn(
              "flex-shrink-0 border-t border-border p-2",
              isSidebarCollapsed
                ? "flex flex-col items-center gap-2"
                : "flex items-center justify-center"
            )}
          >
            <ChatControlWrapper
              controls={sidebarFooterControls}
              panelId="sidebar-footer"
              renderMode={isSidebarCollapsed ? "icon" : "full"}
              className={cn(
                "flex",
                isSidebarCollapsed
                  ? "flex-col gap-2 items-center"
                  : "items-center gap-1 justify-center"
              )}
            />
          </div>
        </div>

        {isMobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-[var(--z-sidebar)] flex">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
              onClick={toggleMobileSidebar}
            ></div>
            <div className="relative w-4/5 max-w-sm bg-sidebar border-r border-border h-full flex flex-col animate-slideInFromLeft shadow-2xl">
              <div className="sticky top-0 z-[var(--z-sticky)] flex justify-between items-center p-4 border-b border-border bg-card">
                <div className="flex items-center gap-2">
                  <span className="llmchef-brand-mark flex h-7 w-7 items-center justify-center rounded-md text-white">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <h2 className="font-semibold text-card-foreground">LLMChef</h2>
                </div>
                <button
                  onClick={toggleMobileSidebar}
                  className="p-2 rounded-md hover:bg-muted text-card-foreground touch-manipulation"
                  aria-label={t('closeMenu')}
                  style={{ minHeight: '44px', minWidth: '44px' }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-grow overflow-y-auto overflow-x-hidden bg-card">
                {sidebarControls.length > 0 ? (
                  <ChatControlWrapper
                    controls={sidebarControls}
                    panelId="sidebar"
                    renderMode="full"
                    className="h-full"
                  />
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    <p className="text-sm">{t('loadingMenu')}</p>
                    <p className="text-xs mt-2">
                      {t('pleaseWaitInitialization')}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 border-t border-border p-4 bg-card">
                {sidebarFooterControls.length > 0 ? (
                  <ChatControlWrapper
                    controls={sidebarFooterControls}
                    panelId="sidebar-footer"
                    renderMode="full"
                    className="flex items-center justify-between"
                  />
                ) : (
                  <div className="text-center text-muted-foreground text-xs">
                    {t('footerControlsLoading')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col flex-grow min-w-0">
          <div className="link42-panel flex items-center justify-between border-b border-border px-2 py-1.5 flex-shrink-0">
            <button
              className={cn(
                "md:hidden p-3 rounded-md hover:bg-muted active:bg-muted/80 transition-colors touch-manipulation",
                isMobileSidebarOpen && "bg-muted"
              )}
              onClick={toggleMobileSidebar}
              aria-label={t(isMobileSidebarOpen ? 'closeMenu' : 'openMenu')}
              style={{ minHeight: '44px', minWidth: '44px' }}
            >
              {isMobileSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <ChatControlWrapper
              controls={headerControls}
              panelId="header"
              className="flex items-center justify-end gap-1 flex-grow"
            />
          </div>

          {workspaceMode === "chat" ? (
            <ChatCanvas
              conversationId={currentConversationIdForCanvas}
              interactions={interactions}
              status={interactionStatus}
              className="flex-grow overflow-y-hidden"
            />
          ) : (
            <React.Suspense
              fallback={
                <div className="flex flex-grow items-center justify-center text-sm text-muted-foreground">
                  Loading wiki...
                </div>
              }
            >
              <DocumentsWorkspace
                currentProjectId={currentProjectId}
                onAskDocuments={handleAskDocuments}
              />
            </React.Suspense>
          )}

          {globalError && (
            <div className="p-2 bg-destructive text-destructive-foreground text-sm text-center">
              Error: {globalError}
            </div>
          )}

          {workspaceMode === "chat" ? (
            <PromptWrapper
              InputAreaRenderer={InputArea}
              onSubmit={handlePromptSubmit}
              className="border-t border-border bg-card flex-shrink-0"
              inputAreaRef={inputAreaRef}
              selectedItemId={selectedItemId}
              selectedItemType={selectedItemType}
            />
          ) : null}
        </div>
      </div>
      <Toaster richColors position="bottom-right" closeButton />
    </>
  );
};
