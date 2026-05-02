import { PYODIDE_VERSION_URL } from "@/lib/llmchef/constants";

// Global pyodide instance for reuse
let pyodidePromise: Promise<any> | null = null;

export interface JsExecutionPermissions {
  network?: boolean;
  storage?: boolean;
  provider?: boolean;
  pageContext?: boolean;
}

export interface JsExecutionOptions {
  consent?: {
    execute: boolean;
    pageContext?: boolean;
  };
  permissions?: JsExecutionPermissions;
  timeoutMs?: number;
  mode?: "isolated" | "page";
}

const JS_IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

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

    const mode = options.mode || "isolated";
    const permissions = options.permissions || {};

    if (mode === "page") {
      if (!options.consent.pageContext || !permissions.pageContext) {
        throw new Error('Page-context JavaScript requires explicit page-context consent and permission.');
      }
      return this.executeJsInPageContext(code, context);
    }

    return this.executeJsInIsolatedWorker(code, context, permissions, options.timeoutMs || 5000);
  },

  async executeJsInPageContext(code: string, context: Record<string, any>): Promise<any> {
    try {
      const contextKeys = Object.keys(context);
      const contextValues = Object.values(context);
      contextKeys.forEach((key) => {
        if (!JS_IDENTIFIER.test(key)) {
          throw new Error(`Invalid JavaScript context variable name: ${key}`);
        }
      });

      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const func = new AsyncFunction(...contextKeys, code);
      const result = func(...contextValues);
      return result && typeof result.then === 'function' ? await result : result;
    } catch (error) {
      console.error('[CodeExecutionService] JavaScript execution error:', error);
      throw new Error(`JavaScript execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
  async executePy(code: string, context: Record<string, any>): Promise<any> {
    if (!code.trim()) {
      throw new Error('Python code cannot be empty');
    }

    // No security validation needed - this is user-authored workflow code

    try {
      const pyodide = await this.getPyodide();
      pyodide.globals.set("_workflow_result", null);
      // Set context variables in Python global scope
      for (const [key, value] of Object.entries(context)) {
        pyodide.globals.set(key, value);
      }
      
      // Set up return value capture
      pyodide.runPython(`
import sys
import json

# Create a result container
_workflow_result = None

def workflow_return(value):
    global _workflow_result
    _workflow_result = value
    return value
      `);
      
      // Instead of interpolating user code, use exec to safely execute user code in a controlled scope
      // This prevents code injection via triple quotes or special syntax
      const safeWrapper = `
import sys
import json

try:
    exec(USER_CODE, globals())
    # If no explicit return, try to capture the last expression
    if '_workflow_result' not in globals() or _workflow_result is None:
        pass  # No return value
except Exception as e:
    _workflow_result = {'error': str(e)}
    raise
`;
      // Replace USER_CODE with a unique placeholder, then use runPython with code argument
      // Pyodide supports runPython(code, globals, locals) but not direct code injection, so we use set
      pyodide.globals.set("USER_CODE", code);
      pyodide.runPython(safeWrapper);
      
      // Get the return value
      const result = pyodide.globals.get('_workflow_result');
      
      // Convert Python objects to JavaScript
      if (result && result.toJs) {
        return result.toJs({ dict_converter: Object.fromEntries });
      }
      
      return result;
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
      console.error(`[CodeExecutionService] Failed to install package ${packageName}:`, error);
      throw new Error(`Failed to install Python package: ${packageName}`);
    }
  },
};
