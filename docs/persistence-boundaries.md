# Persistence Boundary Notes

This is the short map for what belongs in LLMChef persistence code versus store/service orchestration.

## Owns
- Dexie schema and versioning in [`src/lib/llmchef/db.ts`](../src/lib/llmchef/db.ts)
- Cross-domain IndexedDB CRUD in [`src/services/persistence.service.ts`](../src/services/persistence.service.ts)
- Settings-focused persistence helpers in [`src/services/settings-persistence.service.ts`](../src/services/settings-persistence.service.ts)
- MCP-specific persistence helpers in [`src/services/mcp-persistence.service.ts`](../src/services/mcp-persistence.service.ts)

## Does not own
- Event emission policy
- UI toasts or control-module state
- Derived selection/query logic that belongs in stores or query helpers
- Browser VFS file operations

## Working split
1. `db.ts` defines tables, indexes, and schema upgrades.
2. `persistence.service.ts` is the wide CRUD gateway for conversations, projects, interactions, providers, rules, templates, workflows, marketplace items, and export/import support.
3. Narrow persistence helpers such as `settings-persistence.service.ts` and `mcp-persistence.service.ts` handle domain-specific defaults, key naming, and serialization rules.
4. Stores update optimistic in-memory state first, then call persistence helpers, then emit success/failure events.

## Change guide
- Schema/index changes start in `db.ts`.
- If logic is generic across many app domains, keep it in `PersistenceService`.
- If logic is specific to one settings slice or one domain's defaults, prefer a narrow helper service instead of growing `PersistenceService` further.
- Rollback behavior belongs in the caller that made the optimistic state change, not in Dexie helpers.

## Good seams to reuse
- `ensureDateFields()` for Date normalization when loading records
- `PersistenceService.loadSetting()` / `saveSetting()` for app-state key/value persistence
- settings-slice helpers from AC-006 when a settings action needs typed persistence wiring
