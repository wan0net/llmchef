import { init, parse } from "es-module-lexer";
import { APP_VFS_KEY } from "./constants";
import { assertAllowedOutboundUrl, getOutboundHost } from "./outbound-policy";
import { normalizePath } from "./file-manager-utils";
import type {
  McpPackageImport,
  McpPackageRuntimeInstall,
} from "@/types/llmchef/mcp";

export interface McpJsRuntimeInstallOptions {
  registryBaseUrl: string;
  packageImport: McpPackageImport;
  maxModules?: number;
  fetchImpl?: typeof fetch;
}

export interface McpJsRuntimeSmokeResult {
  ok: boolean;
  messages: string[];
}

export interface McpJsRuntimeToolProbeResult {
  ok: boolean;
  tools: string[];
  messages: string[];
}

export interface McpJsRuntimeSession {
  worker: Worker;
  sendLine: (line: string) => void;
  dispose: () => void;
}

interface McpJsRuntimeWorkerHandle {
  worker: Worker;
  dispose: () => void;
}

interface ModuleRecord {
  url: string;
  code: string;
  imports: string[];
}

type VfsRuntime = {
  fsInstance: {
    promises: {
      readdir: (path: string) => Promise<string[]>;
    };
  };
  readFileOp: (path: string, options: { fsInstance: unknown; silent?: boolean }) => Promise<Uint8Array>;
  writeFileOp: (path: string, content: string, options: { fsInstance: unknown }) => Promise<void>;
};

const DEFAULT_MAX_MODULES = 80;
const MCP_PACKAGE_CACHE_ROOT = "/packages/mcp";
const HTTP_URL_PATTERN = /^https?:\/\//i;
const UNSUPPORTED_SPECIFIER_PATTERN = /^(node:|data:|blob:)/i;

const loadOutboundFetchGuard = async (): Promise<{
  withTransientAllowedOutboundHost: (
    host: string,
    callback: () => Promise<Map<string, ModuleRecord>>,
  ) => Promise<Map<string, ModuleRecord>>;
}> => import("@/services/outbound-fetch-guard.service");

const loadVfsRuntime = async (): Promise<VfsRuntime> => {
  const [{ useVfsStore }, { readFileOp, writeFileOp }] = await Promise.all([
    import("@/store/vfs.store"),
    import("./vfs-operations"),
  ]);
  const fsInstance = await useVfsStore.getState().initializeVFS(APP_VFS_KEY, { force: true });
  return { fsInstance, readFileOp, writeFileOp };
};

