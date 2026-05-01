# Security Audit

Date: 2026-05-01

Scope: wan0 LiteChat fork, especially workstation features: skills, repo import,
VFS real-folder sync, generated file previews, console UI, and crea8 wiki/memory
integration.

Overall status: in progress.

Recent hardening shipped:

- Prompt sampling parameters are now opt-in, preventing providers from receiving
  both `temperature` and `top_p` when they reject that combination.
- HTML/VFS previews use sandboxed rendering helpers and blob URL cleanup.
- Installed skill prompts are wrapped as contextual guidance, not higher-priority
  system policy.
- Skill install now shows static safety findings before enabling permissioned,
  executable, or sensitive packages.
- Imported skill package paths now reject absolute paths, backslashes, empty
  segments, `.` segments, `..`, and duplicates.

## Current Dependency Baseline

Command:

```bash
npm audit --json
```

Initial result on 2026-04-30:

- Total vulnerabilities: 36
- High: 14
- Moderate: 15
- Low: 7
- Critical: 0

Notable direct dependencies in the initial audit:

- `ai <5.0.52`: low severity filetype whitelist bypass.
- `vite 7.0.0 - 7.3.1`: high aggregate severity across dev-server file-read
  and path traversal advisories.
- `vite-plugin-pwa >=0.20.0`: high severity through `workbox-build` /
  `@rollup/plugin-terser` / `serialize-javascript`.
- `vite-plugin-node-polyfills >=0.3.0`: low severity through
  `node-stdlib-browser` and browser crypto polyfills.

Notable initial transitive findings:

- `serialize-javascript`: high severity RCE/DoS advisories via PWA build stack.
- `rollup`: high severity arbitrary file write/path traversal advisories.
- `undici`: high severity WebSocket/resource exhaustion advisories.
- `tar`: high severity path traversal/hardlink/symlink advisories.
- `devalue`, `flatted`, `picomatch`: high severity parser/path/glob risks.
- `dompurify`: moderate XSS advisories.
- `postcss`, `qs`, `js-yaml`, `brace-expansion`, `bn.js`, `uuid`: moderate
  advisories.

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

Remaining issues after pass 1:

- `vite-plugin-pwa` chain through `workbox-build`, `@rollup/plugin-terser`,
  and `serialize-javascript`. `npm audit` recommended `vite-plugin-pwa@0.19.8`
  via `--force`, which is a breaking downgrade from the current `1.x` line.
- `vite-plugin-node-polyfills` chain through `node-stdlib-browser`,
  `crypto-browserify`, and `elliptic`. `npm audit` recommended
  `vite-plugin-node-polyfills@0.2.0` via `--force`, also a breaking downgrade.
- `mermaid-isomorphic` through `mermaid` and `uuid`. `npm audit` reported no
  available fix.

Decision:

- Do not run `npm audit fix --force` blindly.
- Treat the remaining issues as follow-up upgrade/removal decisions:
  - evaluate disabling or replacing PWA generation
  - evaluate whether node polyfills can be reduced
  - evaluate replacing or isolating Mermaid rendering

## Dependency Remediation Pass 2

Commands:

```bash
npm audit --audit-level=low
npm outdated --long
npm install
npm audit --audit-level=low
```

Result before overrides on 2026-05-01:

- 13 total vulnerabilities.
- 4 high from `serialize-javascript <=7.0.4` through
  `vite-plugin-pwa -> workbox-build -> @rollup/plugin-terser`.
- 6 low from `elliptic` through
  `vite-plugin-node-polyfills -> node-stdlib-browser -> crypto-browserify`.
- 3 moderate from `uuid <14` through `mermaid-isomorphic -> mermaid`.

Remediation applied:

- Added a package override for `serialize-javascript@^7.0.5`.
- Added a package override for `elliptic@^6.6.1`, keeping the tree on the newest
  available release even though the advisory still currently marks `<=6.6.1`.

Current result after `npm install`:

- 9 total vulnerabilities.
- 0 high, 0 critical.
- 6 low remain in the node polyfill crypto chain.
- 3 moderate remain in the mermaid/uuid chain.

Remaining dependency findings:

