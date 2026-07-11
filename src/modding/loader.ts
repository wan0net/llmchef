// src/modding/loader.ts
// FULL FILE
import {
  type DbMod,
  type ModInstance,
  type LLMChefModApi,
} from "@/types/llmchef/modding";
import { modEvent } from "@/types/llmchef/events/mod.events";
import { appEvent } from "@/types/llmchef/events/app.events";
import { createModApi } from "./api-factory";
import { toast } from "sonner";
import { emitter } from "@/lib/llmchef/event-emitter";
import { assertAllowedOutboundUrl } from "@/lib/llmchef/outbound-policy";

interface WorkerApiCallMessage {
  type: "apiCall";
  callId: string;
  method: string;
  args: unknown[];
}

interface WorkerEmitMessage {
  type: "emit";
  eventName: string;
  payload: unknown;
}

interface WorkerShowToastMessage {
  type: "showToast";
  toastType: "success" | "info" | "warning" | "error";
  message: string;
}

interface WorkerLogMessage {
  type: "log";
  level: "log" | "warn" | "error" | "info" | "debug";
  args: unknown[];
}

type WorkerMessage =
  | { type: "completed" }
  | { type: "error"; error: string }
  | WorkerApiCallMessage
  | WorkerEmitMessage
  | WorkerShowToastMessage
  | WorkerLogMessage
  | { type: "toolExecute"; toolCallId: string; toolName: string; params: unknown }
  | { type: "toolExecuteResult"; toolCallId: string; result?: unknown; error?: string };

const MOD_WORKER_URL = new URL("./mod-worker.ts", import.meta.url);

// Allowlist of trusted origins for remote mod scripts. Sub-resource integrity
// (SRI) is enforced whenever `mod.integrity` is provided.
const MOD_SOURCE_URL_ALLOWLIST: string[] = [
  "https://cdn.jsdelivr.net",
  "https://unpkg.com",
  "https://raw.githubusercontent.com",
  "https://gist.githubusercontent.com",
];

// Explicit allowlist of callable methods on the mod API surface. Never invoke
// an arbitrary method name received from a worker message.
const MOD_API_METHOD_ALLOWLIST = new Set<string>([
  "registerPromptControl",
  "registerChatControl",
  "registerCanvasControl",
  "registerSelectionControl",
  "registerBlockRenderer",
  "registerRule",
  "registerTool",
  "on",
  "emit",
  "addMiddleware",
  "registerSettingsTab",
  "getContextSnapshot",
  "showToast",
  "log",
  "registerModalProvider",
  "getVfsInstance",
]);

function isAllowedModSourceUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return MOD_SOURCE_URL_ALLOWLIST.some((allowed) => {
      if (allowed.includes(":")) {
        return url.origin.toLowerCase() === allowed.toLowerCase();
      }
      return url.hostname.toLowerCase() === allowed.toLowerCase();
    });
  } catch {
    return false;
  }
}

async function verifySubresourceIntegrity(
  content: string,
  integrity: string
): Promise<boolean> {
  const match = integrity.trim().match(/^sha384-(.+)$/);
  if (!match) {
    console.warn("[ModLoader] Unsupported integrity format:", integrity);
    return false;
  }
  const expectedBase64 = match[1];
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const digest = await crypto.subtle.digest("SHA-384", data);
  const actualBase64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return actualBase64 === expectedBase64;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function computeModIntegrity(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const digest = await crypto.subtle.digest("SHA-384", data);
  return `sha384-${arrayBufferToBase64(digest)}`;
}

async function executeModInWorker(
  mod: DbMod,
  scriptContent: string,
  modApi: LLMChefModApi
): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(MOD_WORKER_URL, { type: "module", name: `llmchef-mod-${mod.id}` });
    const pendingToolCalls = new Map<string, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>();
    let toolCallCounter = 0;

    const handleMessage = async (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (!message || typeof message !== "object") return;

      switch (message.type) {
        case "completed":
          worker.terminate();
          resolve();
          break;
        case "error":
          worker.terminate();
          reject(new Error(message.error));
          break;
        case "apiCall": {
          const { callId, method, args } = message;
          try {
            if (method === "registerTool") {
              const [toolName, definition] = args as [string, any];
              const wrapperImplementation = async (params: unknown) => {
                const toolCallId = `tool-${++toolCallCounter}`;
                return new Promise<unknown>((toolResolve, toolReject) => {
                  pendingToolCalls.set(toolCallId, { resolve: toolResolve, reject: toolReject });
                  worker.postMessage({ type: "toolExecute", toolCallId, toolName, params });
                });
              };
              const result = await modApi.registerTool(toolName, definition, wrapperImplementation as any);
              worker.postMessage({ type: "apiCallResult", callId, result });
            } else {
              if (!MOD_API_METHOD_ALLOWLIST.has(method)) {
                throw new Error(`Disallowed mod API method: ${method}`);
              }
              const methodFn = (modApi as any)[method];
              if (typeof methodFn !== "function") {
                throw new Error(`Unknown mod API method: ${method}`);
              }
              const result = await methodFn.apply(modApi, args);
              worker.postMessage({ type: "apiCallResult", callId, result });
            }
          } catch (error) {
            worker.postMessage({
              type: "apiCallResult",
              callId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
          break;
        }
        case "emit": {
          const eventName = message.eventName as any;
          emitter.emit(eventName, message.payload as any);
          break;
        }
        case "showToast":
          toast[message.toastType](`[Mod: ${mod.name}] ${message.message}`);
          break;
        case "log": {
          const prefix = `[Mod: ${mod.name}]`;
          if (message.level === "error") console.error(prefix, ...message.args);
          else if (message.level === "warn") console.warn(prefix, ...message.args);
          else if (message.level === "info") console.info(prefix, ...message.args);
          else console.log(prefix, ...message.args);
          break;
        }
        case "toolExecuteResult": {
          const pending = pendingToolCalls.get(message.toolCallId);
          if (!pending) return;
          pendingToolCalls.delete(message.toolCallId);
          if (message.error) {
            pending.reject(new Error(message.error));
          } else {
            pending.resolve(message.result);
          }
          break;
        }
      }
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", (errorEvent) => {
      worker.terminate();
      reject(errorEvent.error ?? new Error("Mod worker error"));
    });

    worker.postMessage({
      type: "execute",
      modId: mod.id,
      modName: mod.name,
      scriptContent,
    });
  });
}

