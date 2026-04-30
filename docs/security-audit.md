# Security Audit

Date: 2026-04-30

Scope: wan0 LiteChat fork, especially upcoming workstation features: skills,
repo import, VFS real-folder sync, generated file previews, console UI, and crea8
wiki integration.

## Current Dependency Baseline

Command:

```bash
npm audit --json
```

Result:

- Total vulnerabilities: 36
- High: 14
- Moderate: 15
- Low: 7
- Critical: 0

Notable direct dependencies in the audit:

- `ai <5.0.52`: low severity filetype whitelist bypass.
- `vite 7.0.0 - 7.3.1`: high aggregate severity across dev-server file-read
  and path traversal advisories.
- `vite-plugin-pwa >=0.20.0`: high severity through `workbox-build` /
  `@rollup/plugin-terser` / `serialize-javascript`.
- `vite-plugin-node-polyfills >=0.3.0`: low severity through
  `node-stdlib-browser` and browser crypto polyfills.

Notable transitive findings:

- `serialize-javascript`: high severity RCE/DoS advisories via PWA build stack.
- `rollup`: high severity arbitrary file write/path traversal advisories.
- `undici`: high severity WebSocket/resource exhaustion advisories.
- `tar`: high severity path traversal/hardlink/symlink advisories.
- `devalue`, `flatted`, `picomatch`: high severity parser/path/glob risks.
- `dompurify`: moderate XSS advisories.
- `postcss`, `qs`, `js-yaml`, `brace-expansion`, `bn.js`, `uuid`: moderate
  advisories.

Planned remediation:

- Run conservative semver-compatible audit fixes first.
- Prefer direct package upgrades for `vite`, `ai`, and PWA-related packages.
- Avoid major AI SDK/provider upgrades until provider behavior is covered by
  tests.
- Re-run `npm audit`, targeted tests, and `npm run build` after each upgrade
  slice.

## Dependency Remediation Pass 1

Command:

```bash
npm audit fix
```

Result:

- Total vulnerabilities reduced from 36 to 13.
- High reduced from 14 to 4.
- Moderate reduced from 15 to 3.
- Low reduced from 7 to 6.
- Critical remains 0.
- `ai` was pinned to `^5.0.52`, the minimum patched version from the audit
  advisory that still preserves LiteChat's MCP build compatibility.

Remaining issues:

- `vite-plugin-pwa` chain through `workbox-build`, `@rollup/plugin-terser`,
  and `serialize-javascript`. `npm audit` recommends `vite-plugin-pwa@0.19.8`
  via `--force`, which is a breaking downgrade from the current `1.x` line and
  needs manual review.
- `vite-plugin-node-polyfills` chain through `node-stdlib-browser`,
  `crypto-browserify`, and `elliptic`. `npm audit` recommends
  `vite-plugin-node-polyfills@0.2.0` via `--force`, also a breaking downgrade.
- `mermaid-isomorphic` through `mermaid` and `uuid`. `npm audit` reports no
  available fix.

Decision:

- Do not run `npm audit fix --force` blindly.
- Treat the remaining issues as follow-up upgrade/removal decisions:
  - evaluate disabling or replacing PWA generation
  - evaluate whether node polyfills can be reduced
  - evaluate replacing or isolating Mermaid rendering

## Runtime Attack Surface

### Mods

Files:

- `src/modding/loader.ts`
- `src/store/mod.store.ts`
- `src/controls/components/mod-settings/SettingsMods.tsx`

Risk:

- Mods are loaded with `new Function("modApi", scriptContent)`.
- A malicious imported mod can act with whatever authority the mod API exposes.

Required guardrails:

- Never auto-enable imported mods.
- Show a capability review before enabling.
- Add manifest permissions for filesystem, network, model calls, settings,
  project access, and UI registration.
- Consider a safer isolated execution mode before accepting third-party mods as
  normal skill contents.

### Runnable JS Blocks

Files:

- `src/components/LiteChat/common/JsRunnableBlockRenderer.tsx`

Risk:

- Supports safe, iframe, and unsafe execution.
- Unsafe mode uses `eval`.
- Iframe mode uses `sandbox.add("allow-scripts")`, which is the right baseline
  for generated code but still needs careful message handling.

