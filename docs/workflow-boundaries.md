# Workflow Boundary Notes

This is the short map for workflow responsibilities after the AC-002 to AC-004 cleanup.

## Owns
- Workflow domain types in [`src/types/llmchef/workflow.ts`](../src/types/llmchef/workflow.ts)
- Workflow events in [`src/types/llmchef/events/workflow.events.ts`](../src/types/llmchef/events/workflow.events.ts)
- Workflow run/template state in [`src/store/workflow.store.ts`](../src/store/workflow.store.ts)
- Workflow orchestration in [`src/services/workflow.service.ts`](../src/services/workflow.service.ts)
- Shared workflow query/validation helpers in [`src/lib/llmchef/workflow-query-utils.ts`](../src/lib/llmchef/workflow-query-utils.ts) and [`src/lib/llmchef/workflow-validation.ts`](../src/lib/llmchef/workflow-validation.ts)
- Flow rendering helpers in [`src/lib/llmchef/workflow-flow-generator.ts`](../src/lib/llmchef/workflow-flow-generator.ts) and preview context helpers in [`src/lib/llmchef/workflow-preview-context.ts`](../src/lib/llmchef/workflow-preview-context.ts)

## Does not own
- Generic interaction persistence
- Prompt-template storage rules outside workflow-specific compilation/orchestration
- Control-module UI rules except where a module explicitly consumes shared workflow helpers

## Working split
1. `workflow.store.ts` holds workflow templates, runs, and UI-facing workflow state.
2. `workflow.service.ts` reacts to workflow events, advances steps, compiles prompts, and coordinates interaction execution.
3. `workflow-query-utils.ts` owns JSONPath/query/mapping helpers so service and UI consumers do not drift.
4. `workflow-preview-context.ts` owns sample/preview context generation instead of keeping that logic in control modules.

## Change guide
- New runtime behavior belongs in `workflow.service.ts` only if it coordinates steps or external side effects.
- New reusable query, mapping, or validation rules belong in `lib/llmchef/workflow-*` helpers.
- Keep control modules as consumers of shared workflow helpers, not parallel implementations.
- If a change only affects store shape and selectors, keep it out of `workflow.service.ts`.

## Good seams to reuse
- `validateJsonQuery()` and `resolveJsonPath()` for query semantics
- `buildWorkflowTransformContext()` for mapping/evaluation inputs
- `WorkflowFlowGenerator` for flow-diagram mutations
