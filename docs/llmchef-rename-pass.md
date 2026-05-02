# LLMChef Rename Pass

This pass moves the fork to the LLMChef name across the user-facing app, source modules, package metadata, docs, runtime globals, and generated export names.

## Renamed Areas

- `src/components/LLMChef`: main app shell, canvas, chat, prompt, shared UI, file manager, and renderer components.
- `src/lib/llmchef`: local persistence helpers, VFS, provider helpers, prompt utilities, workflow utilities, security helpers, and tests.
- `src/types/llmchef`: shared TypeScript event, control, modding, provider, prompt, project, sync, VFS, and workflow types.
- `src/hooks/llmchef`: reusable app hooks.
- `LLMChefModApi`: public mod API type and all control-module registration call sites.
- `llmchef`: runnable JavaScript and Python block helper object.
- `.llmchef`: config, conversation sync, skill import, and real filesystem sync folders.
- `wan0net/llmchef`: GitHub links, release links, and GitHub Pages URLs.

## Local Storage Notes

Local browser storage now uses LLMChef namespaces (`LLMChefDatabase_Rewrite_v1` and `llmchef_vfs_*`). Project files live as folders inside the shared app VFS, so project views are scoped but the broader VFS can still browse and move files between project folders.

The repo directory on disk may still be named by the local checkout path until the workspace or remote repository is moved.
