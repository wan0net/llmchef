// src/components/LLMChef/prompt/PromptWrapper.tsx
// FULL FILE
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  GripVerticalIcon,
  ListPlusIcon,
  Loader2,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  SendHorizonalIcon,
  XIcon,
} from "lucide-react";
import { PromptControlWrapper } from "./PromptControlWrapper";
import { useControlRegistryStore } from "@/store/control.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useInputStore } from "@/store/input.store";
import type { AttachedFileMetadata } from "@/store/input.store";
import type {
  PromptTurnObject,
  InputAreaRenderer,
  InputAreaRef,
} from "@/types/llmchef/prompt";
import { nanoid } from "nanoid";
import { emitter } from "@/lib/llmchef/event-emitter";
import { runMiddleware } from "@/lib/llmchef/ai-helpers"; // Corrected: Ensure this is exported
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { ModMiddlewareHook } from "@/types/llmchef/modding";
import { promptEvent } from "@/types/llmchef/events/prompt.events";
import type { SidebarItemType } from "@/types/llmchef/chat";
import { usePromptStateStore } from "@/store/prompt.store";
import { useTranslation } from "react-i18next";

interface PromptQueueItem {
  id: string;
  turnData: PromptTurnObject;
  createdAt: number;
}

interface PromptWrapperProps {
  InputAreaRenderer: InputAreaRenderer;
  onSubmit: (turnData: PromptTurnObject) => Promise<void>;
  className?: string;
  placeholder?: string;
  inputAreaRef: React.RefObject<InputAreaRef | null>;
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
}