export const packageSpecToEsmPath = (packageName: string): string => {
  const trimmed = packageName.trim();
  const githubMatch = trimmed.match(/^(?:github:|gh:)([^/\s]+\/[^#?\s]+)(.*)$/i);
  if (githubMatch) {
    return `gh/${githubMatch[1]}${githubMatch[2] ?? ""}`;
  }
  return trimmed;
};

export const buildEsmPackageEntryUrl = (
  registryBaseUrl: string,
  packageName: string,
): string => {
  const base = registryBaseUrl.endsWith("/") ? registryBaseUrl : `${registryBaseUrl}/`;
  const url = new URL(packageSpecToEsmPath(packageName), base);
  url.searchParams.set("bundle", "");
  url.searchParams.set("target", "es2022");
  url.searchParams.set("platform", "browser");
  return url.toString();
};

export const resolveEsmImportSpecifier = (
  specifier: string,
  importerUrl: string,
  registryBaseUrl: string,
): string | null => {
  if (!specifier || UNSUPPORTED_SPECIFIER_PATTERN.test(specifier)) return null;
  if (HTTP_URL_PATTERN.test(specifier)) return new URL(specifier).toString();

  const importer = new URL(importerUrl);
  if (specifier.startsWith("/")) {
    return new URL(specifier, importer.origin).toString();
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return new URL(specifier, importer).toString();
  }

  const base = registryBaseUrl.endsWith("/") ? registryBaseUrl : `${registryBaseUrl}/`;
  return new URL(specifier, base).toString();
};

export const rewriteEsmImports = (
  code: string,
  replacements: Map<string, string>,
): string => {
  const [imports] = parse(code);
  let rewritten = code;
  for (const item of [...imports].reverse()) {
    if (!item.n || !replacements.has(item.n)) continue;
    rewritten = `${rewritten.slice(0, item.s)}${replacements.get(item.n)}${rewritten.slice(item.e)}`;
  }
  return rewritten;
};

export const verifyMcpModuleLock = async (
  url: string,
  code: string,
  expectedHash: string | undefined,
): Promise<void> => {
  if (!expectedHash) {
    throw new Error(`Installed MCP module is missing a lock hash: ${url}`);
  }
  const actualHash = await sha256Hex(code);
  if (actualHash !== expectedHash) {
    throw new Error(`Installed MCP module lock mismatch for ${url}. Reinstall the package before running it.`);
  }
};

export const installMcpJsRuntimePackage = async (
  options: McpJsRuntimeInstallOptions,
): Promise<McpPackageRuntimeInstall> => {
  const registryBaseUrl = normalizeMcpPackageRegistryBaseUrl(options.registryBaseUrl);
  const entryUrl = buildEsmPackageEntryUrl(registryBaseUrl, options.packageImport.packageName);
  const registryHost = getOutboundHost(registryBaseUrl);
  const { withTransientAllowedOutboundHost } = await loadOutboundFetchGuard();
  const modules = await withTransientAllowedOutboundHost(registryHost, () =>
    fetchModuleGraph({
      entryUrl,
      registryBaseUrl,
      maxModules: options.maxModules ?? DEFAULT_MAX_MODULES,
      fetchImpl: options.fetchImpl ?? fetch,
    }),
  );

  const installId = await stableInstallId(options.packageImport.packageName, entryUrl);
  const vfsRoot = normalizePath(`${MCP_PACKAGE_CACHE_ROOT}/${installId}`);
  const { fsInstance, writeFileOp } = await loadVfsRuntime();
  const moduleHashes: Record<string, string> = {};
  for (const moduleRecord of modules.values()) {
    moduleHashes[moduleRecord.url] = await sha256Hex(moduleRecord.code);
  }
  const manifest: McpPackageRuntimeInstall = {
    id: installId,
    packageImportId: options.packageImport.id,
    packageName: options.packageImport.packageName,
    entryUrl,
    registryBaseUrl,
    vfsRoot,
    moduleCount: modules.size,
    moduleUrls: [...modules.keys()].sort(),
    moduleHashes,
    installedAt: new Date(),
    runnable: true,
    warnings: [
      "Installed through the browser ESM shim. Node-only APIs remain unavailable.",
      "Runtime execution happens in a Worker with child workers and network APIs disabled by default.",
    ],
  };

  for (const moduleRecord of modules.values()) {
    const path = modulePathForUrl(vfsRoot, moduleRecord.url);
    await writeFileOp(path, moduleRecord.code, { fsInstance });
  }
  await writeFileOp(`${vfsRoot}/manifest.json`, JSON.stringify(manifest, null, 2), { fsInstance });
  return manifest;
};

export const smokeTestMcpJsRuntimePackage = async (
  install: McpPackageRuntimeInstall,
  timeoutMs = 5000,
): Promise<McpJsRuntimeSmokeResult> => {
  const { fsInstance, readFileOp } = await loadVfsRuntime();
  const manifestBytes = await readFileOp(`${install.vfsRoot}/manifest.json`, { fsInstance, silent: true });
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as McpPackageRuntimeInstall;
  const moduleGraph = await readInstalledModuleGraph(manifest);
  const runtime = await createMcpJsRuntimeWorker(manifest, moduleGraph);
  const messages: string[] = [];

  try {
    return await new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        resolve({ ok: false, messages: [...messages, "Worker timed out while importing package."] });
      }, timeoutMs);

      runtime.worker.onmessage = (event: MessageEvent<{ type: string; message?: string }>) => {
        if (event.data?.message) messages.push(event.data.message);
        if (event.data?.type === "ready") {
          window.clearTimeout(timeout);
          resolve({ ok: true, messages });
        }
        if (event.data?.type === "error") {
          window.clearTimeout(timeout);
          resolve({ ok: false, messages });
        }
      };

      runtime.worker.onerror = (event) => {
        window.clearTimeout(timeout);
        resolve({ ok: false, messages: [...messages, event.message] });
      };
    });
  } finally {
    runtime.dispose();
  }
};