| Area | Severity | Path | Status | Notes |
| --- | --- | --- | --- | --- |
| Node crypto polyfills | Low | `vite-plugin-node-polyfills -> node-stdlib-browser -> crypto-browserify -> elliptic` | Accepted for now | npm suggests downgrading `vite-plugin-node-polyfills` to `0.2.0`, which is a breaking force fix. Prefer removing/reducing browser node polyfills instead. |
| Mermaid UUID usage | Moderate | `mermaid-isomorphic -> mermaid -> uuid` | Accepted for now | npm reports no fix available. Risk appears limited unless LiteChat passes attacker-controlled buffers into UUID v3/v5/v6 paths through Mermaid. |

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

Sink inventory:

| File | Source | Sanitizer status | Risk | Next action |
| --- | --- | --- | --- | --- |
| `src/components/LiteChat/common/FlowBlockRenderer.tsx` | Flow node labels with embedded image/SVG markup | Uses `DOMPurify.sanitize` with a narrow tag/attribute allowlist | Medium | Add regression tests for blocked event handlers, scripts, and external references. |
| `src/components/LiteChat/common/MermaidBlockRenderer.tsx` | Mermaid-generated SVG | Mermaid output is injected directly | Medium | Sanitize SVG output or render in an isolated preview frame before treating diagrams from untrusted prompts as safe. |
| `src/components/ui/chart.tsx` | Local chart CSS variables | App-generated CSS string from chart config | Low | Validate chart color values if chart config can ever come from model/file input. |
| `src/components/LiteChat/canvas/interaction/AssistantResponse.tsx` | Parsed assistant markdown HTML | Parser output is injected directly | High | Centralize markdown rendering through a sanitizer before DOM insertion. |
| `src/components/LiteChat/canvas/UserPromptDisplay.tsx` | Parsed user markdown HTML | Parser output is injected directly | Medium | Use the same sanitizer as assistant markdown; user content can include pasted untrusted text/files. |
| `src/components/LiteChat/canvas/StreamingContentView.tsx` | Parsed streaming markdown and fallback `MarkdownIt().render` | Parser output is injected directly | High | Remove raw fallback or sanitize rendered markdown before insertion. |

### Skills And Imported Packages

Files:

- `src/lib/litechat/skill-package.ts`
- `src/lib/litechat/skill-install-review.ts`
- `src/lib/litechat/skill-vfs-import.ts`
- `src/controls/components/skill-settings/SettingsSkills.tsx`

Current guardrails:

- Manifest permissions are normalized and used for risk estimates.
- Install review highlights declared permissions, executable paths, and common
  sensitive behavior strings.
- Path validation blocks traversal, absolute paths, backslashes, empty segments,
  `.` segments, `..`, and duplicate package paths.
- Installed skill prompts are injected as bounded context rather than privileged
  policy.

Remaining work:

- Add richer manifest permission schema and explicit deny/allow install policy.
- Keep imported tools/mods inert until separately reviewed and enabled.
- Add source/revision display for Git-imported skills.

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

### crea8 Memory Notes

Files:

- `src/lib/litechat/crea8-memory.ts`
- `src/store/crea8-memory.store.ts`

Current guardrails:

- crea8 notes are treated as user-editable reference material, not hidden
  privileged memory.
- Prompt context includes an explicit injection boundary warning the model not
  to obey instructions inside notes unless the user asks.
- AI-originated memory writes are proposals by default, with accept/reject
  status tracked separately from the durable note.

Remaining work:

- Add user review UI before accepted proposals write to crea8.
- Keep note search/read access scoped to the selected project or explicitly
  attached notes.
- Record source conversation, interaction, skill, and target note references on
  every accepted memory write.

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
- PWA dependency chain has produced high audit findings.

Required guardrails:

- Continue remediating PWA build dependencies.
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

- [x] Upgrade semver-compatible vulnerable dependencies.
- [x] Re-run `npm audit --json` and update this file.
- [x] Add skill manifest and permission model before repo-imported skills.
- [x] Add sandboxed VFS previewer for HTML instead of direct DOM render.
- [ ] Audit all `dangerouslySetInnerHTML` sinks and document sanitizer status.
- [ ] Add dry-run/write summary for real-folder sync.
- [ ] Add redaction helper for diagnostics involving API keys or Git tokens.
- [x] Add install review UI for imported skills/mods/tools.
- [ ] Add service-worker cache guidance after security upgrades.

## Verification Commands

Run these after security-related changes:

```bash
npm audit --audit-level=low
npm test -- --run
npm run build
```

For targeted skill/import hardening:

```bash
npm test -- skill-package.test.ts skill-install-review.test.ts skill-vfs-import.test.ts --run
```
