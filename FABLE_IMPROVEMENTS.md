# FABLE Improvements

Full-repository review covering security, bugs, implementation issues, usability, UI, accessibility, i18n, and infrastructure. Each finding lists **id**, **type**, **issue**, and **fix** (plus severity and location for triage).

**Update (2026-07-11):** All 80 round-1 findings were re-verified against commit `38d3f462` ("Implement all FABLE improvements"). Each finding now carries a **Status** line. The verification also surfaced 13 new issues introduced or left by the fix commit — see [Round 2 Findings](#round-2-findings-post-fix-verification).

## Summary

| Category | Prefix | Findings | Critical | High | Medium | Low |
|---|---|---|---|---|---|---|
| Security | SEC | 13 | 1 | 4 | 6 | 2 |
| Stores & Events | STORE | 15 | 1 | 4 | 8 | 2 |
| Services & Lib | SVC | 17 | 1 | 8 | 7 | 1 |
| UI / UX | UI | 15 | 1 | 6 | 6 | 2 |
| Infra / Config | INFRA | 20 | 0 | 8 | 9 | 3 |
| **Total** | | **80** | **4** | **30** | **36** | **10** |

## Verification Summary (commit `38d3f462`)

| Category | ✅ Fixed | 🟡 Partial | ❌ Not fixed | New round-2 issues |
|---|---|---|---|---|
| Security | 10 | 2 (SEC-2, SEC-7) | 1 (SEC-9) | 4 (SEC-14…17) |
| Stores & Events | 15 | 0 | 0 | 2 (STORE-16…17) |
| Services & Lib | 15 | 2 (SVC-4, SVC-8) | 0 | 2 (SVC-18…19) |
| UI / UX | 14 | 1 (UI-3) | 0 | 5 (UI-16…20) |
| Infra / Config | 19 | 1 (INFRA-13) | 0 | 2 (INFRA-21…22) |
| **Total** | **73** | **6** | **1** | **15** |

---

## Security (SEC)

### SEC-1 — security (critical)
- **File:** `src/modding/loader.ts:52`
- **Issue:** Mod scripts execute via `new Function("modApi", scriptContent)` in the main page context with no sandbox, Worker, or CSP boundary. A mod (or remotely-fetched mod script) has full access to the DOM, all Zustand stores (API keys, git tokens, conversation history), IndexedDB, and the network — far beyond the documented `modApi` surface.
- **Fix:** Execute mod scripts inside a dedicated Web Worker with a typed `postMessage` bridge exposing only intentional mod operations, so mod code cannot read application secrets or mutate app state directly.
- **Status (verified against `38d3f462`):** ✅ Fixed — Mods now run in a Web Worker (`src/modding/loader.ts` `executeModInWorker`, `new Worker(MOD_WORKER_URL)`) via a typed postMessage bridge; no `new Function`/eval in page context remains. See SEC-14 for a gap in the bridge.

### SEC-2 — security (high)
- **File:** `src/modding/loader.ts:29-33`
- **Issue:** `assertAllowedOutboundUrl` is called without an `allowedHosts` argument, so a mod's `sourceUrl` may point to any HTTP/S origin, and the fetched script executes in the main page context. A compromised CDN or DNS hijack yields immediate code execution in the app.
- **Fix:** Require mods to declare a pinned CDN host checked against an explicit allowlist, and enforce Subresource Integrity (SRI) verification on the fetched script before execution.
- **Status (verified against `38d3f462`):** 🟡 Partial — Origin allowlist (jsdelivr/unpkg/raw.githubusercontent/gist) enforced in `loader.ts:54-73`, but SRI verification only runs `if (mod.integrity)` — mods without an integrity field execute unverified. Tracked as SEC-15.

### SEC-3 — security (high)
- **File:** `src-tauri/tauri.conf.json:25`
- **Issue:** `"csp": null` disables Content Security Policy entirely in the Tauri desktop build. Any XSS or DOM injection (mods, LLM output, markdown) can load arbitrary remote scripts, exfiltrate API keys, or escalate to native Tauri capabilities.
- **Fix:** Set a strict CSP (`default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https:; ...`) reflecting actual resource needs, and enumerate Tauri permissions explicitly in the capability file.
- **Status (verified against `38d3f462`):** ✅ Fixed — `tauri.conf.json:25` now sets a full CSP (`default-src 'self'; object-src 'none'; base-uri 'self'; ...`). Note it retains `'unsafe-eval'` — tracked as SEC-16.

### SEC-4 — security (high)
- **File:** `src/services/race-result-export.service.ts:469`
- **Issue:** For `runjs` blocks, `data.runnableCode` is interpolated verbatim inside a `<script type="module">` tag in exported HTML. Any `</script>` substring in AI-generated code terminates the script element early, allowing arbitrary HTML/script injection that executes whenever the exported file is opened.
- **Fix:** Escape `</script>` as `<\/script>` (or embed code as a JSON-encoded string), and add a `<meta http-equiv="Content-Security-Policy">` to the exported HTML.
- **Status (verified against `38d3f462`):** ✅ Fixed — `race-result-export.service.ts:492` applies `.replace(/<\/script>/gi, "<\\/script>")` before interpolation.

### SEC-5 — security (high)
- **File:** `src/services/race-result-export.service.ts:474-478`
- **Issue:** Python code is embedded in a JS string with only single-quote/newline escaping, then assigned via `innerHTML` in the exported file. Code containing `</code></pre><img src=x onerror=...>` escapes the code element and injects arbitrary HTML — angle brackets are never encoded.
- **Fix:** HTML-escape the source (`&`, `<`, `>`) before embedding, or use `textContent`/`createTextNode` instead of `innerHTML`.
- **Status (verified against `38d3f462`):** ✅ Fixed — `race-result-export.service.ts:498` applies `escapeJsString(escapeHtml(...))` so `< > &` become entities before embedding.

### SEC-6 — security (medium)
- **File:** `src/services/code-execution.service.ts:340-358`
- **Issue:** `executeJsInPageContext` runs user-supplied code via `AsyncFunction` directly in the main thread with full DOM/state access. Though gated by consent + permission flags, it remains a callable method reachable from mods (SEC-1) or future callers, and prompt injection could attempt to enable it via a workflow step.
- **Fix:** Remove `executeJsInPageContext` and use the isolated Worker path exclusively; if page-context access is genuinely needed, gate it behind a dedicated non-bypassable user confirmation dialog.
- **Status (verified against `38d3f462`):** ✅ Fixed — `executeJsInPageContext` removed entirely; `executeJs` requires consent and unconditionally uses the isolated blob-URL Worker path.

### SEC-7 — security (medium)
- **File:** `src/lib/llmchef/vfs-git-operation-options.ts:30`
- **Issue:** When `corsProxyUrl` is configured, all git traffic — including `Authorization` headers carrying personal access tokens — routes through the third-party proxy. A malicious proxy silently harvests every git credential.
- **Fix:** Warn prominently in the CORS proxy settings UI that the proxy receives git tokens; consider excluding authenticated git operations from proxy routing.
- **Status (verified against `38d3f462`):** 🟡 Partial — A destructive `<Alert>` warning was added to `SettingsGitSyncRepos.tsx:284-290`, but it only warns about storing credentials — it never mentions CORS-proxy forwarding. Tracked as SEC-17.

### SEC-8 — security (medium)
- **File:** `src/lib/llmchef/vfs-git-browser-runtime.ts:32`
- **Issue:** `window.prompt()` is used to collect git passwords/PATs. Native prompts are spoofable, provide no input masking, and the token is held in a plain JS string.
- **Fix:** Replace with a React modal using `<input type="password">`, store credentials only in the in-memory session map, and clear on session end.
- **Status (verified against `38d3f462`):** ✅ Fixed — `vfs-git-browser-runtime.ts:29` now uses `GitCredentialDialogService.requestCredentials(url)` backed by `GitCredentialDialogHost` mounted in `LLMChef.tsx`; no `window.prompt` remains.

### SEC-9 — security (medium)
- **File:** `src/store/conversation.store.ts:631`, `src/controls/components/git-settings/SettingsGitSyncRepos.tsx:55`
- **Issue:** Git repository passwords/tokens are persisted as plain text in the `syncRepos` table in IndexedDB. Any same-origin script — including loaded mods — can read every stored token.
- **Fix:** Encrypt the `password` field at rest via Web Crypto (AES-GCM with a passphrase-derived key) and zero it in memory after use.
- **Status (verified against `38d3f462`):** ❌ Not fixed — `conversation.store.ts:626,635` still stores `password` as plaintext and persists the plain object to the IndexedDB `syncRepos` table; no encryption layer was added.

### SEC-10 — security (medium)
- **File:** `docker/nginx.conf:1-33`
- **Issue:** The nginx config sends no security headers: no `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy`. The app can be framed (clickjacking) and injected scripts can exfiltrate data freely.
- **Fix:** Add `add_header` directives for X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, Referrer-Policy, and an appropriate CSP for the SPA.
- **Status (verified against `38d3f462`):** ✅ Fixed — `docker/nginx.conf:8-11` now sends `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and a `Content-Security-Policy`, all with `always`.

### SEC-11 — security (medium)
- **File:** `runner/llmchef.sh:70-81`
- **Issue:** The runner downloads `latest.zip` from `wan0.net` via `curl -L` and extracts/serves it with no hash or signature verification. A MITM or CDN compromise can substitute a malicious bundle served straight to the user's browser.
- **Fix:** Publish a SHA-256 digest per release and verify with `sha256sum -c` before extraction; limit redirect-following for the primary URL.
- **Status (verified against `38d3f462`):** ✅ Fixed — `runner/llmchef.sh:115-156` fetches a `.sha256` digest and verifies via sha256sum/shasum/python hashlib with hard exit on mismatch; extraction gains path-traversal validation.

### SEC-12 — security (low)
- **File:** `src/components/LLMChef/common/MermaidBlockRenderer.tsx:282`
- **Issue:** Mermaid SVG is sanitized with `USE_PROFILES: { svg: true, svgFilters: true }` and injected via `dangerouslySetInnerHTML`. The filters profile permits `<filter>`/`<feBlend>` elements usable for CSS side-channel/pixel-stealing attacks in some browsers; Mermaid's `securityLevel: "strict"` does not strip filters.
- **Fix:** Drop `svgFilters: true` if diagrams don't need filters, or explicitly `FORBID_TAGS: ['filter', 'feBlend', ...]`.
- **Status (verified against `38d3f462`):** ✅ Fixed — `MermaidBlockRenderer.tsx:117-121` drops `svgFilters` and adds `FORBID_TAGS` enumerating all 26 SVG filter primitives.

### SEC-13 — security (low)
- **File:** `src/lib/llmchef/useMarkdownParser.ts:24-28`
- **Issue:** `MarkdownIt` is initialized with `html: true`, allowing raw HTML pass-through from LLM output before DOMPurify sanitization. Any future DOMPurify bypass would render unsanitized LLM-controlled HTML in chat.
- **Fix:** Set `html: false` in the MarkdownIt config and allowlist specific tags via DOMPurify if needed.
- **Status (verified against `38d3f462`):** ✅ Fixed — `useMarkdownParser.ts:25` now sets `html: false`.

---

## Stores & Event System (STORE)

### STORE-1 — bug (critical)
- **File:** `src/store/vfs.store.ts:195`
- **Issue:** `_removeNodes` calls `get()._removeNodes(childIdsToRemove)` inside an active Immer `set()` producer. The nested `set()` operates on the pre-outer-set snapshot, and the outer draft commits last — overwriting the child deletions. Recursively-nested folder children are silently left dangling in `state.nodes` and `state.childrenMap`.
- **Fix:** Collect all descendant IDs first and delete them in a single `set()` draft pass; never nest `set()`/`get()` inside an active Immer producer.
- **Status (verified against `38d3f462`):** ✅ Fixed — `vfs.store.ts:179-215` pre-collects descendant IDs via `collectDescendantIds()` and deletes everything in a single `set()` pass; no nested `get()`/`set()` in the draft.

### STORE-2 — bug (high)
- **File:** `src/store/conversation.store.ts:491-517`
- **Issue:** `selectItem` for conversations emits `currentConversationIdChanged` directly, then `setCurrentConversationIdRequest` (which re-emits the same event), plus a redundant `loadInteractionsRequest`. `currentConversationIdChanged` fires twice and `loadInteractions` runs twice concurrently — the second load races the first, causing flicker and potentially lost in-flight streaming interactions.
- **Fix:** Remove the direct emission at line 491 (let `setCurrentConversationId` own it) and remove the redundant `loadInteractionsRequest` at line 515.
- **Status (verified against `38d3f462`):** ✅ Fixed — `selectItem` now emits exactly one `setCurrentConversationIdRequest` and one `selectedItemChanged`; the direct emission and redundant `loadInteractionsRequest` are gone.

### STORE-3 — bug (high)
- **File:** `src/store/conversation.store.ts:435-437`
- **Issue:** `deleteConversation` issues two sequential persistence calls (conversation, then its interactions). If the first succeeds and the second throws, the catch block re-adds the conversation to UI state — but the DB record is gone, creating a ghost conversation that can never be re-saved.
- **Fix:** Wrap both deletions in a single transaction, or delete interactions first so partial failure leaves the DB consistent.
- **Status (verified against `38d3f462`):** ✅ Fixed — Replaced with a single atomic `PersistenceService.deleteConversationAndInteractions(id)` call (`conversation.store.ts:437`).

### STORE-4 — bug (high)
- **File:** `src/services/event-action-coordinator.service.ts:44-111`
- **Issue:** `initialize()` registers `emitter.on(...)` for every handler but there is no `destroy()`/teardown and no `emitter.off()` anywhere; the static `isInitialized` flag permanently blocks re-initialization. Tests, Storybook, or host remounts accumulate orphaned listeners while the guard prevents re-registering updated handlers.
- **Fix:** Add a static `destroy()` that unregisters all handlers and resets `isInitialized`; return a cleanup function from the calling `useEffect` in `LLMChef.tsx`.
- **Status (verified against `38d3f462`):** ✅ Fixed — `event-action-coordinator.service.ts:115-131` adds `destroy()` that `emitter.off()`s every handler and resets `registeredHandlers`/`isInitialized`.

### STORE-5 — bug (high)
- **File:** `src/store/workflow.store.ts:73-75`
- **Issue:** `_handleWorkflowCompleted` schedules `set({ activeRun: null, pausePayload: null })` via an uncancellable 5-second `setTimeout`. If a new workflow starts within that window, the timer silently nukes the new run's state mid-execution.
- **Fix:** Store the timeout ID and clear it in `_handleWorkflowStarted`/`_handleWorkflowCancelled`.
- **Status (verified against `38d3f462`):** ✅ Fixed — `workflow.store.ts:15` stores `completedRunClearTimeoutId`; `_handleWorkflowStarted` and `_handleWorkflowCancelled` clear it before mutating state.

### STORE-6 — bug (medium)
- **File:** `src/store/interaction.store.ts:72-103`
- **Issue:** `loadInteractions` clears `interactions: []` before the async DB fetch, then its merge "PATCH" reads `get().interactions` after the await — which is empty. Pre-existing in-memory interactions the merge intends to preserve are irreversibly discarded; concurrent calls (see STORE-2) compound the loss.
- **Fix:** Snapshot in-memory interactions before the clear (not after the await) so the merge patch has the data it needs.
- **Status (verified against `38d3f462`):** ✅ Fixed — `interaction.store.ts:73-75` captures `inMemorySnapshot` before the clear; the post-await merge uses the snapshot.

### STORE-7 — bug (medium)
- **File:** `src/store/settings.store.ts:332-333`
- **Issue:** `persistSetting` is async but most settings actions call it without `await`/`void`; persistence errors are silently dropped as unhandled rejections, and `settingsChanged` fires after the action-specific event, violating expected ordering.
- **Fix:** Prefix call-sites with `void` and add a `.catch` inside `persistSetting` that surfaces errors via `toast.error`.
- **Status (verified against `38d3f462`):** ✅ Fixed — `persistSetting` (`settings.store.ts:195-205`) now has its own try/catch with `toast.error`; call-sites use `void persistSetting(...)`. See STORE-16/17 for new call-site issues.

### STORE-8 — bug (medium)
- **File:** `src/store/provider.store.ts:206,291-292`
- **Issue:** `setEnableApiKeyManagement` and `selectModel` call `PersistenceService.saveSetting(...)` with no await/`.catch`. A failed IndexedDB write is silently swallowed; the next app load selects a wrong/null model or loses the setting.
- **Fix:** Add `.catch` handlers at minimum, or await persistence with error handling as `addApiKey`/`updateApiKey` already do.
- **Status (verified against `38d3f462`):** ✅ Fixed — Both `setEnableApiKeyManagement` and `selectModel` now attach `.catch()` handlers logging and toasting the error (`provider.store.ts:206-210, 296-301`).

### STORE-9 — bug (medium)
- **File:** `src/store/conversation.store.ts:155-168`
- **Issue:** `_ensureSyncVfsReady`'s `fsInstanceChanged` listener checks `configuredVfsKey === SYNC_VFS_KEY`, but `_setFsInstance` emits that event before `configuredVfsKey` is updated — so the check always fails and the listener is a dead branch that never resolves the promise (only the loading-state path works).
- **Fix:** Remove the dead `fsInstanceChanged` listener or listen to `vfsKeyChanged` (emitted after the key is set) instead.
- **Status (verified against `38d3f462`):** ✅ Fixed — Dead `fsInstanceChanged` listener removed; replaced by `handleVfsKeyChanged` (fires after `configuredVfsKey` is set) plus the loading-state path (`conversation.store.ts:155-193`).

### STORE-10 — bug (medium)
- **File:** `src/store/interaction.store.ts:502`
- **Issue:** Operator precedence bug: `` `${error?.message || typeof error === 'string' ? error : 'Unknown error'}` `` parses as `(error?.message || typeof error === 'string') ? error : ...`, so Error objects render as `[object Error]` instead of the message.
- **Fix:** Use `error?.message ?? (typeof error === 'string' ? error : 'Unknown error')`.
- **Status (verified against `38d3f462`):** ✅ Fixed — Toast now uses `error?.message ?? (typeof error === 'string' ? error : 'Unknown error')` (`interaction.store.ts:515`).

### STORE-11 — implementation (medium)
- **File:** `src/store/conversation.store.ts:457-458`
- **Issue:** The delete-rollback `push()`es the conversation at the end of the array instead of restoring its original position, so after a failed delete the conversation jumps to the bottom of the sidebar.
- **Fix:** Record the original index before optimistic removal and `splice(originalIndex, 0, conversationToDelete)` on rollback.
- **Status (verified against `38d3f462`):** ✅ Fixed — Rollback uses `splice(insertIndex, 0, conversationToDelete)` with a clamped original index (`conversation.store.ts:458-462`).

### STORE-12 — bug (medium)
- **File:** `src/store/interaction.store.ts:214-228,257-270`
- **Issue:** `appendInteractionResponseChunk` guards against writing chunks for a non-current conversation, but `appendStreamBuffer` only checks `streamingInteractionIds` — after a conversation switch it keeps writing chunks into `activeStreamBuffers` for the deselected conversation.
- **Fix:** Apply the same `currentConversationId` guard in `appendStreamBuffer`, or consolidate both methods.
- **Status (verified against `38d3f462`):** ✅ Fixed — `appendStreamBuffer` now carries the same `currentConversationId` guard as `appendInteractionResponseChunk` (`interaction.store.ts:261-265`).

### STORE-13 — bug (low)
- **File:** `src/store/vfs.store.ts:251-309`
- **Issue:** `setVfsKey` is wrapped entirely in `if (key !== null)` with no else branch — calling `setVfsKey(null)` silently does nothing: no state clear, no event, stale key remains.
- **Fix:** Add an else branch that clears VFS state (mirroring `_setEnableVfs(false)`) and emits `vfsKeyChanged`.
- **Status (verified against `38d3f462`):** ✅ Fixed — `setVfsKey(null)` now clears all VFS state and emits `vfsEvent.vfsKeyChanged` (`vfs.store.ts:317-335`).

### STORE-14 — bug (low)
- **File:** `src/store/interaction.store.ts:285-303`
- **Issue:** `rateInteraction` persists a pre-update snapshot (`{ ...interaction, rating }`). If streaming updates `response`/`metadata` between snapshot and the awaited save, the write silently overwrites newer fields with stale data.
- **Fix:** Re-read the current interaction from `get().interactions` immediately before the persistence call.
- **Status (verified against `38d3f462`):** ✅ Fixed — `rateInteraction` re-reads the current interaction from state before persisting (`interaction.store.ts:300-306`).

### STORE-15 — implementation (low)
- **File:** `src/lib/llmchef/event-emitter.ts:8-9`
- **Issue:** The emitter is typed `Emitter<ModEventPayloadMap & Record<EventType, any>>`; the `Record<EventType, any>` intersection defeats all payload type-checking at every call site, turning mis-typed payloads into runtime-only bugs.
- **Fix:** Remove `& Record<EventType, any>` and type strictly as `Emitter<ModEventPayloadMap>`; use localized explicit casts for mod escape hatches.
- **Status (verified against `38d3f462`):** ✅ Fixed — Emitter now typed strictly as `Emitter<ModEventPayloadMap>`; the `& Record<EventType, any>` intersection is gone (`event-emitter.ts:8`).

---

## Services & Lib (SVC)

### SVC-1 — bug (critical)
- **File:** `src/services/interaction.service.ts:332-351`
- **Issue:** The "race" handler mutates global `promptState.modelId` inside staggered concurrent `setTimeout` callbacks; the second timeout overwrites the model before the first participant's `regenerateInteraction` reads it, so all participants use the last-written model. The restoration at line 351 also runs before regenerations complete.
- **Fix:** Pass `modelId` as an explicit parameter to `regenerateInteraction` instead of mutating global state; guard restoration with try/finally wrapping the actual async work.
- **Status (verified against `38d3f462`):** ✅ Fixed — Each race participant now captures its own `modelId` in closure and passes it explicitly via `regenerateInteraction(interactionId, { modelId })`; no global mutation (`interaction.service.ts:313-318`).

### SVC-2 — bug (high)
- **File:** `src/services/ai.service.ts:196-198`
- **Issue:** `await streamResult.reasoningText` sits inside the outer try/catch wrapping the full stream. If that promise rejects, the catch calls `callbacks.onError(...)`, wrongly marking an already-successfully-streamed interaction as ERROR.
- **Fix:** Wrap the `reasoningText` fetch in its own try/catch (or `.catch(() => undefined)`) so failure only loses the reasoning field.
- **Status (verified against `38d3f462`):** ✅ Fixed — `reasoningText` awaited in its own try/catch that only logs a warning (`ai.service.ts:196-203`).

### SVC-3 — bug (high)
- **File:** `src/services/interaction.service.ts:659-663, 1441-1447`
- **Issue:** Both the initial save of a new interaction and the final post-stream persistence are fire-and-forget (`.catch(console.error)`). A `QuotaExceededError` or any IndexedDB failure is silently swallowed — the interaction is visible in the UI but lost on next page load.
- **Fix:** Await both saves and propagate errors, or at minimum detect quota errors and surface a user-facing toast.
- **Status (verified against `38d3f462`):** ✅ Fixed — Both saves are awaited inside try/catch blocks that `toast.error` and rethrow (`interaction.service.ts:638-646, 1419-1427`).

### SVC-4 — bug (high)
- **File:** `src/services/workflow.service.ts:1309-1313`
- **Issue:** `handleWorkflowConversion`'s catch only logs. The `mainInteraction` was already added with status `"STREAMING"` and saved; the error path never finalizes it, so it remains stuck streaming forever with no way to dismiss or abort.
- **Fix:** On error, set the interaction to `"ERROR"`, remove it from `streamingInteractionIds`, persist, and emit `workflowEvent.error`.
- **Status (verified against `38d3f462`):** 🟡 Partial — The catch now sets ERROR, persists, and emits `interactionEvent.completed` (`workflow.service.ts:1316-1356`) — but `_removeStreamingId(mainInteractionId)` is never called and the global completed-listener early-returns for non-step interactions, so the UI can still show it as streaming. Tracked as SVC-19.

### SVC-5 — bug (high)
- **File:** `src/store/conversation.store.ts:436-437`
- **Issue:** `deleteConversation(id)` and `deleteInteractionsForConversation(id)` are two non-transactional sequential writes; if the second fails, orphaned interaction records remain in IndexedDB forever, unreachable and uncleanable.
- **Fix:** Wrap both in a single `db.transaction("rw", [db.conversations, db.interactions], ...)` in `PersistenceService`. (Related UI-state side: STORE-3.)
- **Status (verified against `38d3f462`):** ✅ Fixed — `deleteConversationAndInteractions` wraps both deletes in `db.transaction("rw", [db.conversations, db.interactions], ...)` (`persistence.service.ts:181-184`).

### SVC-6 — bug (high)
- **File:** `src/services/workflow.service.ts:928-931`
- **Issue:** In `_executeSubWorkflowInternal`, the 5-minute timeout `setTimeout` is never stored or cleared on success; `cleanup()` only removes the listener. The timer holds the closure alive and fires stale code 5 minutes later.
- **Fix:** Capture the timeout ID and `clearTimeout` inside `cleanup()`, mirroring `_waitForBranchCompletion`.
- **Status (verified against `38d3f462`):** ✅ Fixed — `cleanup()` now calls `clearTimeout(timeoutId)` before `emitter.off` (`workflow.service.ts:904-910`).

### SVC-7 — bug (high)
- **File:** `src/services/interaction.service.ts:797-812`
- **Issue:** Tool execution emits `vfsEvent.initializeVFSRequest`, then unconditionally sleeps a hardcoded 100 ms before checking VFS readiness. If initialization takes longer (first use, hard reload), the tool call fails with "Filesystem not ready" — a time-based race with an arbitrary delay.
- **Fix:** Await the VFS initialization promise directly (e.g., `useVfsStore.getState().initializeVFS(targetVfsKey)`) instead of sleeping.
- **Status (verified against `38d3f462`):** ✅ Fixed — Tool execution now `await`s `useVfsStore.getState().initializeVFS(targetVfsKey, { force: true })` and throws a structured error on failure; the 100 ms sleep is gone (`interaction.service.ts:778-791`).

### SVC-8 — bug (high)
- **File:** `src/lib/llmchef/initialization.ts:116-163`
- **Issue:** `loadCoreData` awaits a Promise resolved only when 5 specific events fire. If any event never fires (error in a store action, swallowed async exception), the Promise hangs forever and app initialization blocks with no timeout or fallback.
- **Fix:** Add a master timeout (e.g., 30 s) that rejects and surfaces "Initialization timed out" via `useUIStateStore.setGlobalError(...)`.
- **Status (verified against `38d3f462`):** 🟡 Partial — A 30 s timeout was added (`initialization.ts:136-148`) but its handler calls `useUIStateStore.setGlobalError(...)` instead of `useUIStateStore.getState().setGlobalError(...)` — a TypeError that prevents both the banner and the `reject`. Tracked as SVC-18.

### SVC-9 — bug (high)
- **File:** `src/lib/llmchef/vfs-git-operations.ts:344-346`
- **Issue:** `gitEnsureBranchOp` swallows all `git.checkout` errors and falls through to creating a new local branch. If checkout failed for reasons other than "branch missing" (detached HEAD, dirty tree, `CheckoutConflictError`), the repo silently lands on an unexpected new branch.
- **Fix:** Only create the branch on `NotFoundError`/`BranchNotFoundError`; re-throw all other errors.
- **Status (verified against `38d3f462`):** ✅ Fixed — Branch creation now only occurs on `NotFoundError`/`BranchNotFoundError`; all other checkout errors rethrow (`vfs-git-operations.ts:355-364`).

### SVC-10 — bug (medium)
- **File:** `src/services/persistence.service.ts:880-887, 900-907`
- **Issue:** `loadWorkflows()`/`loadWorkflow()` call `JSON.parse(w.definition)` inside the outer try that rethrows — a single corrupted workflow definition makes the entire workflow list fail to load.
- **Fix:** Wrap each `JSON.parse` in its own try/catch; warn and skip (or stub) the corrupted workflow instead of failing the list.
- **Status (verified against `38d3f462`):** ✅ Fixed — Each `JSON.parse(w.definition)` is wrapped per-item; corrupted entries are skipped or return null without failing the list (`persistence.service.ts:919-935, 950-966`).

### SVC-11 — bug (medium)
- **File:** `src/services/sync.service.ts:141-157`
- **Issue:** When the remote conversation file is readable but `JSON.parse` throws, the catch sets `remoteConvoData = null` and execution proceeds as if no remote file existed — unconditionally pushing local and silently overwriting the remote.
- **Fix:** Treat a parse failure as a conflict: skip the push and surface a toast asking the user to resolve manually.
- **Status (verified against `38d3f462`):** ✅ Fixed — Remote parse failure now sets `remoteParseFailed`, toasts about corruption, and returns early without pushing (`sync.service.ts:151-170`).

### SVC-12 — bug (medium)
- **File:** `src/services/import-export.service.ts:193-200`
- **Issue:** `importConversation` saves all interactions in parallel via `Promise.all` outside any Dexie transaction. If one save fails mid-import, the conversation exists with only a subset of interactions — a silently partial/corrupt import with no rollback.
- **Fix:** Wrap conversation + all interactions in a single `db.transaction("rw", ...)`.
- **Status (verified against `38d3f462`):** ✅ Fixed — Conversation + interaction saves wrapped in a single `db.transaction("rw", ...)` (`import-export.service.ts:197-206`).

### SVC-13 — implementation (medium)
- **File:** `src/lib/llmchef/mcp-js-runtime.ts:232-245`
- **Issue:** `startMcpJsRuntimeSession` creates a Worker plus blob URLs and returns a session with a `dispose()` method, but nothing guarantees disposal — callers who forget permanently leak the Worker and blob URLs.
- **Fix:** Document mandatory `try/finally` disposal and/or add an `AbortSignal`/auto-timeout that terminates the worker.
- **Status (verified against `38d3f462`):** ✅ Fixed — `startMcpJsRuntimeSession` now documents try/finally disposal and accepts `{ signal, autoDisposeMs }` with an abort listener and auto-dispose timer (`mcp-js-runtime.ts:232-276`).

### SVC-14 — bug (medium)
- **File:** `src/lib/llmchef/vfs-git-operations.ts:242-252`
- **Issue:** After a successful shallow clone, the follow-up `git.checkout` may run against a repo in detached HEAD state (from `singleBranch` ref handling in the discovery loop) and can silently fail or leave HEAD detached.
- **Fix:** Verify the local branch name after clone and throw explicitly if HEAD is detached, rather than silently proceeding.
- **Status (verified against `38d3f462`):** ✅ Fixed — Post-clone `git.currentBranch()` check throws on detached HEAD and corrects mismatched branches (`vfs-git-operations.ts:247-263`).

### SVC-15 — bug (medium)
- **File:** `src/services/workflow.service.ts:630-673`
- **Issue:** `_waitForBranchCompletion` registers a persistent global `interactionEvent.completed` listener; resolve/reject aren't guarded against multiple invocation if cleanup isn't reached, and each unrelated completion event executes the handler.
- **Fix:** Use once-semantics or guard resolve/reject with a `let settled = false` flag.
- **Status (verified against `38d3f462`):** ✅ Fixed — `cleanup()` (clearTimeout + `emitter.off`) is invoked first in both the completion handler and the timeout callback (`workflow.service.ts:630-670`).

### SVC-16 — bug (medium)
- **File:** `src/lib/llmchef/vfs-git-operations.ts:168-207`
- **Issue:** In the clone branch-discovery loop, if post-failure `rm` cleanup throws (e.g., locked partial `.git`), the loop continues with the directory partially present; the next attempt then throws "Repository already cloned", masking the real clone error.
- **Fix:** If cleanup fails, propagate the error or break the loop with a clear message instead of continuing.
- **Status (verified against `38d3f462`):** ✅ Fixed — Failed `rm` cleanup now throws immediately, propagating the real error instead of masking it (`vfs-git-operations.ts:201-209`).

### SVC-17 — bug (low)
- **File:** `src/modding/loader.ts:52-53, 76`
- **Issue:** `modEvent.modLoaded` payloads always carry an `error` field (`error: instance.error ?? "unknown error"`) regardless of which event is emitted, and an empty-string error is falsy so error branching can misfire.
- **Fix:** Separate payload shapes: `modLoaded` should carry no `error`; `modError` should always include a meaningful non-null error.
- **Status (verified against `38d3f462`):** ✅ Fixed — `modLoaded` payload is now `{ id, name }` with no error field; `modError` always carries a string error (`modding/loader.ts:281-292`).

---

## UI / UX (UI)

### UI-1 — bug (critical)
- **File:** `src/controls/components/project-settings/ProjectSettingsModal.tsx:123`
- **Issue:** `paramsForm` initializes `frequencyPenalty` from `project?.presencePenalty ?? 0.0` (wrong field). On open both sliders show the same value, and saving silently persists the presence penalty as the frequency penalty.
- **Fix:** Change to `frequencyPenalty: project?.frequencyPenalty ?? 0.0`.
- **Status (verified against `38d3f462`):** ✅ Fixed — `frequencyPenalty: project?.frequencyPenalty ?? 0.0` (`ProjectSettingsModal.tsx:125`).

### UI-2 — bug (high)
- **File:** `src/components/LLMChef/canvas/ChatCanvas.tsx:299-302`
- **Issue:** The scroll listener cleanup references `viewportRef.current` instead of the captured `viewport` variable; at unmount the ref may be null/different, so the listener is never removed — memory leak and ghost scroll events.
- **Fix:** Cleanup with `viewport.removeEventListener("scroll", handleScroll)` using the captured variable.
- **Status (verified against `38d3f462`):** ✅ Fixed — Cleanup now uses the captured `viewport` variable (`ChatCanvas.tsx:277,300`).

### UI-3 — bug (high)
- **File:** `src/components/LLMChef/prompt/InputArea.tsx:64, 81`
- **Issue:** `useSettingsStore()` and `useControlRegistryStore()` subscribe to entire stores without selectors; since InputArea re-renders every keystroke, any setting or control-registration change re-renders the compose area — including during streaming.
- **Fix:** Use selector-scoped subscriptions (`useShallow`) extracting only the fields InputArea actually uses.
- **Status (verified against `38d3f462`):** 🟡 Partial — The settings subscription was narrowed to two fields but uses an inline object selector **without `useShallow`** (`InputArea.tsx:64-69`), so it still returns a new object every render and re-renders on any settings change. Tracked as UI-20.

### UI-4 — accessibility (high)
- **File:** `src/controls/components/conversation-list/ItemRenderer.tsx:238-251`
- **Issue:** The clickable conversation/project `<li>` has `onClick` but no `role="button"`, `tabIndex`, or `onKeyDown` — keyboard-only users cannot activate list items.
- **Fix:** Add `role="button" tabIndex={0}` with Enter/Space `onKeyDown` handling, or convert to a `<button>`.
- **Status (verified against `38d3f462`):** ✅ Fixed — The `<li>` now has `role="button"`, `tabIndex={0}`, and an Enter/Space `onKeyDown` handler (`ItemRenderer.tsx:258-260`).

### UI-5 — accessibility (high)
- **File:** `src/controls/components/conversation-list/ItemRenderer.tsx:255-261`
- **Issue:** The expand/collapse chevron `<span>` is interactive but has no role, tabIndex, or keyboard handler — the project tree is inaccessible to keyboard users.
- **Fix:** Convert to `<button type="button" aria-expanded={isExpanded} aria-label="Toggle project">` or add equivalent role/keyboard support.
- **Status (verified against `38d3f462`):** ✅ Fixed — Chevron is now a `<button type="button" aria-expanded={isExpanded} aria-label={t('itemRenderer.toggleProject', { name })}>` (`ItemRenderer.tsx:266-284`).

### UI-6 — accessibility (medium)
- **File:** `src/controls/components/conversation-list/ItemRenderer.tsx:426-431`
- **Issue:** The delete button's aria-label is a generic "Delete" — screen reader users get no context about which conversation/project will be deleted.
- **Fix:** Use the existing `itemRenderer.deleteItem` key with `{ name: displayName }` interpolation.
- **Status (verified against `38d3f462`):** ✅ Fixed — Delete button uses `aria-label={t('itemRenderer.deleteItem', { name: displayName })}` (`ItemRenderer.tsx:443-445`).

### UI-7 — usability (high)
- **File:** `src/controls/components/conversation-list/ConversationListControlComponent.tsx:789, 838, 876`
- **Issue:** Three `window.prompt()` calls gather input for move-conversation, new wiki page, and new folder. Native blocking dialogs are inconsistent with the design system and are suppressed in sandboxed webviews (e.g., Tauri), silently failing the operation.
- **Fix:** Replace with controlled `<Input>` inside a shadcn `<Dialog>`/`<Popover>`, as the rename flow already does.
- **Status (verified against `38d3f462`):** ✅ Fixed — All three `window.prompt` calls replaced with `usePromptDialog`/`useConfirmDialog` hooks rendering shadcn dialogs (`ConversationListControlComponent.tsx:523-524,1303-1304`).

### UI-8 — usability (medium)
- **File:** `ConversationListControlComponent.tsx:665`, `SettingsProviderRow.tsx:154`, `SettingsMods.tsx:107`, `ConversationOnlyList.tsx:126` (+ ~12 more call-sites)
- **Issue:** Every destructive action (delete conversation/project/provider/mod/skill/API key, reset settings, clear data) uses `window.confirm` — visually inconsistent, thread-blocking, suppressible, and untranslated.
- **Fix:** Replace all `window.confirm` guards with shadcn `<AlertDialog>` confirmations.
- **Status (verified against `38d3f462`):** ✅ Fixed — `grep -rn "window\.confirm\|window\.prompt" src/` returns zero results; call-sites use `ConfirmDialogService.confirm()` with `ConfirmDialogHost` mounted in `LLMChef.tsx`. New i18n gaps in these call-sites tracked as UI-16..UI-19.

### UI-9 — bug (medium)
- **File:** `src/components/LLMChef/canvas/ChatCanvas.tsx:523-524`
- **Issue:** The follow-stream toggle calls `t('pauseAutoScroll')`/`t('resumeAutoScroll')`, but the locale keys are `pauseAutoscroll`/`resumeAutoscroll` — keys never resolve, so non-English locales never display these labels.
- **Fix:** Correct the key names to match `canvas.json`.
- **Status (verified against `38d3f462`):** ✅ Fixed — Keys corrected to `pauseAutoscroll`/`resumeAutoscroll`, matching `canvas.json` (`ChatCanvas.tsx:521-522`).

### UI-10 — bug (medium)
- **File:** `src/controls/components/conversation-list/ConversationListControlComponent.tsx:665`
- **Issue:** `t('confirmDelete', ...)` references a key absent from `controls.json`; non-English locales always show the raw English inline fallback for the delete confirmation.
- **Fix:** Add `confirmDelete` (with `{{itemName}}`) to all locale files, or use the existing `conversationList.confirmDeleteConversation` key.
- **Status (verified against `38d3f462`):** ✅ Fixed — Now uses `conversationList.confirmDeleteTitle`/`confirmDeleteConversation`, both present in `controls.json:131-132`.

### UI-11 — bug (medium)
- **File:** `ConversationListControlComponent.tsx:790-831`, `ItemRenderer.tsx:332-349`
- **Issue:** Nine i18n keys used in these files are missing from `src/locales/en/controls.json` (`conversationList.moveConversationPrompt`, `moveConversationProjectNotFound`, `moveConversationSuccess`, `itemRenderer.newWikiPage`, `newWikiPageFor`, `newProjectFolder`, `newProjectFolderFor`, `moveConversation`). Non-English locales fall through to inline English defaults.
- **Fix:** Add all missing keys to every locale file; add an i18n lint step to catch drift.
- **Status (verified against `38d3f462`):** ✅ Fixed — All listed keys now present in `src/locales/en/controls.json` (lines 135, 141-142, 171-175).

### UI-12 — ui (medium)
- **File:** `src/controls/components/project-settings/ProjectSettingsModal.tsx:482-641`
- **Issue:** All five tab labels, the dialog title, and both footer buttons are hardcoded English — the entire project settings dialog is non-internationalized despite the app using i18next.
- **Fix:** Wrap all strings in `t()` under a `settings.projectSettings.*` namespace and add keys to every locale.
- **Status (verified against `38d3f462`):** ✅ Fixed — Dialog uses `useTranslation('settings')` with `projectSettings.*` keys for tabs, title, and footer buttons; keys exist in `settings.json`.

### UI-13 — ui (medium)
- **File:** `src/components/LLMChef/LLMChef.tsx:655-658, 723-726, 750`
- **Issue:** Visible strings "LLMChef", "Projects", "Chat canvas", and "Loading wiki…" are hardcoded English even though surrounding strings are translated.
- **Fix:** Route through `t()` with appropriate keys.
- **Status (verified against `38d3f462`):** ✅ Fixed — `t('appName')`, `t('projectsLabel')`, `t('chatCanvasLabel')`, `t('loadingWiki')` with keys in `common.json` (`LLMChef.tsx:661-756`).

### UI-14 — ui (low)
- **File:** `src/controls/components/provider-settings/SettingsProviderRowView.tsx:133-264`
- **Issue:** The entire provider card is hardcoded English (status labels, field labels, fetch/show/hide/edit/delete buttons); the file has no `useTranslation` call.
- **Fix:** Add `useTranslation('settings')` and back all literals with `settings.json` entries.
- **Status (verified against `38d3f462`):** ✅ Fixed — `SettingsProviderRowView.tsx:65` adds `useTranslation('settings')` and wraps every label in `t('provider.*')`.

### UI-15 — ui (low)
- **File:** `src/components/LLMChef/prompt/PromptWrapper.tsx:163, 187, 221, 234`
- **Issue:** Toast/error strings ("Added to prompt queue", "Please select a model before sending a message", "Failed to queue message…", "Failed to send message…") are hardcoded English.
- **Fix:** Add keys to `src/locales/en/prompt.json` and replace with `t()` calls.
- **Status (verified against `38d3f462`):** ✅ Fixed — All four toasts use `t('promptWrapper.*')` keys present in `prompt.json` (`PromptWrapper.tsx:163-236`).

---

## Infrastructure / Config (INFRA)

### INFRA-1 — hygiene (high)
- **File:** `package.json:96`
- **Issue:** `@types/cheerio` is in `dependencies` instead of `devDependencies`; type packages are compile-time only.
- **Fix:** Move `@types/cheerio` (and audit other `@types/*`) to `devDependencies`.
- **Status (verified against `38d3f462`):** ✅ Fixed — `@types/cheerio` and all other `@types/*` are now in `devDependencies` (`package.json:146`).

### INFRA-2 — hygiene (medium)
- **File:** `package.json:100`
- **Issue:** The `add` package (`"add": "^2.0.6"`) is a runtime dependency but is never imported anywhere; it's an unrelated trivial utility (likely a `yarn add` typo).
- **Fix:** Remove `add` from `dependencies`.
- **Status (verified against `38d3f462`):** ✅ Fixed — The `add` package is gone from dependencies.

### INFRA-3 — bug (high)
- **File:** `package.json:13`
- **Issue:** The `build` script uses bash-only `export VAR=val &&` syntax, silently failing on Windows (cmd.exe/PowerShell).
- **Fix:** Use `cross-env VITE_SYSTEM_PROMPT_FILE=system-prompt.txt ...` or document the POSIX shell requirement.
- **Status (verified against `38d3f462`):** ✅ Fixed — `build` now uses `cross-env` (declared in devDependencies). Sibling scripts still use bare env-var syntax — tracked as INFRA-21.

### INFRA-4 — bug (high)
- **File:** `package.json:37-38`
- **Issue:** `serve` and `update` scripts use bash parameter-expansion defaults (`${LLMCHEF_PORT:=5173}`, etc.) that break in non-bash shells.
- **Fix:** Use cross-platform alternatives (cross-env / node script) or document the shell requirement explicitly.
- **Status (verified against `38d3f462`):** ✅ Fixed — `serve`/`update` are now Node scripts (`scripts/serve.mjs`, `scripts/update.mjs`) handling env defaults cross-platform.

### INFRA-5 — bug (high)
- **File:** `package.json:30`
- **Issue:** The `coverage` script runs `vitest run --coverage` but no coverage provider (`@vitest/coverage-v8`) is installed — Vitest throws "No coverage provider found".
- **Fix:** Add `@vitest/coverage-v8` to devDependencies and configure `coverage.provider: 'v8'` in vite.config test settings.
- **Status (verified against `38d3f462`):** ✅ Fixed — `@vitest/coverage-v8` added; `vite.config.ts:270-275` sets `coverage: { provider: 'v8' }`.

### INFRA-6 — implementation (high)
- **File:** `playwright.config.ts:14`
- **Issue:** `webServer.command` runs `npm run release:local && npm run build && npm run preview` — vendoring ~14 MB of Pyodide and building twice just to start the e2e preview server, making `test:e2e` extremely slow.
- **Fix:** Change to `npm run build && npm run preview -- --host 127.0.0.1 --port 4173`; keep a separate `test:e2e:full` for release-artifact validation.
- **Status (verified against `38d3f462`):** ✅ Fixed — `webServer.command` is now `npm run build && npm run preview -- --host 127.0.0.1 --port 4173`.

### INFRA-7 — security (high)
- **File:** `src-tauri/tauri.conf.json:25`
- **Issue:** `app.security.csp` is `null`, disabling CSP for the Tauri shell (duplicate of SEC-3, listed for infra tracking).
- **Fix:** Set a restrictive CSP that blocks remote script execution.
- **Status (verified against `38d3f462`):** ✅ Fixed — CSP set in `tauri.conf.json:25` (same as SEC-3; retains `'unsafe-eval'`, see SEC-16).

### INFRA-8 — hygiene (high)
- **File:** `.gitignore`
- **Issue:** `user-config.json`, `system-prompt.txt`, `refactor_composite_interaction.md`, and `workflow_plan.md` are git-tracked. `user-config.json` can contain provider configurations; `system-prompt.txt` is per-deployment config; the planning MDs are drafts that don't belong in the repo.
- **Fix:** Add them to `.gitignore`, remove from tracking (`git rm --cached`), and provide `*.example` templates where needed.
- **Status (verified against `38d3f462`):** ✅ Fixed — All four files gitignored and untracked; example templates added (`docs/user-config.example.json`, `docs/system-prompt.example.txt`).

### INFRA-9 — hygiene (medium)
- **File:** `public/pyodide/`
- **Issue:** ~14 MB of vendored Pyodide binaries (including `.whl` files) are committed; eslint/semgrep already treat it as generated vendor content but git tracks it.
- **Fix:** Add `public/pyodide/` to `.gitignore`, `git rm -r --cached` it, and document the `npm run vendor:pyodide` prerequisite.
- **Status (verified against `38d3f462`):** ✅ Fixed — `public/pyodide/` gitignored; only `scripts/vendor-pyodide.mjs` remains tracked.

### INFRA-10 — bug (medium)
- **File:** `AGENT.md:19`
- **Issue:** `AGENT.md` documents `npm run mcp-proxy` (referencing `bin/mcp-bridge.js`), but neither the script nor the file exists.
- **Fix:** Remove the entry or add the actual script/file if the feature is still in use.
- **Status (verified against `38d3f462`):** ✅ Fixed — `AGENT.md` no longer references `mcp-proxy`/`bin/mcp-bridge.js`.

### INFRA-11 — bug (medium)
- **File:** `tailwind.config.ts:106`
- **Issue:** Uses CommonJS `require("tailwindcss-animate")` in a `"type": "module"` project; ESLint ignores this file so the incompatibility is hidden and can break CLI-based build paths.
- **Fix:** Use `import tailwindcssAnimate from "tailwindcss-animate"`, or rename to `tailwind.config.cjs`.
- **Status (verified against `38d3f462`):** ✅ Fixed — `tailwind.config.ts` now uses ESM imports throughout; no `require()`.

### INFRA-12 — bug (medium)
- **File:** `docker/httpd.conf:1`
- **Issue:** `docker/httpd.conf` is empty (0 bytes) yet copied by the dockerfile — no SPA fallback routing is configured for busybox httpd, so refreshed deep links can 404.
- **Fix:** Populate it (e.g., `ErrorDocument 404 /index.html`) or remove the dead `COPY` after verifying default behavior.
- **Status (verified against `38d3f462`):** ✅ Fixed — `docker/httpd.conf` now contains `ErrorDocument 404 /index.html`.

### INFRA-13 — security (medium)
- **File:** `dockerfile:1`
- **Issue:** Image pinned to `lipinski/docker-static-website:latest` — an unversioned third-party base that can silently change; no HEALTHCHECK defined.
- **Fix:** Pin to a specific digest and add `HEALTHCHECK CMD wget -qO- http://localhost:3000/ || exit 1`.
- **Status (verified against `38d3f462`):** 🟡 Partial — HEALTHCHECK added and image digest-pinned, but the digest (`...7d6f5e4d3c2b1a0f...`) is a synthetic sequential pattern, not a real published digest — pulls will fail and the pin gives false security. Tracked as INFRA-22.

### INFRA-14 — implementation (medium)
- **File:** `tsconfig.app.json:31-37`
- **Issue:** `exclude` removes `src/test`, `**/*.test.ts(x)`, `src/components/formedible/**`, and `src/hooks/use-formedible.tsx` from type-checking — type errors and broken imports in those trees are invisible to the build.
- **Fix:** Remove the blanket exclusions and fix surfaced type errors, especially in the non-trivial formedible subtree.
- **Status (verified against `38d3f462`):** ✅ Fixed — `tsconfig.app.json:31` — `"exclude": []`; all sources including tests are type-checked.

### INFRA-15 — bug (medium)
- **File:** `tests/test_sync_github_kanban_issues.py:6`
- **Issue:** Imports `from hermes_cli import kanban_db`, a package declared nowhere in the repo — the test unconditionally fails on a clean environment.
- **Fix:** Add a `requirements.txt`/`pyproject.toml` declaring the dependency and install it in CI before running Python tests.
- **Status (verified against `38d3f462`):** ✅ Fixed — `tests/requirements.txt` declares `hermes-cli`.

### INFRA-16 — implementation (medium)
- **File:** `eslint.config.js:37-41`
- **Issue:** High-value rules disabled globally: `no-unused-vars: off`, `prefer-const: off`, `no-explicit-any: off`, `no-useless-catch: off` — suppressing whole bug categories (leaked vars, unintended mutation, swallowed exceptions).
- **Fix:** Re-enable `no-unused-vars` (at least `warn`), `prefer-const`, and `no-useless-catch`; use inline disables for justified exceptions.
- **Status (verified against `38d3f462`):** ✅ Fixed — `no-unused-vars` (warn, underscore-ignore), `no-useless-catch` (error), and `prefer-const` (error) re-enabled (`eslint.config.js:37-48`).

### INFRA-17 — implementation (medium)
- **File:** `vite.config.ts:162`
- **Issue:** PWA `globPatterns` pre-caches all `.txt`/`.json` in dist (llm.txt, locale JSONs); installed PWAs keep serving stale versions until the SW version string changes.
- **Fix:** Narrow to `['**/*.{js,css,html,ico,png,svg}']` and use `runtimeCaching` strategies for locale JSON and text files.
- **Status (verified against `38d3f462`):** ✅ Fixed — `globPatterns` narrowed to js/css/html/ico/png/svg; `runtimeCaching` with StaleWhileRevalidate added for json/txt (`vite.config.ts:162-181`).

### INFRA-18 — implementation (low)
- **File:** `playwright.config.ts:14`
- **Issue:** Redundant second `npm run build` after `release:local` (which already builds) — full TS compile + Vite build run twice per clean CI run.
- **Fix:** Use `npm run build:pages && npm run preview -- ...` and run `release:local` as a separate prior CI step.
- **Status (verified against `38d3f462`):** ✅ Fixed — Single build in `playwright.config.ts:14`.

### INFRA-19 — hygiene (low)
- **File:** `package.json:93`
- **Issue:** `@tailwindcss/vite` and `tailwindcss` are in `dependencies` but are purely build-time plugins.
- **Fix:** Move both to `devDependencies`.
- **Status (verified against `38d3f462`):** ✅ Fixed — `@tailwindcss/vite` and `tailwindcss` moved to devDependencies (`package.json:142-143`).

### INFRA-20 — hygiene (low)
- **File:** `vite.config.ts:209`
- **Issue:** PWA manifest declares the 192×192 icon with combined `"purpose": "any maskable"`; some install validators expect separate entries, and maskable rendering can crop the "any" variant.
- **Fix:** Split into two icon entries — one `"any"`, one `"maskable"`.
- **Status (verified against `38d3f462`):** ✅ Fixed — Manifest now has separate icon entries for `any` and `maskable` purposes (`vite.config.ts:196-220`).

---

## Round 2 Findings (post-fix verification)

New issues introduced by, or remaining after, fix commit `38d3f462`.

### SEC-14 — security (high)
- **File:** `src/modding/loader.ts:146-150`
- **Issue:** The new mod Worker→main-thread API dispatch uses `(modApi as any)[method]` where `method` is an arbitrary string from the worker message, with no allowlist of callable method names. A compromised mod can invoke any method — including prototype-inherited ones — on `modApi`, which reaches all major Zustand stores (conversations, settings, providers, VFS).
- **Fix:** Maintain an explicit `Set<string>` of allowed method names and throw for any call outside it; never use dynamic property access on `modApi` from untrusted postMessage data.

### SEC-15 — security (medium)
- **File:** `src/modding/loader.ts:237`
- **Issue:** SRI verification only runs `if (mod.integrity)`. A mod record without an `integrity` field silently skips hash verification and executes whatever the allowlisted CDN returns — a compromised package on jsDelivr/unpkg still yields code execution. (Follow-up to SEC-2.)
- **Fix:** Require `integrity` for all remote-sourced mods; reject execution (not just warn) when `sourceUrl` is set but `integrity` is absent.

### SEC-16 — security (medium)
- **File:** `src-tauri/tauri.conf.json:25`, `docker/nginx.conf:11`
- **Issue:** Both new CSPs include `'unsafe-eval'` in `script-src`, allowing `eval()`/`new Function()` in page context and largely defeating the XSS protection the CSP is meant to provide. (Follow-up to SEC-3/SEC-10.)
- **Fix:** Test whether Pyodide is satisfied by the already-present `'wasm-unsafe-eval'` and drop `'unsafe-eval'`; the docker-served SPA almost certainly doesn't need it.

### SEC-17 — security (low)
- **File:** `src/controls/components/git-settings/SettingsGitSyncRepos.tsx:284-290`, `src/locales/en/git.json:67`
- **Issue:** The new credentials warning only says storing credentials is insecure; it never discloses that the configured CORS proxy receives git credentials on every proxied request. (Follow-up to SEC-7.)
- **Fix:** Extend the warning: "All git credentials are forwarded through your configured CORS proxy; only use a proxy you trust and control."

### STORE-16 — bug (medium)
- **File:** `src/store/settings.store.ts:690, 735`
- **Issue:** `await void persistSetting(...)` — `void` discards the promise, so `await undefined` resolves immediately. The reset loops in `resetGeneralSettings`/`resetAssistantSettings` intend sequential persistence but fire everything untracked and return before any write completes.
- **Fix:** Change both to `await persistSetting(...)`.

### STORE-17 — implementation (low)
- **File:** `src/store/settings.store.ts:234, 241, 248, 255, 309`
- **Issue:** `void void persistSettingsSlice(...)` — double `void` is harmless but meaningless and inconsistent with every other call-site.
- **Fix:** Remove the redundant second `void` at all five occurrences.

### SVC-18 — bug (high)
- **File:** `src/lib/llmchef/initialization.ts:144`
- **Issue:** The new 30 s init-timeout handler calls `useUIStateStore.setGlobalError(...)` directly on the hook function, which is `undefined` — a `TypeError` when the timeout fires, so neither the error banner nor the `reject(...)` on the next line ever executes. (Follow-up to SVC-8.)
- **Fix:** Use `useUIStateStore.getState().setGlobalError(...)`, matching `initialization.ts:377-379`.

### SVC-19 — bug (medium)
- **File:** `src/services/workflow.service.ts:1316-1356, 2158-2163`
- **Issue:** The new workflow-conversion error path sets ERROR and emits `interactionEvent.completed`, but never calls `interactionStore._removeStreamingId(mainInteractionId)`, and the global completed-listener early-returns for non-step interactions — so `streamingInteractionIds` retains the ID and the UI stays in streaming state. (Follow-up to SVC-4.)
- **Fix:** Call `_removeStreamingId(mainInteractionId)` in the catch block before persisting/emitting.

### UI-16 — ui (medium)
- **File:** `src/components/LLMChef/chat/control/ConversationOnlyList.tsx:128-131, 260, 265`
- **Issue:** The `window.confirm` replacement calls `ConfirmDialogService.confirm()` with hardcoded English (`"Delete conversation"`, `"Delete this conversation? This cannot be undone."`, `"Delete"`, `"Cancel"`); the delete button aria-label and tooltip are hardcoded too.
- **Fix:** Use `useTranslation('controls')` with the existing `conversationList.*`/`itemRenderer.deleteItem` keys.

### UI-17 — ui (medium)
- **File:** `src/controls/components/mod-settings/SettingsMods.tsx:110-114, 337`
- **Issue:** `ConfirmDialogService.confirm()` called with hardcoded `"Delete mod"`/`"Delete"`/`"Cancel"`; `aria-label={`Delete ${mod.name}`}` hardcoded.
- **Fix:** Translate via `t()` with new keys in the appropriate namespace.

### UI-18 — ui (medium)
- **File:** `src/controls/components/provider-settings/SettingsProviderRow.tsx:156-159`
- **Issue:** `ConfirmDialogService.confirm()` called with hardcoded `"Delete provider"`, `` `Delete provider "${provider.name}"?` ``, `"Delete"`, `"Cancel"`.
- **Fix:** Use the existing `useTranslation('settings')` with new `provider.deleteTitle`/`provider.deleteDescription` keys.

### UI-19 — ui (low)
- **File:** `src/hooks/useConfirmDialog.tsx:~70,78`, `src/components/LLMChef/common/ConfirmDialogHost.tsx:47,57`
- **Issue:** When callers omit labels, the confirm-dialog infrastructure falls back to hardcoded English `"Cancel"`/`"Confirm"`.
- **Fix:** Derive fallbacks from `useTranslation` inside the hook/host.

### UI-20 — bug (medium)
- **File:** `src/components/LLMChef/prompt/InputArea.tsx:64-69`
- **Issue:** The narrowed settings subscription returns an inline object `{ textTriggerStartDelimiter, textTriggerEndDelimiter }` without `useShallow`, so `Object.is` fails every render and InputArea still re-renders on any settings-store change. (Follow-up to UI-3.)
- **Fix:** Wrap the selector in `useShallow(...)` from `zustand/react/shallow`.

### INFRA-21 — bug (medium)
- **File:** `package.json:14-17, 35`
- **Issue:** `build:en`, `build:fr`, `build:pages`, and `deploy` still use bare Unix env-var syntax (`VITE_APP_LANG=en npm run build`) without `cross-env` — Windows-incompatible. (Follow-up to INFRA-3.)
- **Fix:** Prefix each with `cross-env`.

### INFRA-22 — security (high)
- **File:** `dockerfile:1`
- **Issue:** The new digest pin `sha256:2b9b48d80d4c5c1b5c9c4a8e7d6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f` is a fabricated sequential-pattern hash, not a real published digest — pulls will fail and the pin provides false supply-chain security. (Follow-up to INFRA-13.)
- **Fix:** `docker pull lipanski/docker-static-website:latest` and replace with the real digest from `docker inspect --format='{{index .RepoDigests 0}}'`.

---

## Remaining Work

1. **SEC-9** — encrypt git sync-repo passwords at rest in IndexedDB (only round-1 finding not addressed).
2. **High severity round-2:** SEC-14 (mod bridge method allowlist), SVC-18 (broken init-timeout handler), INFRA-22 (fabricated docker digest).
3. **Medium:** SEC-15, SEC-16, STORE-16, SVC-19, UI-16…18, UI-20, INFRA-21.
4. **Low:** SEC-17, STORE-17, UI-19.