export async function loadMods(dbMods: DbMod[]): Promise<ModInstance[]> {
  const enabledMods = dbMods.filter((mod) => mod.enabled);
  const instances = await Promise.all(
    enabledMods.map(async (mod): Promise<ModInstance> => {
      let scriptContent = mod.scriptContent,
        modApi: LLMChefModApi | null = null,
        instanceError: Error | string | null = null;
      try {
        modApi = createModApi(mod);
        if (mod.sourceUrl) {
          console.log(
            `[ModLoader] Fetching script for ${mod.name} from ${mod.sourceUrl}`
          );
          try {
            if (!isAllowedModSourceUrl(mod.sourceUrl)) {
              throw new Error(
                `Mod source URL is not on the allowlist: ${mod.sourceUrl}`
              );
            }
            if (!mod.integrity) {
              throw new Error(
                `Remote mod "${mod.name}" is missing a Subresource Integrity (integrity) hash. Execution rejected.`
              );
            }
            const sourceUrl = assertAllowedOutboundUrl(
              mod.sourceUrl,
              `mod:script:${mod.name}`,
            );
            const response = await fetch(sourceUrl);
            if (!response.ok) {
              throw new Error(
                `Failed to fetch mod script: ${response.status} ${response.statusText}`
              );
            }
            scriptContent = await response.text();
            const valid = await verifySubresourceIntegrity(scriptContent, mod.integrity);
            if (!valid) {
              throw new Error(
                `Mod script integrity check failed for ${mod.name}. The fetched script does not match the configured SRI hash.`
              );
            }
            console.log(`[ModLoader] SRI verified for ${mod.name}`);
            console.log(
              `[ModLoader] Successfully fetched script for ${mod.name}`
            );
          } catch (fetchError) {
            console.error("[ModLoader] Error fetching script from ", mod.sourceUrl, ":",
              fetchError
            );
            throw fetchError;
          }
        }
        if (!scriptContent) throw new Error("Mod script content is empty.");

        await executeModInWorker(mod, scriptContent, modApi);
        console.log(`[ModLoader] Successfully executed script for ${mod.name}`);
      } catch (e) {
        instanceError = e instanceof Error ? e : String(e);
        console.error("[ModLoader] Error loading mod \"", mod.name, "\":", e);
        toast.error(
          `Error loading mod "${mod.name}": ${
            instanceError instanceof Error
              ? instanceError.message
              : instanceError
          }`
        );
      }

      if (!modApi) modApi = createModApi(mod);

      const instance: ModInstance = {
        id: mod.id,
        name: mod.name,
        api: modApi,
        error: instanceError,
      };

      if (instance.error) {
        emitter.emit(modEvent.modError, {
          id: mod.id,
          name: mod.name,
          error: instance.error instanceof Error ? instance.error.message : String(instance.error),
        });
      } else {
        emitter.emit(modEvent.modLoaded, {
          id: mod.id,
          name: mod.name,
        });
      }

      return instance;
    })
  );

  emitter.emit(appEvent.loaded, undefined);
  console.log(`[ModLoader] Finished processing ${instances.length} mods.`);
  return instances;
}
