import React from "react";
import { Crea8MemoryControl } from "@/controls/components/crea8-memory/Crea8MemoryControl";
import { createCrea8VfsConnector } from "@/lib/litechat/crea8-vfs-connector";
import { useVfsStore } from "@/store/vfs.store";
import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type {
  Crea8MemoryNoteRef,
  Crea8MemorySearchResult,
} from "@/types/litechat/crea8-memory";

export class Crea8MemoryControlModule implements ControlModule {
  readonly id = "core-crea8-memory";
  private unregisterCallback: (() => void) | null = null;
  private selectedRefs: Crea8MemoryNoteRef[] = [];
  private query = "";
  private results: Crea8MemorySearchResult[] = [];
  private isSearching = false;
  private error: string | null = null;
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(): Promise<void> {}

  public getSelectedRefs = (): Crea8MemoryNoteRef[] => this.selectedRefs;
  public getQuery = (): string => this.query;
  public getResults = (): Crea8MemorySearchResult[] => this.results;
  public getIsSearching = (): boolean => this.isSearching;
  public getError = (): string | null => this.error;

  public setQuery = (query: string): void => {
    this.query = query;
    this.notifyComponentUpdate?.();
  };

  public search = async (queryOverride?: string): Promise<void> => {
    const query = queryOverride ?? this.query;
    this.query = query;
    this.isSearching = true;
    this.error = null;
    this.notifyComponentUpdate?.();

    try {
      const { fs } = useVfsStore.getState();
      if (!fs) {
        this.results = [];
        this.error = "No VFS workspace is available.";
        return;
      }

      const connector = createCrea8VfsConnector({
        rootPath: "/Memory",
        fsInstance: fs,
      });
      this.results = await connector.search({
        text: query.trim(),
        limit: 20,
      });
    } catch (error) {
      console.error(`[${this.id}] Memory search failed:`, error);
      this.results = [];
      this.error =
        error instanceof Error ? error.message : "Failed to search memory.";
    } finally {
      this.isSearching = false;
      this.notifyComponentUpdate?.();
    }
  };

  public toggleRef = (result: Crea8MemorySearchResult): void => {
    const ref = result.note;
    if (this.selectedRefs.some((selectedRef) => selectedRef.id === ref.id)) {
      this.selectedRefs = this.selectedRefs.filter(
        (selectedRef) => selectedRef.id !== ref.id,
      );
    } else {
      this.selectedRefs = [...this.selectedRefs, ref];
    }
    this.notifyComponentUpdate?.();
  };

  public removeRef = (id: string): void => {
    this.selectedRefs = this.selectedRefs.filter((ref) => ref.id !== id);
    this.notifyComponentUpdate?.();
  };

  public clearSelectedRefs = (): void => {
    if (this.selectedRefs.length === 0) return;
    this.selectedRefs = [];
    this.notifyComponentUpdate?.();
  };

  public setNotifyCallback = (cb: (() => void) | null): void => {
    this.notifyComponentUpdate = cb;
  };

  public getStatus = (): "ready" | "loading" | "error" => {
    const { fs, loading, operationLoading } = useVfsStore.getState();
    if (this.isSearching || loading || operationLoading) return "loading";
    if (!fs || this.error) return "error";
    return "ready";
  };

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    this.unregisterCallback = modApi.registerPromptControl({
      id: this.id,
      status: this.getStatus,
      triggerRenderer: () =>
        React.createElement(Crea8MemoryControl, { module: this }),
      getMetadata: () => {
        if (this.selectedRefs.length === 0) return undefined;
        return { crea8MemoryRefs: this.selectedRefs };
      },
      clearOnSubmit: () => {
        this.clearSelectedRefs();
      },
    });
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    this.notifyComponentUpdate = null;
  }
}