/**
 * Start a sandboxed MCP JS runtime session.
 *
 * IMPORTANT: Callers MUST wrap usage in `try { ... } finally { session.dispose() }`
 * to avoid leaking the Worker and blob URLs. An optional AbortSignal and/or
 * auto-dispose timeout can be provided as a safety net.
 */
export const startMcpJsRuntimeSession = async (
  install: McpPackageRuntimeInstall,
  options?: { signal?: AbortSignal; autoDisposeMs?: number },
): Promise<McpJsRuntimeSession> => {
  const { fsInstance, readFileOp } = await loadVfsRuntime();
  const manifestBytes = await readFileOp(`${install.vfsRoot}/manifest.json`, { fsInstance, silent: true });
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as McpPackageRuntimeInstall;
  const moduleGraph = await readInstalledModuleGraph(manifest);
  const runtime = await createMcpJsRuntimeWorker(manifest, moduleGraph);

  let autoDisposeTimeout: ReturnType<typeof setTimeout> | null = null;
  const dispose = () => {
    if (autoDisposeTimeout) {
      clearTimeout(autoDisposeTimeout);
      autoDisposeTimeout = null;
    }
    options?.signal?.removeEventListener("abort", dispose);
    runtime.dispose();
  };

  if (options?.signal) {
    if (options.signal.aborted) {
      dispose();
      throw new Error("MCP JS runtime session aborted before start");
    }
    options.signal.addEventListener("abort", dispose);
  }

  if (options?.autoDisposeMs && options.autoDisposeMs > 0) {
    autoDisposeTimeout = setTimeout(dispose, options.autoDisposeMs);
  }

  return {
    worker: runtime.worker,
    sendLine: (line: string) => runtime.worker.postMessage({ type: "stdin", chunk: `${line.replace(/\n$/, "")}\n` }),
    dispose,
  };
};

export const probeMcpJsRuntimeTools = async (
  install: McpPackageRuntimeInstall,
  timeoutMs = 7000,
): Promise<McpJsRuntimeToolProbeResult> => {
  const session = await startMcpJsRuntimeSession(install);
  const messages: string[] = [];
  const responses = new Map<number, any>();
  let initialized = false;
  let toolsListRequested = false;

  try {
    return await new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        resolve({
          ok: false,
          tools: [],
          messages: [...messages, "MCP tool probe timed out."],
        });
      }, timeoutMs);

      const finish = (result: McpJsRuntimeToolProbeResult) => {
        window.clearTimeout(timeout);
        resolve(result);
      };

      session.worker.onmessage = (event: MessageEvent<{ type: string; message?: string }>) => {
        const message = event.data?.message ?? "";
        if (message) messages.push(message);
        if (event.data?.type === "error") {
          finish({ ok: false, tools: [], messages });
          return;
        }
        if (event.data?.type === "ready" && !initialized) {
          initialized = true;
          session.sendLine(JSON.stringify(createMcpInitializeRequest()));
          return;
        }
        if (event.data?.type !== "stdio") return;

        for (const parsed of parseJsonRpcLines(message)) {
          if (typeof parsed?.id === "number") responses.set(parsed.id, parsed);
        }

        if (responses.has(1) && !toolsListRequested) {
          toolsListRequested = true;
          session.sendLine(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }));
          session.sendLine(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }));
          return;
        }

        const toolsResponse = responses.get(2);
        if (toolsResponse) {
          if (toolsResponse.error) {
            finish({
              ok: false,
              tools: [],
              messages: [...messages, `tools/list failed: ${toolsResponse.error.message ?? "unknown error"}`],
            });
            return;
          }
          const tools = normalizeToolNames(toolsResponse.result?.tools);
          finish({
            ok: true,
            tools,
            messages: tools.length > 0 ? messages : [...messages, "MCP tools/list returned no tools."],
          });
        }
      };
    });
  } finally {
    session.dispose();
  }
};

export const parseJsonRpcLines = (text: string): any[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);


