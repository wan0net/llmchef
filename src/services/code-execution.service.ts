import { PYODIDE_VERSION_URL } from "@/lib/llmchef/constants";
import { recordOutboundRequest } from "@/lib/llmchef/outbound-policy";

// Global pyodide instance for reuse
let pyodidePromise: Promise<any> | null = null;

export interface JsExecutionPermissions {
  network?: boolean;
  storage?: boolean;
  provider?: boolean;
}

export interface JsExecutionOptions {
  consent?: {
    execute: boolean;
  };
  permissions?: JsExecutionPermissions;
  timeoutMs?: number;
}

export interface PyExecutionOptions {
  consent?: {
    execute: boolean;
  };
  permissions?: {
    network?: boolean;
    storage?: boolean;
    provider?: boolean;
  };
  allowedNetworkHosts?: string[];
  timeoutMs?: number;
}

const JS_IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const PY_NETWORK_PATTERN = /\b(import\s+(?:js|pyodide\.http|urllib|requests|socket|micropip)|from\s+(?:js|pyodide\.http|urllib|requests|socket|micropip)\b|fetch\s*\(|open_url\s*\(|XMLHttpRequest|WebSocket|EventSource)\b/;
const PY_STORAGE_PATTERN = /\b(localStorage|sessionStorage|indexedDB|caches)\b/;
const PY_PROVIDER_PATTERN = /\b(LLMChefProvider|ai\s*\.)\b/;

const assertPythonPermissions = (
  code: string,
  permissions: NonNullable<PyExecutionOptions["permissions"]>,
): void => {
  if (!permissions.network && PY_NETWORK_PATTERN.test(code)) {
    throw new Error("Python workflow step requests network/browser bridge access, but network permission is disabled.");
  }
  if (!permissions.storage && PY_STORAGE_PATTERN.test(code)) {
    throw new Error("Python workflow step requests browser storage access, but storage permission is disabled.");
  }
  if (!permissions.provider && PY_PROVIDER_PATTERN.test(code)) {
    throw new Error("Python workflow step requests provider access, but provider permission is disabled.");
  }
};

const buildPythonWorkerSource = (pyodideScriptUrl: string, pyodideIndexUrl: string): string => `
  let pyodidePromise = null;
  const pyodideScriptUrl = ${JSON.stringify(pyodideScriptUrl)};
  const pyodideIndexUrl = ${JSON.stringify(pyodideIndexUrl)};
  const deny = (name) => () => { throw new Error(name + " is not permitted for this workflow step."); };
  const disableGlobal = (name, value) => {
    try {
      Object.defineProperty(self, name, { value, configurable: true, writable: true });
    } catch {
      try { self[name] = value; } catch {}
    }
  };

  const loadPyodideRuntime = async () => {
    if (!pyodidePromise) {
      importScripts(pyodideScriptUrl);
      pyodidePromise = self.loadPyodide({ indexURL: pyodideIndexUrl });
    }
    return pyodidePromise;
  };

  const inputToUrl = (input) => {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.toString();
    return input.url;
  };

  const hostMatchesAllowed = (host, allowedHost) =>
    host === allowedHost || host.endsWith("." + allowedHost);

  const isHostAllowed = (host, allowedHosts) =>
    allowedHosts.some((allowedHost) => hostMatchesAllowed(host, allowedHost));

  const isLocalOrSameOriginHost = (host) => {
    const currentHost = self.location?.host;
    if (currentHost && host === currentHost) return true;
    return (
      host === "localhost" ||
      host.startsWith("localhost:") ||
      host === "127.0.0.1" ||
      host.startsWith("127.") ||
      host.startsWith("127.0.0.1:") ||
      host === "[::1]" ||
      host.startsWith("[::1]:")
    );
  };

  const assertAllowedNetworkUrl = (url, method, allowedHosts) => {
      let parsed;
      try {
        parsed = new URL(url, self.location?.origin || pyodideIndexUrl);
      } catch {
        throw new Error("Blocked outbound Python request with invalid URL: " + url);
      }

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Blocked non-HTTP Python fetch request: " + parsed.protocol);
      }

      if (!isLocalOrSameOriginHost(parsed.host) && !isHostAllowed(parsed.host, allowedHosts)) {
        throw new Error(
          "Blocked outbound Python request to " + parsed.host + ". Configure this host before LLMChef can contact it."
        );
      }

      self.postMessage({
        type: "outbound-request",
        url: parsed.toString(),
        purpose: "python:" + (method || "GET"),
      });
      return parsed.toString();
  };

  const installNetworkGuard = (allowedHosts) => {
    const originalFetch = self.fetch.bind(self);
    self.fetch = async (input, init) => {
      const url = inputToUrl(input);
      const allowedUrl = assertAllowedNetworkUrl(url, init?.method, allowedHosts);
      return originalFetch(allowedUrl, init);
    };

    const OriginalXMLHttpRequest = self.XMLHttpRequest;
    if (OriginalXMLHttpRequest) {
      const GuardedXMLHttpRequest = function () {
        const request = new OriginalXMLHttpRequest();
        const originalOpen = request.open.bind(request);
        request.open = (method, url, ...rest) => {
          const allowedUrl = assertAllowedNetworkUrl(url, method, allowedHosts);
          return originalOpen(method, allowedUrl, ...rest);
        };
        return request;
      };
      GuardedXMLHttpRequest.prototype = OriginalXMLHttpRequest.prototype;
      disableGlobal("XMLHttpRequest", GuardedXMLHttpRequest);
    }
  };

  const applyPermissions = (permissions) => {
    disableGlobal("Worker", function () { throw new Error("Child workers are not permitted for this workflow step."); });
    disableGlobal("SharedWorker", function () { throw new Error("Shared workers are not permitted for this workflow step."); });
    disableGlobal("Blob", undefined);
    if (self.URL) {
      const originalURL = self.URL;
      disableGlobal("URL", new Proxy(originalURL, {
        get(target, prop, receiver) {
          if (prop === "createObjectURL") return deny("Object URL creation");
          if (prop === "revokeObjectURL") return () => undefined;
          return Reflect.get(target, prop, receiver);
        },
      }));
    }
    if (!permissions.network) {
      disableGlobal("fetch", deny("Network access"));
      disableGlobal("XMLHttpRequest", undefined);
      disableGlobal("WebSocket", undefined);
      disableGlobal("EventSource", undefined);
      disableGlobal("importScripts", deny("Script imports"));
    } else {
      installNetworkGuard(permissions.allowedNetworkHosts || []);
      disableGlobal("WebSocket", undefined);
      disableGlobal("EventSource", undefined);
      disableGlobal("importScripts", deny("Script imports"));
    }
    if (!permissions.storage) {
      disableGlobal("indexedDB", undefined);
      disableGlobal("caches", undefined);
      disableGlobal("localStorage", undefined);
      disableGlobal("sessionStorage", undefined);
    }
    if (!permissions.provider) {
      disableGlobal("LLMChefProvider", undefined);
      disableGlobal("ai", undefined);
    }
  };

  self.onmessage = async (event) => {
    const { code, context, contextKeys, permissions } = event.data;
    try {
      const pyodide = await loadPyodideRuntime();
      const effectivePermissions = permissions || {};
      applyPermissions(effectivePermissions);
      const pythonGlobals = pyodide.runPython("dict()");
      pythonGlobals.set("_workflow_result", null);
      pythonGlobals.set("_LLMCHEF_BLOCKED_MODULES_JSON", JSON.stringify([
        ...(!effectivePermissions.network ? ["pyodide.http", "urllib", "requests", "socket", "micropip", "js"] : []),
      ]));
      for (const key of contextKeys) {
        pythonGlobals.set(key, context[key]);
      }

      pyodide.runPython(\`
import builtins
import json
import sys

_workflow_result = None
_llmchef_blocked_modules = tuple(json.loads(_LLMCHEF_BLOCKED_MODULES_JSON))
_llmchef_original_import = getattr(builtins, "_llmchef_original_import", builtins.__import__)
builtins._llmchef_original_import = _llmchef_original_import

def _llmchef_module_blocked(name):
    return any(name == blocked or name.startswith(blocked + ".") for blocked in _llmchef_blocked_modules)

def _llmchef_guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
    if level == 0 and _llmchef_module_blocked(name):
        raise ImportError(f"{name} is not permitted for this workflow step.")
    return _llmchef_original_import(name, globals, locals, fromlist, level)

for _llmchef_module_name in list(sys.modules.keys()):
    if _llmchef_module_blocked(_llmchef_module_name):
        sys.modules.pop(_llmchef_module_name, None)

builtins.__import__ = _llmchef_guarded_import

def workflow_return(value):
    global _workflow_result
    _workflow_result = value
    return value
\`, { globals: pythonGlobals, locals: pythonGlobals });

      await pyodide.runPythonAsync(code, {
        globals: pythonGlobals,
        locals: pythonGlobals,
      });

      const result = pythonGlobals.get("_workflow_result");
      const jsResult = result && typeof result.toJs === "function"
        ? result.toJs({ dict_converter: Object.fromEntries })
        : result;
      if (result && typeof result.destroy === "function") {
        result.destroy();
      }
      if (typeof pythonGlobals.destroy === "function") {
        pythonGlobals.destroy();
      }
      self.postMessage({
        ok: true,
        result: jsResult,
      });
    } catch (error) {
      self.postMessage({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
`;

export const CodeExecutionService = {
  /**
   * Initialize and get Pyodide instance
   * Singleton pattern to avoid multiple downloads
   */
  async getPyodide(): Promise<any> {
    if (!pyodidePromise) {
      pyodidePromise = this.loadPyodide();
    }
    return pyodidePromise;
  },

  /**
   * Load Pyodide from the configured same-origin runtime path.
   */
  async loadPyodide(): Promise<any> {
    try {
      if (typeof window === 'undefined') {
        throw new Error('Pyodide only available in browser environment');
      }

      const script = document.createElement('script');
      script.src = PYODIDE_VERSION_URL;
      document.head.appendChild(script);
      
      // Wait for script to load
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
      });
      
      // @ts-expect-error - Global pyodide from script
      const pyodide = await window.loadPyodide({
        indexURL: PYODIDE_VERSION_URL.replace(/\/pyodide\.js$/, '/'),
      });
      
      return pyodide;
    } catch (error) {
      console.error('[CodeExecutionService] Failed to load Pyodide:', error);
      throw new Error(`Failed to load Python environment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Execute JavaScript code with context
   * @param code - JavaScript code to execute
   * @param context - Context object with workflow data (same structure as transform steps)
   * @returns Promise<any> - Return value from the code
   */
  async executeJs(
    code: string,
    context: Record<string, any>,
    options: JsExecutionOptions = {},
  ): Promise<any> {
    if (!code.trim()) {
      throw new Error('JavaScript code cannot be empty');
    }

    if (!options.consent?.execute) {
      throw new Error('JavaScript workflow execution requires explicit user consent for this run.');
    }

    const permissions = options.permissions || {};

    return this.executeJsInIsolatedWorker(code, context, permissions, options.timeoutMs || 5000);
  },

  async executeJsInIsolatedWorker(
    code: string,
    context: Record<string, any>,
    permissions: JsExecutionPermissions,
    timeoutMs: number,
  ): Promise<any> {
    if (typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") {
      throw new Error("Isolated JavaScript execution requires browser Worker support.");
    }

    const contextKeys = Object.keys(context);
    contextKeys.forEach((key) => {
      if (!JS_IDENTIFIER.test(key)) {
        throw new Error(`Invalid JavaScript context variable name: ${key}`);
      }
    });

    const workerSource = `
      const deny = (name) => () => { throw new Error(name + " is not permitted for this workflow step."); };
      const denyConstruct = (name) => function () { throw new Error(name + " is not permitted for this workflow step."); };
      self.Worker = denyConstruct("Child workers");
      self.SharedWorker = denyConstruct("Shared workers");
      const disableObjectUrls = (urlCtor) => {
        if (!urlCtor || typeof urlCtor !== "function") return urlCtor;
        return new Proxy(urlCtor, {
          get(target, prop, receiver) {
            if (prop === "createObjectURL") return deny("Object URL creation");
            if (prop === "revokeObjectURL") return () => undefined;
            return Reflect.get(target, prop, receiver);
          },
        });
      };
      self.URL = disableObjectUrls(self.URL);
      self.webkitURL = disableObjectUrls(self.webkitURL);
      self.Blob = undefined;
      self.onmessage = async (event) => {
        const { code, context, contextKeys, permissions } = event.data;
        try {
          if (!permissions.network) {
            self.fetch = deny("Network access");
            self.XMLHttpRequest = undefined;
            self.WebSocket = undefined;
            self.EventSource = undefined;
            self.importScripts = deny("Script imports");
          }
          if (!permissions.storage) {
            self.indexedDB = undefined;
            self.caches = undefined;
            self.localStorage = undefined;
            self.sessionStorage = undefined;
          }
          if (!permissions.provider) {
            self.LLMChefProvider = undefined;
            self.ai = undefined;
          }
          const contextValues = contextKeys.map((key) => context[key]);
          const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
          const fn = new AsyncFunction(...contextKeys, code);
          const result = await fn(...contextValues);
          self.postMessage({ ok: true, result });
        } catch (error) {
          self.postMessage({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      };
    `;

    const blobUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
    const worker = new Worker(blobUrl);

    return await new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        worker.terminate();
        URL.revokeObjectURL(blobUrl);
        reject(new Error(`JavaScript execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      worker.onmessage = (event) => {
        window.clearTimeout(timer);
        worker.terminate();
        URL.revokeObjectURL(blobUrl);
        if (event.data?.ok) {
          resolve(event.data.result);
        } else {
          reject(new Error(event.data?.error || "Unknown isolated JavaScript execution error"));
        }
      };

      worker.onerror = (event) => {
        window.clearTimeout(timer);
        worker.terminate();
        URL.revokeObjectURL(blobUrl);
        reject(new Error(event.message || "Worker JavaScript execution failed"));
      };

      try {
        worker.postMessage({
          code,
          context,
          contextKeys,
          permissions: {
            network: permissions.network === true,
            storage: permissions.storage === true,
            provider: permissions.provider === true,
          },
        });
      } catch (error) {
        window.clearTimeout(timer);
        worker.terminate();
        URL.revokeObjectURL(blobUrl);
        reject(new Error(`JavaScript context is not cloneable for isolated execution: ${error instanceof Error ? error.message : "Unknown error"}`));
      }
    });
  },

  /**
   * Execute Python code with context
   * @param code - Python code to execute
   * @param context - Context object with workflow data
   * @returns Promise<any> - Return value from the code
   */
  async executePy(
    code: string,
    context: Record<string, any>,
    options: PyExecutionOptions = {},
  ): Promise<any> {
    if (!code.trim()) {
      throw new Error('Python code cannot be empty');
    }

    if (!options.consent?.execute) {
      throw new Error('Python workflow execution requires explicit user consent for this run.');
    }

    const timeoutMs = options.timeoutMs || 5000;
    const permissions = options.permissions || {};
    assertPythonPermissions(code, permissions);

    try {
      if (typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") {
        throw new Error("Isolated Python execution requires browser Worker support.");
      }

      const contextKeys = Object.keys(context);
      for (const key of contextKeys) {
        if (!JS_IDENTIFIER.test(key)) {
          throw new Error(`Invalid Python context variable name: ${key}`);
        }
      }

      const pyodideScriptUrl = new URL(PYODIDE_VERSION_URL, window.location.href).href;
      const pyodideIndexUrl = pyodideScriptUrl.replace(/\/pyodide\.js$/, "/");
      const workerSource = buildPythonWorkerSource(pyodideScriptUrl, pyodideIndexUrl);
      const blobUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
      const worker = new Worker(blobUrl, { name: "llmchef-workflow-python" });

      return await new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          worker.terminate();
          URL.revokeObjectURL(blobUrl);
          reject(new Error(`Python execution timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        worker.onmessage = (event) => {
          if (event.data?.type === "outbound-request") {
            recordOutboundRequest(event.data.url, event.data.purpose || "python");
            return;
          }

          window.clearTimeout(timer);
          worker.terminate();
          URL.revokeObjectURL(blobUrl);
          if (event.data?.ok) {
            resolve(event.data.result);
          } else {
            reject(new Error(event.data?.error || "Unknown isolated Python execution error"));
          }
        };

        worker.onerror = (event) => {
          window.clearTimeout(timer);
          worker.terminate();
          URL.revokeObjectURL(blobUrl);
          reject(new Error(event.message || "Worker Python execution failed"));
        };

        try {
          worker.postMessage({
            code,
            context,
            contextKeys,
            permissions: {
              network: permissions.network === true,
              storage: permissions.storage === true,
              provider: permissions.provider === true,
              allowedNetworkHosts: options.allowedNetworkHosts ?? [],
            },
          });
        } catch (error) {
          window.clearTimeout(timer);
          worker.terminate();
          URL.revokeObjectURL(blobUrl);
          reject(new Error(`Python context is not cloneable for isolated execution: ${error instanceof Error ? error.message : "Unknown error"}`));
        }
      });
    } catch (error) {
      console.error('[CodeExecutionService] Python execution error:', error);
      throw new Error(`Python execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Get available Python packages
   */
  async getAvailablePythonPackages(): Promise<string[]> {
    try {
      const pyodide = await this.getPyodide();
      pyodide.runPython(`
import sys
available_packages = list(sys.modules.keys())
      `);
      return pyodide.globals.get('available_packages').toJs();
    } catch (error) {
      console.warn('[CodeExecutionService] Could not get Python packages:', error);
      return ['builtins', 'sys', 'json'];
    }
  },

  /**
   * Install additional Python package
   */
  async installPythonPackage(packageName: string): Promise<void> {
    try {
      const pyodide = await this.getPyodide();
      await pyodide.loadPackage([packageName]);
    } catch (error) {
      console.error("[CodeExecutionService] Failed to install package ", packageName, ":", error);
      throw new Error(`Failed to install Python package: ${packageName}`);
    }
  },
};
