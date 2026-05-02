# LLMChef Workflow Feature: Development Plan

## 1. Overview & Goals

This document outlines the development plan for a new "Workflow" feature in LLMChef, designed to chain multiple AI prompts, tasks, and other actions into a sequential, automated process.

### High-Level Goals
- **Sequential Task Execution**: Chain multiple prompts, agent tasks, and other actions.
- **Structured Data Passing**: Use the output of one step as the input for the next.
- **Human in the Loop (HITL)**: Allow for steps that pause the workflow for manual user intervention.
- **Architectural Consistency**: Strictly follow LLMChef's established patterns of event-driven orchestration and parent-child interaction relationships.
- **Foundation for Future Features**: This engine will be robust enough to eventually replace the `Race-Combine` feature.

## 2. Architecture

### 2.1. The Workflow Interaction Model
Workflows will be represented in the chat canvas using the existing `Interaction` model:
- **Parent Interaction (`workflow.run`)**: A new `InteractionType` that acts as the main container for the entire workflow.
- **Child Interactions**: Each step in the workflow will be a separate, child `Interaction` (e.g., `message.assistant_regen`), whose `parentId` points to the `workflow.run` interaction. These will appear as tabs.
- **Paused Status**: A new `InteractionStatus` of `PAUSED` will be added to support the HITL feature.

### 2.2. Core Data Structures
- **`WorkflowTemplate`**: The blueprint for a reusable workflow, defining its name, description, and steps.
- **`WorkflowStep`**: Defines a single action within a workflow, including its type (`prompt`, `agent-task`, `human-in-the-loop`), the template it uses, and how it maps input from previous steps.
- **`WorkflowRun`**: Represents a live execution instance of a workflow, tracking its status, current step, and the outputs of completed steps.

### 2.3. Architectural Components
- **`WorkflowControl.tsx`**: The UI for building and launching a workflow.
- **`WorkflowControlModule.ts`**: The `ControlModule` that registers the UI and fires the start event.
- **`useWorkflowStore.ts`**: A Zustand store holding the state of the currently executing `WorkflowRun`.
- **`WorkflowService.ts`**: The stateless orchestrator that listens for events and executes the workflow steps.
- **`workflow.events.ts`**: Defines the event contracts for the workflow lifecycle.

## 3. Implementation Plan

### Phase 1: Foundation & Data Model Integration
- **Task**: Define and integrate the core data structures and events.
- **Files**: `interaction.ts`, `workflow.ts` (new), `events/workflow.events.ts` (new), `modding.ts`.
- **Status**: ✅ **DONE**

### Phase 2: Workflow Store
- **Task**: Create the `useWorkflowStore` to manage the state of the active workflow run.
- **Files**: `store/workflow.store.ts` (new), `services/event-action-coordinator.service.ts`.
- **Status**: ✅ **DONE**

### Phase 3: Workflow Service (Orchestrator)
- **Task**: Implement the core workflow execution logic for starting, pausing, resuming, and completing workflows.
- **Files**: `services/workflow.service.ts` (new), `components/LLMChef/LLMChef.tsx`.
- **Status**: ✅ **DONE**

### Phase 4: Workflow Builder UI & Module
- **Task**: Create the user-facing UI for building and launching workflows.
- **Files**: `controls/modules/WorkflowControlModule.ts` (new), `controls/components/workflow/WorkflowBuilder.tsx` (new), `controls/components/workflow/WorkflowStepCard.tsx` (new), `App.tsx`.
- **Status**: ✅ **DONE**

### Phase 5: Workflow Execution UI
- **Task**: Render the running workflow and the HITL controls in the chat canvas.
- **Files**: `components/LLMChef/canvas/InteractionCard.tsx`, `components/LLMChef/canvas/interaction/WorkflowStatusDisplay.tsx` (new), `components/LLMChef/canvas/interaction/HumanInTheLoopControl.tsx` (new).
- **Status**: ✅ **DONE**

### Phase 6: Structured Output & Data Passing
- **Task**: Implement the logic for passing data between steps by dynamically instructing the AI to provide structured JSON output and parsing it.
- **Files**: `services/workflow.service.ts`.
- **Status**: ✅ **DONE**

### Phase 7: Future Enhancements
- Saving, loading, and sharing of `WorkflowTemplate` objects.
- Conditional logic and branching (`if/else`).
- Looping over lists of data.
- Refactoring the `Race-Combine` feature to use the new workflow engine.
- **Status**: 🔲 **PENDING** 