import React from "react";
import { type ControlModule } from "@/types/llmchef/control";
import { type LLMChefModApi } from "@/types/llmchef/modding";
import { workflowEvent } from "@/types/llmchef/events/workflow.events";
import { createLazyControlComponent } from "@/controls/components/LazyControlComponent";

import type { WorkflowTemplate } from "@/types/llmchef/workflow";
import { useInteractionStore } from "@/store/interaction.store";
import { promptTemplateEvent } from "@/types/llmchef/events/prompt-template.events";
import type { PromptTemplate } from "@/types/llmchef/prompt-template";
import { useProviderStore } from "@/store/provider.store";
import type { AiModelConfig, ModelListItem } from "@/types/llmchef/provider";
import { providerEvent } from "@/types/llmchef/events/provider.events";
import { usePromptTemplateStore } from "@/store/prompt-template.store";
import { PersistenceService } from "@/services/persistence.service";
import { toast } from "sonner";
import { emitter } from "@/lib/llmchef/event-emitter";
import { validateJsonQuery } from "@/lib/llmchef/workflow-query-utils";
import { buildWorkflowPreviewContext } from "@/lib/llmchef/workflow-preview-context";
import { useControlRegistryStore } from "@/store/control.store";
import type { TriggerNamespace, TriggerExecutionContext } from "@/types/llmchef/text-triggers";

const WorkflowBuilder = createLazyControlComponent<any>(
  () =>
    import("@/controls/components/workflow/WorkflowBuilder").then((module) => ({
      default: module.WorkflowBuilder,
    })),
  "Loading workflows...",
);

export class WorkflowControlModule implements ControlModule {
  readonly id = "core-workflow-control";
  private modApi: LLMChefModApi | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private notifyComponentUpdate: (() => void) | null = null;

  // Provider state
  public globallyEnabledModels: ModelListItem[] = [];
  public isLoadingProviders = false;
  public allTemplates: PromptTemplate[] = [];
  public workflows: WorkflowTemplate[] = [];

  async initialize(modApi: LLMChefModApi): Promise<void> {
    this.modApi = modApi;

    // Get initial provider state
    const providerState = useProviderStore.getState();
    this.globallyEnabledModels = providerState.getGloballyEnabledModelDefinitions();
    this.isLoadingProviders = providerState.isLoading;
    this.allTemplates = usePromptTemplateStore.getState().promptTemplates;

    // Subscribe to provider events to track enabled models
    const unsubGloballyEnabledModelsUpdated = modApi.on(
      providerEvent.globallyEnabledModelsUpdated,
      (payload: { models: ModelListItem[] }) => {
        this.globallyEnabledModels = payload.models;
        this.notifyComponentUpdate?.();
      }
    );

    const unsubInitialDataLoaded = modApi.on(
      providerEvent.initialDataLoaded,
      (data: any) => {
        if (data.globallyEnabledModels) {
          this.globallyEnabledModels = data.globallyEnabledModels;
          this.isLoadingProviders = false;
          this.notifyComponentUpdate?.();
        }
      }
    );

    const unsubTemplatesChanged = modApi.on(
      promptTemplateEvent.promptTemplatesChanged,
      (payload) => {
        if (payload?.promptTemplates) {
          this.allTemplates = payload.promptTemplates;
          this.notifyComponentUpdate?.();
        }
      }
    );

    // Subscribe to workflow update events
    const unsubWorkflowUpdateRequest = modApi.on(
      workflowEvent.updateWorkflowRequest,
      async (payload) => {
        await this.updateWorkflow(payload.id, payload.updates);
      }
    );

    this.eventUnsubscribers.push(
      unsubGloballyEnabledModelsUpdated,
      unsubInitialDataLoaded,
      unsubTemplatesChanged,
      unsubWorkflowUpdateRequest
    );

    // Request templates on initialization
    modApi.emit(promptTemplateEvent.loadPromptTemplatesRequest, {});
    
    // Load workflows
    await this.loadWorkflows();
  }

  getTextTriggerNamespaces(): TriggerNamespace[] {
    return [{
      id: 'workflow',
      name: 'Workflow',
      methods: {
        run: {
          id: 'run',
          name: 'Run Workflow',
          description: 'Execute a specific workflow',
          argSchema: {
            minArgs: 1,
            maxArgs: 1,
            argTypes: ['string' as const]
          },
          handler: this.handleWorkflowRun
        }
      },
      moduleId: this.id
    }];
  }

