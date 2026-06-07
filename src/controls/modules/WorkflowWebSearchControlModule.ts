import React from "react";
import { nanoid } from "nanoid";
import { type ControlModule } from "@/types/llmchef/control";
import { type LLMChefModApi } from "@/types/llmchef/modding";
import { emitter } from "@/lib/llmchef/event-emitter";
import { interactionEvent } from "@/types/llmchef/events/interaction.events";
import { workflowEvent } from "@/types/llmchef/events/workflow.events";
import { webSearchEvent } from "@/types/llmchef/events/websearch.events";
import { WorkflowWebSearchControlTrigger } from "../components/workflow-websearch/WorkflowWebSearchControlTrigger";
import { useInteractionStore } from "@/store/interaction.store";
import {
  createDefaultWorkflowWebSearchConfig,
  createDefaultWorkflowWebSearchDeepConfig,
  WorkflowWebSearchPersistenceService,
} from "@/services/workflow-websearch-persistence.service";
import type { 
  WebSearchConfig, 
  DeepSearchConfig, 
  SearchOperation 
} from "@/types/llmchef/websearch";

export class WorkflowWebSearchControlModule implements ControlModule {
  readonly id = "workflow-web-search";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private modApiRef: LLMChefModApi | null = null;

  // Configuration state
  private searchConfig: WebSearchConfig = createDefaultWorkflowWebSearchConfig();

  private deepSearchConfig: DeepSearchConfig =
    createDefaultWorkflowWebSearchDeepConfig();

  // UI state
  private isEnabled = false;
  private selectedWorkflow = "basic-websearch";
  private isStreaming = false;