const fetchModuleGraph = async ({
  entryUrl,
  registryBaseUrl,
  maxModules,
  fetchImpl,
}: {
  entryUrl: string;
  registryBaseUrl: string;
  maxModules: number;
  fetchImpl: typeof fetch;
}): Promise<Map<string, ModuleRecord>> => {
  await init;
  const registryHost = getOutboundHost(registryBaseUrl);
  const modules = new Map<string, ModuleRecord>();
  const queue = [entryUrl];

  while (queue.length > 0) {
    if (modules.size >= maxModules) {
      throw new Error(`MCP package import exceeded ${maxModules} modules.`);
    }
    const url = queue.shift()!;
    if (modules.has(url)) continue;

    const allowedUrl = assertAllowedOutboundUrl(url, "mcp-package-install", [registryHost]);
    const response = await fetchImpl(allowedUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${allowedUrl}: ${response.status} ${response.statusText}`);
    }

    const code = await response.text();
    const [imports] = parse(code);
    const resolvedImports = imports
      .map((item) => item.n)
      .filter((specifier): specifier is string => Boolean(specifier))
      .map((specifier) => resolveEsmImportSpecifier(specifier, allowedUrl, registryBaseUrl))
      .filter((resolved): resolved is string => Boolean(resolved));

    modules.set(allowedUrl, { url: allowedUrl, code, imports: resolvedImports });
    for (const resolved of resolvedImports) {
      if (!modules.has(resolved)) queue.push(resolved);
    }
  }

  return modules;
};

const readInstalledModuleGraph = async (
  install: McpPackageRuntimeInstall,
): Promise<Map<string, string>> => {
  const { fsInstance, readFileOp } = await loadVfsRuntime();
  const manifestBytes = await readFileOp(`${install.vfsRoot}/manifest.json`, { fsInstance, silent: true });
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as McpPackageRuntimeInstall;
  const moduleUrls = manifest.moduleUrls?.length
    ? manifest.moduleUrls
    : await readModuleUrlsFromManifestRoot(manifest.vfsRoot);
  const modules = new Map<string, string>();
  const expectedHashes = manifest.moduleHashes ?? {};

  for (const url of moduleUrls) {
    const moduleBytes = await readFileOp(modulePathForUrl(manifest.vfsRoot, url), { fsInstance, silent: true });
    const code = new TextDecoder().decode(moduleBytes);
    await verifyMcpModuleLock(url, code, expectedHashes[url]);
    modules.set(url, code);
  }
  return modules;
};

const createMcpJsRuntimeWorker = async (
  install: McpPackageRuntimeInstall,
  modules: Map<string, string>,
): Promise<McpJsRuntimeWorkerHandle> => {
  await init;
  const blobUrls = new Map<string, string>();
  const visiting = new Set<string>();
  try {
    const buildBlobUrl = (url: string): string => {
      const existing = blobUrls.get(url);
      if (existing) return existing;
      if (visiting.has(url)) {
        throw new Error(`Circular module import is not supported by the first MCP shim pass: ${url}`);
      }
      const code = modules.get(url);
      if (code === undefined) throw new Error(`Installed MCP module is missing: ${url}`);
      visiting.add(url);
      const replacements = new Map<string, string>();
      const [imports] = parse(code);
      for (const item of imports) {
        if (!item.n) continue;
        const resolved = resolveEsmImportSpecifier(item.n, url, install.registryBaseUrl);
        const blobUrl = resolved ? buildBlobUrl(resolved) : undefined;
        if (blobUrl) replacements.set(item.n, blobUrl);
      }
      visiting.delete(url);
      const blobUrl = URL.createObjectURL(
        new Blob([rewriteEsmImports(code, replacements)], { type: "text/javascript" }),
      );
      blobUrls.set(url, blobUrl);
      return blobUrl;
    };

    const entryBlobUrl = buildBlobUrl(install.entryUrl);

    const bootstrap = createWorkerBootstrap(entryBlobUrl);
    const bootstrapUrl = URL.createObjectURL(new Blob([bootstrap], { type: "text/javascript" }));
    const worker = new Worker(bootstrapUrl, { type: "module", name: `llmchef-mcp-${install.packageName}` });
    URL.revokeObjectURL(bootstrapUrl);
    let disposed = false;
    return {
      worker,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        worker.terminate();
        for (const blobUrl of blobUrls.values()) URL.revokeObjectURL(blobUrl);
        blobUrls.clear();
      },
    };
  } catch (error) {
    for (const blobUrl of blobUrls.values()) URL.revokeObjectURL(blobUrl);
    throw error;
  }
};

const createWorkerBootstrap = (entryBlobUrl: string): string => `
const deny = (name) => () => { throw new Error(name + " is disabled in the LLMChef MCP shim."); };
const stdinHandlers = new Set();
const emitStdin = (chunk) => stdinHandlers.forEach((handler) => handler(chunk));
self.fetch = deny("Network fetch");
self.XMLHttpRequest = deny("XMLHttpRequest");
self.WebSocket = deny("WebSocket");
self.EventSource = deny("EventSource");
self.importScripts = deny("importScripts");
self.Worker = deny("Child workers");
self.SharedWorker = deny("Shared workers");
self.process = {
  env: Object.freeze({}),
  argv: Object.freeze(["llmchef-mcp-shim"]),
  platform: "browser",
  versions: Object.freeze({ node: "20.0.0-llmchef-browser-shim" }),
  cwd: () => "/",
  stdout: { write: (chunk) => self.postMessage({ type: "stdio", message: String(chunk) }) },
  stderr: { write: (chunk) => self.postMessage({ type: "stdio", message: String(chunk) }) },
  stdin: {
    on: (event, handler) => {
      if (event === "data" && typeof handler === "function") stdinHandlers.add(handler);
      return self.process.stdin;
    },
    off: (_event, handler) => {
      stdinHandlers.delete(handler);
      return self.process.stdin;
    },
    read: () => null,
    resume: () => self.process.stdin,
    setEncoding: () => self.process.stdin,
  },
  nextTick: (fn, ...args) => Promise.resolve().then(() => fn(...args)),
};
self.addEventListener("message", (event) => {
  if (event.data?.type === "stdin") emitStdin(String(event.data.chunk ?? ""));
});
try {
  await import(${JSON.stringify(entryBlobUrl)});
  self.postMessage({ type: "ready", message: "Package module imported in the browser MCP shim." });
} catch (error) {
  self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
}
`;

const createMcpInitializeRequest = () => ({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: {
      name: "LLMChef Browser MCP Shim",
      version: "0.1.0",
    },
  },
});

const normalizeToolNames = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((tool) => {
      if (!tool || typeof tool !== "object") return null;
      const name = (tool as { name?: unknown }).name;
      return typeof name === "string" && name.trim() ? name.trim() : null;
    })
    .filter((name): name is string => Boolean(name));
};

export const normalizeMcpPackageRegistryBaseUrl = (value: string): string => {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("MCP package registry must be an HTTP(S) URL.");
  }
  if (url.protocol === "http:" && !isLoopbackHost(url.host)) {
    throw new Error("HTTP MCP package registries are only allowed on localhost.");
  }
  return `${url.protocol}//${url.host}`;
};

const isLoopbackHost = (host: string): boolean =>
  host === "localhost" ||
  host.startsWith("localhost:") ||
  host === "127.0.0.1" ||
  host.startsWith("127.") ||
  host.startsWith("[::1]");

const stableInstallId = async (packageName: string, entryUrl: string): Promise<string> => {
  const hash = (await sha256Hex(`${packageName}\n${entryUrl}`)).slice(0, 16);
  return `${sanitizePackageName(packageName)}-${hash}`;
};

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const sanitizePackageName = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "package";

const modulePathForUrl = (vfsRoot: string, url: string): string =>
  `${vfsRoot}/modules/${encodeURIComponent(url)}.mjs`;

const readModuleUrlsFromManifestRoot = async (vfsRoot: string): Promise<string[]> => {
  const { fsInstance } = await loadVfsRuntime();
  const entries = await fsInstance.promises.readdir(`${vfsRoot}/modules`);
  return entries.map((entry) => decodeURIComponent(entry.replace(/\.mjs$/, "")));
};