  private handleWorkflowRun = async (args: string[], context: TriggerExecutionContext) => {
    const workflowId = args[0];
    const workflow = this.workflows.find(w => w.id === workflowId || w.name === workflowId);
    
    if (workflow) {
      // Start the workflow with the current prompt content
      this.startWorkflow(workflow, context.turnData.content);
      // Clear the content since the workflow will handle the prompt
      context.turnData.content = '';
    }
  };

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];

    // Unregister text trigger namespaces
    const triggerNamespaces = this.getTextTriggerNamespaces();
    triggerNamespaces.forEach(namespace => {
      useControlRegistryStore.getState().unregisterTextTriggerNamespace(namespace.id);
    });

    this.notifyComponentUpdate = null;
    this.modApi = null;
  }

  setNotifyCallback(callback: (() => void) | null): void {
    this.notifyComponentUpdate = callback;
  }

  // Public API for the component
  getPromptTemplates(): PromptTemplate[] {
    return this.allTemplates.filter(t => (t.type || 'prompt') === 'prompt');
  }

  getAgentTasks(): (PromptTemplate & { prefixedName: string })[] {
    const agents = this.allTemplates.filter(t => t.type === 'agent');
    const agentNameById = new Map(agents.map(a => [a.id, a.name]));
    
    return this.allTemplates
      .filter(t => t.type === 'task' && t.parentId)
      .map(t => ({
        ...t,
        prefixedName: `${agentNameById.get(t.parentId!) || 'Unknown Agent'}: ${t.name}`
      }));
  }

  getAllTemplates(): PromptTemplate[] {
    return this.allTemplates;
  }

  getModels(): ModelListItem[] {
    return this.globallyEnabledModels;
  }

  getGlobalModel(): AiModelConfig | undefined {
    return useProviderStore.getState().getSelectedModel();
  }

  // Template compilation method for preview functionality
  async compileTemplate(templateId: string, formData: Record<string, any> = {}): Promise<{ content: string; selectedTools?: string[]; selectedRules?: string[]; }> {
    const { compilePromptTemplate } = usePromptTemplateStore.getState();
    return await compilePromptTemplate(templateId, formData);
  }

  async loadWorkflows(): Promise<void> {
    try {
      this.workflows = await PersistenceService.loadWorkflows();
      this.notifyComponentUpdate?.();
    } catch (error) {
      console.error('[WorkflowControlModule] Failed to load workflows:', error);
    }
  }

  getWorkflows(): WorkflowTemplate[] {
    return this.workflows;
  }

  async refreshWorkflows(): Promise<void> {
    await this.loadWorkflows();
  }

  startWorkflow(template: WorkflowTemplate, initialPrompt: string): void {
    const conversationId = useInteractionStore.getState().currentConversationId;
    if (!conversationId) {
      toast.error("Cannot start workflow: No active conversation selected.");
      console.error("[WorkflowControlModule] startWorkflow called without an active conversation.");
      return;
    }
    
    // Start the workflow immediately with the initial prompt
    this.modApi?.emit(workflowEvent.startRequest, { template, initialPrompt, conversationId });
    
    toast.success(`Workflow "${template.name}" started with ${template.steps.length} steps!`);
  }

  // Validate transform queries against a sample context
  validateTransformQuery(query: string, workflow?: WorkflowTemplate, stepIndex?: number): { isValid: boolean; error?: string; result?: any } {
    const sampleContext = this._buildRealisticSampleContext(workflow, stepIndex);
    return validateJsonQuery(query, sampleContext, { allowStaticValues: false });
  }

  // Build realistic sample context based on actual workflow and form data
  private _buildRealisticSampleContext(workflow?: WorkflowTemplate, stepIndex?: number): Record<string, unknown> {
    return buildWorkflowPreviewContext(workflow, stepIndex, this.allTemplates);
  }

  register(modApi: LLMChefModApi): void {
    this.modApi = modApi;

    // Register text trigger namespaces
    const triggerNamespaces = this.getTextTriggerNamespaces();
    triggerNamespaces.forEach(namespace => {
      useControlRegistryStore.getState().registerTextTriggerNamespace(namespace);
    });

    modApi.registerPromptControl({
      id: this.id,
      status: () => "ready",
      triggerRenderer: () => React.createElement(WorkflowBuilder, { module: this }),
    });
  }

  // Add updateWorkflow method for event-driven updates
  async updateWorkflow(id: string, updates: Partial<WorkflowTemplate>): Promise<void> {
    try {
      // Find the workflow to update
      const workflowIndex = this.workflows.findIndex(w => w.id === id);
      if (workflowIndex === -1) {
        console.error(`[WorkflowControlModule] Workflow with id ${id} not found`);
        return;
      }

      // Update the workflow
      const updatedWorkflow = {
        ...this.workflows[workflowIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Save to persistence
      await PersistenceService.saveWorkflow(updatedWorkflow);
      
      // Update local state
      this.workflows[workflowIndex] = updatedWorkflow;
      this.notifyComponentUpdate?.();

      // Emit update event
      emitter.emit(workflowEvent.workflowUpdated, { id, updates });
    } catch (error) {
      console.error('[WorkflowControlModule] Failed to update workflow:', error);
      toast.error('Failed to update workflow');
    }
  }

  // Get shortcut workflows for hover display
  getShortcutWorkflows(): WorkflowTemplate[] {
    return this.workflows.filter(workflow => workflow.isShortcut === true);
  }

  // Check if any interactions are currently streaming
  getIsStreaming(): boolean {
    return useInteractionStore.getState().streamingInteractionIds.length > 0;
  }
}