Required guardrails:

- Keep unsafe mode opt-in with clear warning.
- Default generated previews to sandboxed iframe, not unsafe execution.
- Validate `postMessage` payload shape and source.
- Do not expose API keys, provider config, IndexedDB, or app stores to preview
  frames.

### Raw HTML Rendering

Files found via audit scan include:

- `src/components/LiteChat/canvas/StreamingContentView.tsx`
- `src/components/LiteChat/canvas/UserPromptDisplay.tsx`
- `src/components/LiteChat/canvas/interaction/AssistantResponse.tsx`
- `src/components/LiteChat/common/MermaidBlockRenderer.tsx`
- `src/components/LiteChat/common/FlowBlockRenderer.tsx`
- `src/components/ui/chart.tsx`

Risk:

- Several components use `dangerouslySetInnerHTML`.
- Some content is generated from markdown or model output.

Required guardrails:

- Inventory each HTML sink and confirm sanitizer coverage.
- For model-generated or file-generated HTML, prefer sandboxed iframe preview.
- Avoid rendering untrusted HTML directly into the app DOM.

### VFS Real-Folder Sync

Files:

- `src/lib/litechat/real-fs-sync.ts`

Current guardrails:

- User must explicitly choose a directory through File System Access API.
- `.git`, `.env`, `.env.local`, `.litechat`, `node_modules`, and `.DS_Store`
  are ignored.
- Sync is non-destructive: it does not delete local disk or VFS files.
- Newer/equal destination files are skipped.

Remaining work:

- Add visible review summary before large writes.
- Add per-project allow/deny patterns.
- Add tests for ignored names and non-destructive behavior.
- Add optional dry-run mode.

### Git Repositories And Credentials

Files:

- `src/lib/litechat/vfs-git-operations.ts`
- `src/services/sync.service.ts`
- `src/services/config-sync.service.ts`
- `src/store/conversation.store.ts`

Risk:

- Git credentials/passwords/PATs can be stored or held in session memory.
- Imported repos can contain malicious skill packages or prompt-injection files.

Required guardrails:

- Do not execute repo content on clone.
- Treat skill packages as untrusted until installed through review.
- Avoid exporting credentials in full-data export unless the user explicitly
  selects that option and sees a warning.
- Prefer session-only credentials where possible.

### API Keys

Files:

- `src/store/provider.store.ts`
- `src/services/persistence.service.ts`
- `src/components/LiteChat/common/ApiKeysForm.tsx`

Risk:

- API keys live in browser IndexedDB.
- Full export can include API keys.

Required guardrails:

- Keep API key export opt-in and warning-heavy.
- Do not expose keys to previews, skills, mods, or wiki publishing by default.
- Add redaction for diagnostics and audit reports.

### Service Worker / PWA

Files:

- `vite.config.ts`
- generated `dist/sw.js`

Risk:

- Service workers can preserve old app code and cache generated artifacts.
- PWA dependency chain currently contributes high audit findings.

Required guardrails:

- Upgrade/remediate PWA build dependencies.
- Confirm `/litechat/` scope is correct.
- Document cache-clearing steps for security-sensitive upgrades.

### crea8 Wiki Integration

Risk:

- Wiki pages are prompt context and can carry prompt injection.
- Publishing generated content can overwrite persistent knowledge.

Required guardrails:

- Mark wiki content as untrusted context in prompt compilation.
- Require confirmation before creating/updating pages.
- Keep page revision history or export backup before overwrite.

## High-Priority Remediation Checklist

- [ ] Upgrade semver-compatible vulnerable dependencies.
- [ ] Re-run `npm audit --json` and update this file.
- [ ] Add skill manifest and permission model before repo-imported skills.
- [ ] Add sandboxed VFS previewer for HTML instead of direct DOM render.
- [ ] Audit all `dangerouslySetInnerHTML` sinks and document sanitizer status.
- [ ] Add dry-run/write summary for real-folder sync.
- [ ] Add redaction helper for diagnostics involving API keys or Git tokens.
- [ ] Add install review UI for imported skills/mods/tools.
- [ ] Add service-worker cache guidance after security upgrades.
