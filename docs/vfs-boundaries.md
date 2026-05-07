# VFS Boundary Notes

This is the short map for VFS ownership after the AC-005 helper extraction.

## Owns
- VFS types and events in [`src/types/llmchef/vfs.ts`](../src/types/llmchef/vfs.ts) and [`src/types/llmchef/events/vfs.events.ts`](../src/types/llmchef/events/vfs.events.ts)
- In-memory VFS state and event wiring in [`src/store/vfs.store.ts`](../src/store/vfs.store.ts)
- Core filesystem operations in [`src/lib/llmchef/vfs-operations.ts`](../src/lib/llmchef/vfs-operations.ts)
- Git/VFS runtime helpers in [`src/lib/llmchef/vfs-git-runtime.ts`](../src/lib/llmchef/vfs-git-runtime.ts), [`src/lib/llmchef/vfs-git-browser-runtime.ts`](../src/lib/llmchef/vfs-git-browser-runtime.ts), [`src/lib/llmchef/vfs-git-operation-options.ts`](../src/lib/llmchef/vfs-git-operation-options.ts), and [`src/lib/llmchef/vfs-git-pull-branch.ts`](../src/lib/llmchef/vfs-git-pull-branch.ts)

## Does not own
- Generic project/conversation selection rules
- Persistence of non-file app state
- Control-module presentation details outside VFS-specific UI consumers

## Working split
1. `vfs.store.ts` owns selected file state, active VFS key, loading flags, optimistic UI refreshes, and event registration.
2. `vfs-operations.ts` owns plain file and directory operations against ZenFS.
3. The `vfs-git-*` helpers own browser git runtime setup, option building, and pull/branch preparation.
4. UI modules and initialization code should ask the VFS store to change context instead of reimplementing filesystem behavior directly.

## Change guide
- If code mutates ZenFS paths or file bytes, start in `vfs-operations.ts`.
- If code only coordinates selection, loading, or event-driven refresh, keep it in `vfs.store.ts`.
- If a change is git-specific, prefer the extracted `vfs-git-*` helpers over adding more branches to `vfs-git-operations.ts`.
- Keep project/conversation-to-path derivation outside core VFS helpers when possible.

## Good seams to reuse
- `initializeVFS()` and `setVfsKey()` on the store for context changes
- `fetchNodes()` / `setCurrentPath()` for tree refresh and folder switching
- `vfs-git-operation-options.ts` for shared auth/settings-derived git options