export const PromptWrapper: React.FC<PromptWrapperProps> = ({
  InputAreaRenderer,
  onSubmit,
  className,
  placeholder,
  inputAreaRef,
  selectedItemId,
  selectedItemType,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasInputValue, setHasInputValue] = useState(false);
  const [queueItems, setQueueItems] = useState<PromptQueueItem[]>([]);
  const [autoRunQueue, setAutoRunQueue] = useState(true);
  const [draggingQueueItemId, setDraggingQueueItemId] = useState<string | null>(null);
  const { t } = useTranslation('prompt');

  const registeredPromptControls = useControlRegistryStore(
    useShallow((state) => state.promptControls)
  );
  const isStreaming = useInteractionStore(
    useShallow((state) => state.status === "streaming")
  );
  const { attachedFilesMetadata, clearAttachedFiles } = useInputStore(
    useShallow((state) => ({
      attachedFilesMetadata: state.attachedFilesMetadata,
      clearAttachedFiles: state.clearAttachedFiles,
    }))
  );
  const currentModelIdFromPromptStore = usePromptStateStore(
    (state) => state.modelId
  );

  const promptControls = useMemo(() => {
    return Object.values(registeredPromptControls);
  }, [registeredPromptControls]);

  const panelControls = useMemo(
    () => promptControls.filter((c) => c.renderer),
    [promptControls]
  );
  const triggerControls = useMemo(
    () => promptControls.filter((c) => c.triggerRenderer),
    [promptControls]
  );

  const createTurnData = useCallback(async (
    content: string,
    files: AttachedFileMetadata[],
  ): Promise<PromptTurnObject> => {
    let parameters: Record<string, any> = {};
    let metadata: Record<string, any> = {};

    for (const control of promptControls) {
      if (control.getParameters) {
        const params = await control.getParameters();
        if (params) parameters = { ...parameters, ...params };
      }
      if (control.getMetadata) {
        const meta = await control.getMetadata();
        if (meta) metadata = { ...metadata, ...meta };
      }
    }

    if (files.length > 0) {
      metadata.attachedFiles = [...files];
    }

    if (!metadata.modelId && currentModelIdFromPromptStore) {
      metadata.modelId = currentModelIdFromPromptStore;
    }

    return {
      id: nanoid(),
      content,
      parameters,
      metadata,
    };
  }, [currentModelIdFromPromptStore, promptControls]);

  const submitTurnData = useCallback(async (turnData: PromptTurnObject): Promise<boolean> => {
    emitter.emit(promptEvent.submitted, { turnData });

    const middlewareResult = await runMiddleware(
      ModMiddlewareHook.PROMPT_TURN_FINALIZE,
      { turnData }
    );

    if (middlewareResult === false) {
      console.log("Prompt submission cancelled by middleware.");
      return false;
    }

    const finalTurnData =
      middlewareResult && typeof middlewareResult === "object"
        ? (middlewareResult as { turnData: PromptTurnObject }).turnData
        : turnData;

    await onSubmit(finalTurnData);
    return true;
  }, [onSubmit]);

  const addTurnToQueue = useCallback((turnData: PromptTurnObject) => {
    const queueItem: PromptQueueItem = {
      id: nanoid(),
      turnData,
      createdAt: Date.now(),
    };
    setQueueItems((items) => [...items, queueItem]);
    toast.success("Added to prompt queue");
  }, []);

  const clearComposer = useCallback(() => {
    clearAttachedFiles();
    promptControls.forEach((control) => {
      if (control.clearOnSubmit) {
        control.clearOnSubmit();
      }
    });
    inputAreaRef.current?.clearValue();
    setHasInputValue(false);
  }, [clearAttachedFiles, inputAreaRef, promptControls]);

  const handleQueueCurrentPrompt = useCallback(async () => {
    const valueFromRef = inputAreaRef?.current?.getValue() ?? "";
    const trimmedValue = valueFromRef.trim();
    const currentAttachedFiles = useInputStore.getState().attachedFilesMetadata;

    if (!trimmedValue && currentAttachedFiles.length === 0) {
      return;
    }

    if (!currentModelIdFromPromptStore) {
      toast.error("Please select a model before sending a message");
      return;
    }

    try {
      const turnData = await createTurnData(trimmedValue, currentAttachedFiles);
      addTurnToQueue(turnData);
      clearComposer();
    } catch (error) {
      console.error("Error queueing prompt:", error);
      toast.error(
        `Failed to queue message: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }, [
    addTurnToQueue,
    clearComposer,
    createTurnData,
    currentModelIdFromPromptStore,
    inputAreaRef,
  ]);

  const handleSubmit = useCallback(async (overrideContent?: string) => {
    const valueFromRef = inputAreaRef?.current?.getValue() ?? "";
    const trimmedValue = overrideContent !== undefined ? overrideContent.trim() : valueFromRef.trim();
    const currentAttachedFiles = useInputStore.getState().attachedFilesMetadata;

    if (!trimmedValue && currentAttachedFiles.length === 0) {
      return;
    }

    if (!currentModelIdFromPromptStore) {
      toast.error("Please select a model before sending a message");
      return;
    }

    if (isStreaming || isSubmitting) {
      try {
        const turnData = await createTurnData(trimmedValue, currentAttachedFiles);
        addTurnToQueue(turnData);
        if (overrideContent === undefined) {
          clearComposer();
        }
      } catch (error) {
        console.error("Error queueing prompt:", error);
        toast.error(
          `Failed to queue message: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const turnData = await createTurnData(trimmedValue, currentAttachedFiles);
      const didSubmit = await submitTurnData(turnData);
      if (didSubmit && overrideContent === undefined) {
        clearComposer();
      }
    } catch (error) {
      console.error("Error during prompt submission:", error);
      toast.error(
        `Failed to send message: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    addTurnToQueue,
    clearComposer,
    createTurnData,
    inputAreaRef,
    isStreaming,
    isSubmitting,
    submitTurnData,
    currentModelIdFromPromptStore,
  ]);

  const moveQueueItem = useCallback((id: string, direction: -1 | 1) => {
    setQueueItems((items) => {
      const index = items.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= items.length) {
        return items;
      }
      const nextItems = [...items];
      const [item] = nextItems.splice(index, 1);
      nextItems.splice(nextIndex, 0, item);
      return nextItems;
    });
  }, []);

  const reorderQueueItem = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setQueueItems((items) => {
      const sourceIndex = items.findIndex((item) => item.id === sourceId);
      const targetIndex = items.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return items;

      const nextItems = [...items];
      const [item] = nextItems.splice(sourceIndex, 1);
      nextItems.splice(targetIndex, 0, item);
      return nextItems;
    });
  }, []);

  const removeQueueItem = useCallback((id: string) => {
    setQueueItems((items) => items.filter((item) => item.id !== id));
  }, []);

  const restoreQueuedItemToComposer = useCallback((item: PromptQueueItem) => {
    inputAreaRef.current?.setValue(item.turnData.content);
    const attachedFiles = item.turnData.metadata?.attachedFiles;
    if (Array.isArray(attachedFiles)) {
      attachedFiles.forEach((file) => {
        const fileData = { ...(file as AttachedFileMetadata) } as Partial<AttachedFileMetadata>;
        delete fileData.id;
        useInputStore.getState().addAttachedFile(
          fileData as Omit<AttachedFileMetadata, "id">
        );
      });
    }
    removeQueueItem(item.id);
  }, [inputAreaRef, removeQueueItem]);

  const sendQueuedItem = useCallback(async (id: string) => {
    if (isStreaming || isSubmitting) return;

    const item = queueItems.find((queueItem) => queueItem.id === id);
    if (!item) return;

    setIsSubmitting(true);
    try {
      const didSubmit = await submitTurnData(item.turnData);
      if (didSubmit) {
        removeQueueItem(id);
      }
    } catch (error) {
      console.error("Error sending queued prompt:", error);
      toast.error(
        `Failed to send queued message: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [isStreaming, isSubmitting, queueItems, removeQueueItem, submitTurnData]);

  useEffect(() => {
    if (!autoRunQueue || isStreaming || isSubmitting || queueItems.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      void sendQueuedItem(queueItems[0].id);
    }, 150);

    return () => window.clearTimeout(timer);
  }, [autoRunQueue, isStreaming, isSubmitting, queueItems, sendQueuedItem]);

  useEffect(() => {
    if (selectedItemType === "conversation" && selectedItemId) {
      requestAnimationFrame(() => {
        inputAreaRef.current?.focus();
      });
    }
  }, [selectedItemId, selectedItemType, inputAreaRef]);

  useEffect(() => {
    const handleFocusRequest = () => {
      requestAnimationFrame(() => {
        inputAreaRef.current?.focus();
      });
    };

    const handleSetInputTextRequest = (payload: { text: string }) => {
      if (inputAreaRef.current) {
        inputAreaRef.current.setValue(payload.text);
        setHasInputValue(payload.text.trim().length > 0);
      }
    };

    const handleSubmitRequest = async (payload: { turnData: PromptTurnObject }) => {
      const currentInteractionState = useInteractionStore.getState();
      if (currentInteractionState.status === "streaming" || isSubmitting) return;

      await handleSubmit(payload.turnData.content);
    };

    emitter.on(promptEvent.focusInputRequest, handleFocusRequest);
    emitter.on(promptEvent.setInputTextRequest, handleSetInputTextRequest);
    emitter.on(promptEvent.submitPromptRequest, handleSubmitRequest);

    return () => {
      emitter.off(promptEvent.focusInputRequest, handleFocusRequest);
      emitter.off(promptEvent.setInputTextRequest, handleSetInputTextRequest);
      emitter.off(promptEvent.submitPromptRequest, handleSubmitRequest);
    };
  }, [handleSubmit, inputAreaRef, isSubmitting]);

  const handleInputValueChange = useCallback((value: string) => {
    setHasInputValue(value.trim().length > 0);
  }, []);

  const translatedPlaceholder = t('sendMessagePlaceholder');
  const canUseComposer =
    (hasInputValue || attachedFilesMetadata.length > 0) &&
    !!currentModelIdFromPromptStore &&
    !isSubmitting;

  return (
    <div className={cn("p-2 md:p-4 space-y-2 md:space-y-3", className)}>
      {panelControls.length > 0 && (
        <PromptControlWrapper
          controls={panelControls}
          area="panel"
          className="flex flex-wrap gap-1 md:gap-2 items-start mb-1 md:mb-2"
        />
      )}
      <div className="rounded-md border border-border/70 bg-card/80 px-2 py-1.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PromptControlWrapper
            controls={triggerControls}
            area="trigger"
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
          />
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => void handleQueueCurrentPrompt()}
              disabled={!canUseComposer}
              className="h-8 w-8 flex-shrink-0"
              aria-label="Add prompt to queue"
              title="Add prompt to queue"
            >
              <ListPlusIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              onClick={() => handleSubmit(undefined)}
              disabled={
                isSubmitting ||
                (!hasInputValue && attachedFilesMetadata.length === 0) ||
                !currentModelIdFromPromptStore
              }
              className="h-8 w-8 flex-shrink-0"
              aria-label={t('sendMessage')}
              title={t('sendMessage')}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizonalIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
      {queueItems.length > 0 && (
        <div className="rounded-md border border-border bg-card/70 p-2 shadow-xs">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <ListPlusIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">
                Queue ({queueItems.length})
              </span>
              {autoRunQueue && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  auto
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setAutoRunQueue((value) => !value)}
                aria-label={autoRunQueue ? "Pause prompt queue" : "Resume prompt queue"}
              >
                {autoRunQueue ? (
                  <PauseIcon className="h-3.5 w-3.5" />
                ) : (
                  <PlayIcon className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => void sendQueuedItem(queueItems[0].id)}
                disabled={isStreaming || isSubmitting}
                aria-label="Send next queued prompt"
              >
                <SendHorizonalIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
            {queueItems.map((item, index) => {
              const attachmentCount = Array.isArray(item.turnData.metadata?.attachedFiles)
                ? item.turnData.metadata.attachedFiles.length
                : 0;
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDraggingQueueItemId(item.id)}
                  onDragEnd={() => setDraggingQueueItemId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggingQueueItemId) {
                      reorderQueueItem(draggingQueueItemId, item.id);
                    }
                    setDraggingQueueItemId(null);
                  }}
                  className={cn(
                    "flex items-center gap-1 rounded border border-border/70 bg-background/70 px-1.5 py-1",
                    draggingQueueItemId === item.id && "opacity-50"
                  )}
                >
                  <GripVerticalIcon className="h-4 w-4 cursor-grab text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs">
                      {item.turnData.content || "(attachments only)"}
                    </div>
                    {attachmentCount > 0 && (
                      <div className="text-[10px] text-muted-foreground">
                        {attachmentCount} file{attachmentCount === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => moveQueueItem(item.id, -1)}
                    disabled={index === 0}
                    aria-label="Move queued prompt up"
                  >
                    <ArrowUpIcon className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => moveQueueItem(item.id, 1)}
                    disabled={index === queueItems.length - 1}
                    aria-label="Move queued prompt down"
                  >
                    <ArrowDownIcon className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => restoreQueuedItemToComposer(item)}
                    aria-label="Move queued prompt to composer"
                  >
                    <PencilIcon className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => void sendQueuedItem(item.id)}
                    disabled={isStreaming || isSubmitting}
                    aria-label="Send queued prompt now"
                  >
                    <SendHorizonalIcon className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => removeQueueItem(item.id)}
                    aria-label="Remove queued prompt"
                  >
                    <XIcon className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex">
        <InputAreaRenderer
          ref={inputAreaRef}
          onSubmit={handleSubmit}
          placeholder={placeholder || translatedPlaceholder}
          onValueChange={handleInputValueChange}
          disabled={isSubmitting}
          className="w-full flex-grow"
        />
      </div>
    </div>
  );
};
