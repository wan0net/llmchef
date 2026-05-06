# LLMChef Kanban Roadmap

Status snapshot after lanes 1 and 2:
- Done: Release foundation
- Done: Quality hardening
- Done: Backlog ticketization pass
- Done: Architecture fitness gate for oversized source modules
- Active next: Continue architecture cleanup with AC-006

## Board

### Done
- KF-001: Harden GitHub Pages release pipeline and release-aware CI validation (GH: #1)
- KF-002: Reconcile versioning, artifact naming, and release verification (GH: #2)
- KF-003: Harden import/export schema validation and rollback-oriented behavior (GH: #3)
- AC-001: Extract MCP domain types and persistence boundary from `store/mcp.store.ts` (GH: #4)
- AC-002: Split shared workflow query, JSONPath, and mapping logic out of `services/workflow.service.ts` (GH: #5)
- AC-003: Reuse shared workflow query validation in `WorkflowControlModule.ts` (GH: #6)
- AC-004: Extract workflow preview/sample context generation into `src/lib/llmchef/workflow-preview-context.ts` (GH: #7)
- AC-005: Untangle VFS runtime helpers from store/module glue (GH: #8)
  - Landed helpers: `vfs-git-runtime.ts`, `vfs-git-browser-runtime.ts`, `vfs-git-operation-options.ts`, and `vfs-git-pull-branch.ts`
  - Result: `vfs-git-operations.ts` now delegates auth/settings/browser wiring, shared remote option building, and pull branch preparation into focused testable seams
- BL-001: Add architecture fitness checks for oversized files/modules (GH: #11)
  - Landed: `scripts/check-architecture-fitness.mjs` plus `scripts/architecture-fitness.config.json`
  - Result: CI now gates oversized source modules with a 900-line default cap and explicit per-file allowlist ceilings for existing large modules

### Ready next (priority order)
1. AC-006 - Introduce typed persistence adapters for app settings slices (GH: #9)
   - Why: `store/settings.store.ts` is very large and repeats per-key persistence/event code.
   - Scope: extract grouped settings adapters for sync, auto-title, tool selection, and UI theming.
   - Success check: reducer/store file shrinks materially without behavior change

2. AC-007 - Reduce conversation store/service overlap (GH: #10)
   - Why: `store/conversation.store.ts` and conversation services are both large, increasing coordination complexity.
   - Scope: clarify command/query boundaries and move derived-data helpers out of the store.
   - Success check: store becomes thinner and side effects centralize in services

### Backlog
- BL-002 - Add codeowners/review routing by domain lane (GH: #12)
- BL-003 - Add roadmap-to-ticket automation for future review passes (GH: #13)
- BL-004 - Add thin domain docs for MCP, workflow, persistence, and VFS boundaries (GH: #14)
- BL-005 - Review remaining control modules for event/persistence leakage (GH: #15)
- BL-006 - Sync Kanban tickets with GitHub Issues once repository issues are enabled (GH: #16)

## GitHub sync note
- Repo rule: GitHub Issues is the durable ticket source of truth for this project; Kanban/docs mirror issue state instead of becoming a second tracker.
- Current state: GitHub Issues are now enabled on `wan0net/llmchef`, and the roadmap has been bootstrapped into issue-backed tickets.
- Working model: keep one issue per roadmap ticket, keep lane order in `docs/kanban-roadmap.md`, and reference issue numbers instead of duplicating full ticket bodies.
- Low-friction mapping: use labels like `lane:architecture`, `lane:backlog`, and `priority:P1`, and let Hermes update the doc when creating, reordering, or closing issues.

## Recommended execution order
1. Execute AC-006 as the next bounded architecture cleanup slice
2. Keep `docs/kanban-roadmap.md` aligned with GitHub issue numbers and state changes
3. Consider automating roadmap-to-issue reconciliation under BL-003 once the manual flow feels stable

## Notes
- This board intentionally keeps the roadmap ticket-driven instead of trying to land one mega-refactor.
- The architecture lane is being executed as bounded slices with verification after each ticket to keep refactors reviewable and low-risk.