  // Runtime state
  private activeSearches = new Map<string, SearchOperation>();
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LLMChefModApi): Promise<void> {
    this.modApiRef = modApi;
    this.isStreaming = useInteractionStore.getState().status === "streaming";
    
    await this.loadConfiguration();
    
    // Register websearch prompt templates and workflows
    await this.registerPromptTemplates();
    await this.registerWorkflowTemplates();
    
    // Subscribe to relevant events
    const unsubStatus = modApi.on(interactionEvent.statusChanged, (payload) => {
      if (typeof payload === "object" && payload && "status" in payload) {
        if (this.isStreaming !== (payload.status === "streaming")) {
          this.isStreaming = payload.status === "streaming";
          this.notifyComponentUpdate?.();
        }
      }
    });

    const unsubWorkflowCompleted = modApi.on(workflowEvent.completed, (payload) => {
      if (typeof payload === "object" && payload && "runId" in payload) {
        // Check if this was a websearch workflow
        const search = Array.from(this.activeSearches.values()).find(s => s.id === payload.runId);
        if (search) {
          this.handleSearchCompleted(search.id, payload);
        }
      }
    });

    const unsubWorkflowError = modApi.on(workflowEvent.error, (payload) => {
      if (typeof payload === "object" && payload && "runId" in payload) {
        const search = Array.from(this.activeSearches.values()).find(s => s.id === payload.runId);
        if (search) {
          this.handleSearchFailed(search.id, payload.error || "Workflow failed");
        }
      }
    });

    this.eventUnsubscribers.push(unsubStatus, unsubWorkflowCompleted, unsubWorkflowError);
    this.notifyComponentUpdate?.();
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const persistedSettings =
        await WorkflowWebSearchPersistenceService.loadSettings();
      this.searchConfig = persistedSettings.searchConfig;
      this.deepSearchConfig = persistedSettings.deepSearchConfig;
      this.selectedWorkflow = persistedSettings.selectedWorkflow;
    } catch (error) {
      console.warn('Failed to load websearch configuration:', error);
    }
  }

  private persistConfiguration(): void {
    void WorkflowWebSearchPersistenceService.saveSettings({
      searchConfig: this.searchConfig,
      deepSearchConfig: this.deepSearchConfig,
      selectedWorkflow: this.selectedWorkflow,
    }).catch((error) => {
      console.warn("Failed to save websearch configuration:", error);
    });
  }

  private async registerPromptTemplates(): Promise<void> {
    try {
      await WorkflowWebSearchPersistenceService.ensurePromptTemplatesRegistered();
    } catch (error) {
      console.warn("[", this.id, "] Failed to register prompt templates:", error);
    }
  }

  private async registerWorkflowTemplates(): Promise<void> {
    try {
      await WorkflowWebSearchPersistenceService.ensureWorkflowTemplatesRegistered();
    } catch (error) {
      console.warn("[", this.id, "] Failed to register workflow templates:", error);
    }
  }

  private handleSearchCompleted(searchId: string, payload: any): void {
    const search = this.activeSearches.get(searchId);
    if (search) {
      search.status = 'completed';
      search.endTime = new Date().toISOString();
      
      emitter.emit(webSearchEvent.searchCompleted, {
        searchId,
        operation: search,
        results: payload.results || [],
        totalTime: new Date(search.endTime).getTime() - new Date(search.startTime).getTime()
      });
      
      this.activeSearches.delete(searchId);
      this.notifyComponentUpdate?.();
    }
  }

  private handleSearchFailed(searchId: string, error: string): void {
    const search = this.activeSearches.get(searchId);
    if (search) {
      search.status = 'failed';
      search.error = error;
      search.endTime = new Date().toISOString();
      
      emitter.emit(webSearchEvent.searchFailed, {
        searchId,
        operation: search,
        error
      });
      
      this.activeSearches.delete(searchId);
      this.notifyComponentUpdate?.();
    }
  }

  // Public API methods
  public getIsEnabled = (): boolean => this.isEnabled;
  public getIsStreaming = (): boolean => this.isStreaming;

  public getSelectedWorkflow = (): string => this.selectedWorkflow;
  public getSearchConfig = (): WebSearchConfig => ({ ...this.searchConfig });
  public getDeepSearchConfig = (): DeepSearchConfig => ({ ...this.deepSearchConfig });
  public getActiveSearches = (): SearchOperation[] => Array.from(this.activeSearches.values());

  public toggleEnabled = (): void => {
    this.isEnabled = !this.isEnabled;
    this.notifyComponentUpdate?.();
  };

  public setEnabled = (enabled: boolean): void => {
    this.isEnabled = enabled;
    this.notifyComponentUpdate?.();
  };



  public updateSearchConfig = (config: Partial<WebSearchConfig>): void => {
    const oldConfig = { ...this.searchConfig };
    this.searchConfig = { ...this.searchConfig, ...config };
    this.persistConfiguration();
    
    emitter.emit(webSearchEvent.configUpdated, {
      oldConfig,
      newConfig: this.searchConfig,
      changedFields: Object.keys(config)
    });
    
    this.notifyComponentUpdate?.();
  };

  public updateDeepSearchConfig = (config: Partial<DeepSearchConfig>): void => {
    this.deepSearchConfig = { ...this.deepSearchConfig, ...config };
    this.persistConfiguration();
    this.notifyComponentUpdate?.();
  };

  public selectWorkflow = (workflowId: string): void => {
    this.selectedWorkflow = workflowId;
    this.persistConfiguration();
    
    emitter.emit(webSearchEvent.workflowSelected, {
      workflowId,
      workflowName: this.getWorkflowName(workflowId)
    });
    
    this.notifyComponentUpdate?.();
  };

  public startSearch = async (query: string): Promise<void> => {
    if (!this.modApiRef) {
      throw new Error('Module not initialized');
    }

    const searchId = nanoid();
    const conversationId = useInteractionStore.getState().currentConversationId || nanoid();
    
    const searchOperation: SearchOperation = {
      id: searchId,
      conversationId,
      originalQuery: query,
      config: { ...this.searchConfig },
      deepSearchConfig: this.deepSearchConfig.enabled ? { ...this.deepSearchConfig } : undefined,
      steps: [],
      status: 'initializing',
      startTime: new Date().toISOString(),
      totalResults: 0,
      selectedWorkflow: this.selectedWorkflow
    };

    this.activeSearches.set(searchId, searchOperation);
    
    emitter.emit(webSearchEvent.searchStarted, {
      searchId,
      operation: searchOperation
    });

    try {
      const workflowTemplate =
        await WorkflowWebSearchPersistenceService.loadWorkflowTemplateById(
          this.selectedWorkflow,
        );
      
      if (!workflowTemplate) {
        throw new Error(`Workflow template not found: ${this.selectedWorkflow}`);
      }

      // Update search operation status
      searchOperation.status = 'running';
      
      // Trigger the workflow with the search query
      this.modApiRef.emit(workflowEvent.startRequest, {
        template: workflowTemplate,
        initialPrompt: query,
        conversationId
      });

      this.notifyComponentUpdate?.();
    } catch (error) {
      this.handleSearchFailed(searchId, error instanceof Error ? error.message : 'Unknown error');
    }
  };

  public cancelSearch = (searchId: string): void => {
    const search = this.activeSearches.get(searchId);
    if (search) {
      search.status = 'cancelled';
      search.endTime = new Date().toISOString();
      
      emitter.emit(webSearchEvent.searchCancelled, {
        searchId,
        operation: search
      });
      
      this.activeSearches.delete(searchId);
      this.notifyComponentUpdate?.();
    }
  };

  public setNotifyCallback = (cb: (() => void) | null): void => {
    this.notifyComponentUpdate = cb;
  };

  private getWorkflowName(workflowId: string): string {
    const workflowNames: Record<string, string> = {
      'basic-websearch': 'Basic Web Search',
      'deep-websearch': 'Deep Web Search',
      'research-websearch': 'Research Web Search'
    };
    return workflowNames[workflowId] || workflowId;
  }

  register(modApi: LLMChefModApi): void {
    this.modApiRef = modApi;
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    this.unregisterCallback = modApi.registerPromptControl({
      id: this.id,
      status: () => "ready",
      triggerRenderer: () => React.createElement(WorkflowWebSearchControlTrigger, { module: this }),
      getMetadata: () => this.isEnabled ? {
        workflowWebSearchEnabled: true,
        searchConfig: this.searchConfig,
        selectedWorkflow: this.selectedWorkflow,
        activeSearches: this.activeSearches.size
      } : undefined,
      clearOnSubmit: () => {
        if (!this.searchConfig.persistAcrossSubmissions) {
          this.isEnabled = false;
          this.notifyComponentUpdate?.();
        }
      }
    });
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    
    // Cancel any active searches
    for (const searchId of this.activeSearches.keys()) {
      this.cancelSearch(searchId);
    }
    
    this.notifyComponentUpdate = null;
    this.modApiRef = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
