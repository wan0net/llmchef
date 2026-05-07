# MCP Boundary Notes

This is the short map for where MCP logic belongs after the AC-001 cleanup.

## Owns
- MCP domain types in [`src/types/llmchef/mcp.ts`](../src/types/llmchef/mcp.ts)
- MCP event names in [`src/types/llmchef/events/mcp.events.ts`](../src/types/llmchef/events/mcp.events.ts)
- MCP store orchestration in [`src/store/mcp.store.ts`](../src/store/mcp.store.ts)
- MCP persistence/default-state helpers in [`src/services/mcp-persistence.service.ts`](../src/services/mcp-persistence.service.ts)
- Browser runtime/package import helpers in [`src/lib/llmchef/mcp-js-runtime.ts`](../src/lib/llmchef/mcp-js-runtime.ts) and [`src/lib/llmchef/mcp-package-import.ts`](../src/lib/llmchef/mcp-package-import.ts)

## Does not own
- Generic app settings persistence outside MCP-specific keys
- Provider/model execution logic
- UI control-module registration rules outside MCP-specific controls

## Working split
1. `types/llmchef/mcp.ts` defines the shapes.
2. `mcp-persistence.service.ts` creates defaults, normalizes registry URLs, and reads/writes MCP-specific persisted state.
3. `mcp.store.ts` owns in-memory state, emits MCP events, and calls the persistence helpers.
4. Runtime helpers under `lib/llmchef/` handle package parsing, Worker runtime bootstrapping, and browser-only execution details.

## Change guide
- Add or rename MCP state fields in `types/llmchef/mcp.ts` first.
- Put default-value and serialization logic in `mcp-persistence.service.ts`.
- Keep `mcp.store.ts` focused on store mutations, event emission, and async orchestration.
- Put package/runtime probing behavior in `lib/llmchef/`, not in the store.

## Good seams to reuse
- `createDefaultMcpState()` for new MCP defaults
- `normalizeMcpPackageRegistryUrl()` for registry input cleanup
- `useMcpStore.getRegisteredActionHandlers()` for event wiring into the coordinator
