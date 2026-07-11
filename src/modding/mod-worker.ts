// src/modding/mod-worker.ts
// Dedicated Web Worker for sandboxed mod script execution.
// The script receives a proxy modApi; all API calls are serialized via postMessage.

import type { LLMChefModApi } from "@/types/llmchef/modding";

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

const pendingCalls = new Map<string, PendingCall>();
let callCounter = 0;

function nextCallId(): string {
  callCounter += 1;
  return `mod-call-${callCounter}`;
}

function postApiCall(method: string, args: unknown[]): Promise<unknown> {
  const callId = nextCallId();
  return new Promise((resolve, reject) => {
    pendingCalls.set(callId, { resolve, reject });
    self.postMessage({ type: "apiCall", callId, method, args });
  });
}

const toolImplementations = new Map<string, (params: unknown) => Promise<unknown>>();
const localCleanups = new Map<string, () => void>();

self.onmessage = (event: MessageEvent) => {
  const message = event.data;
  if (!message || typeof message !== "object") return;

  switch (message.type) {
    case "apiCallResult": {
      const pending = pendingCalls.get(message.callId);
      if (!pending) return;
      pendingCalls.delete(message.callId);
      if (message.error) {
        pending.reject(message.error);
      } else {
        pending.resolve(message.result);
      }
      break;
    }
    case "toolExecute": {
      const impl = toolImplementations.get(message.toolName);
      if (!impl) {
        self.postMessage({
          type: "toolExecuteResult",
          toolCallId: message.toolCallId,
          error: `Tool ${message.toolName} not found in worker`,
        });
        return;
      }
      Promise.resolve(impl(message.params))
        .then((result) =>
          self.postMessage({
            type: "toolExecuteResult",
            toolCallId: message.toolCallId,
            result,
          })
        )
        .catch((error) =>
          self.postMessage({
            type: "toolExecuteResult",
            toolCallId: message.toolCallId,
            error: error instanceof Error ? error.message : String(error),
          })
        );
      break;
    }
    case "execute": {
      const scriptContent: string = message.scriptContent ?? "";
      const modId: string = message.modId ?? "unknown";
      const modName: string = message.modName ?? "unknown";
      try {
        const proxyApi: LLMChefModApi = {
          modId,
          modName,
          registerPromptControl: (control) => {
            if (control.renderer || control.triggerRenderer) {
              console.warn("[ModWorker] React renderers in worker mods are not supported; control id:", control.id);
            }
            return () => postApiCall("unregisterPromptControl", [{ id: control.id }]);
          },
          registerChatControl: (control) => {
            if (control.renderer || control.iconRenderer || control.settingsRenderer) {
              console.warn("[ModWorker] React renderers in worker mods are not supported; control id:", control.id);
            }
            return () => postApiCall("unregisterChatControl", [{ id: control.id }]);
          },
          registerCanvasControl: (control) => {
            if (control.renderer) {
              console.warn("[ModWorker] React renderers in worker mods are not supported; control id:", control.id);
            }
            return () => postApiCall("unregisterCanvasControl", [{ id: control.id }]);
          },
          registerSelectionControl: (control) => {
            if (control.renderer) {
              console.warn("[ModWorker] React renderers in worker mods are not supported; control id:", control.id);
            }
            return () => postApiCall("unregisterSelectionControl", [{ id: control.id }]);
          },
          registerBlockRenderer: (renderer) => {
            console.warn("[ModWorker] Block renderers in worker mods are not supported; renderer id:", renderer.id);
            return () => {};
          },
          registerRule: (rule) => {
            return () => postApiCall("unregisterRule", [{ id: rule.id }]);
          },
          registerTool: async (toolName, definition, implementation) => {
            if (implementation) {
              toolImplementations.set(toolName, (params) => Promise.resolve(implementation(params as any, {} as any)));
            }
            await postApiCall("registerTool", [toolName, definition]);
            return () => {
              toolImplementations.delete(toolName);
              postApiCall("unregisterTool", [{ toolName }]);
            };
          },
          on: (eventName, callback) => {
            const handler = (event: MessageEvent) => {
              const msg = event.data;
              if (msg?.type === "event" && msg.eventName === eventName) {
                callback(msg.payload);
              }
            };
            self.addEventListener("message", handler);
            return () => self.removeEventListener("message", handler);
          },
          emit: (eventName, payload) => {
            self.postMessage({ type: "emit", eventName, payload });
          },
          addMiddleware: (hookName, _callback) => {
            const id = `${hookName}-${nextCallId()}`;
            localCleanups.set(id, () => postApiCall("unregisterMiddleware", [{ hookName, modId }]));
            return () => {
              const cleanup = localCleanups.get(id);
              if (cleanup) {
                cleanup();
                localCleanups.delete(id);
              }
            };
          },
          registerSettingsTab: (tab) => {
            console.warn("[ModWorker] Settings tabs in worker mods are not supported; tab id:", tab.id);
            return () => {};
          },
          getContextSnapshot: () =>
            postApiCall("getContextSnapshot", []) as Promise<any>,
          showToast: (type, message) => {
            self.postMessage({ type: "showToast", toastType: type, message });
          },
          log: (level, ...args) => {
            self.postMessage({ type: "log", level, args });
          },
          registerModalProvider: (modalId) => {
            console.warn("[ModWorker] Modal providers in worker mods are not supported; modal id:", modalId);
            return () => {};
          },
          getVfsInstance: (vfsKey) =>
            postApiCall("getVfsInstance", [vfsKey]) as Promise<any>,
        };

        const modFunction = new Function("modApi", scriptContent);
        modFunction(proxyApi);
        self.postMessage({ type: "completed" });
      } catch (error) {
        self.postMessage({
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
      break;
    }
  }
};
