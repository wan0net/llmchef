import { type ControlModule } from "@/types/llmchef/control";
import { type LLMChefModApi } from "@/types/llmchef/modding";
import { CodeExecutionService } from "@/services/code-execution.service";
import { getRuntimeAllowedOutboundHosts } from "@/services/outbound-fetch-guard.service";
import { Tool } from "ai";
import { z } from "zod";

const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 60000;
const DEFAULT_TIMEOUT_MS = 30000;

const pythonExecuteSchema = z.object({
  code: z
    .string()
    .describe(
      "Python code to run in sandboxed Pyodide. Call workflow_return(value) with a JSON-serializable result."
    ),
  context: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Optional extra JSON-serializable values exposed as Python globals."
    ),
  timeoutMs: z
    .number()
    .optional()
    .default(DEFAULT_TIMEOUT_MS)
    .describe(
      `Optional execution timeout in milliseconds. Defaults to ${DEFAULT_TIMEOUT_MS}; clamped between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}.`
    ),
  allowNetwork: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Allow Python HTTP(S) fetches only to LLMChef-configured outbound hosts, plus same-origin and localhost. Defaults to false."
    ),
});

const PYTHON_INTERPRETER_CONTROL_PROMPT = `Use the pythonExecute tool for general-purpose in-browser computation and structured data processing: data analysis, parsing or transforming data, calculations, validation, small algorithms, and extracting compact structured summaries from provided data.

When working with files, first use VFS tools to read the relevant content, then pass that content through pythonExecute.context instead of trying to access files directly from Python.

Prefer Python standard-library modules where possible. Return compact JSON-serializable outputs by calling workflow_return(value). Avoid side effects, browser storage access, provider access, and DOM or JavaScript bridge usage.

Network access is off by default. Set pythonExecute.allowNetwork only when the task genuinely needs HTTP(S), and only configured LLMChef outbound hosts plus same-origin/localhost are reachable. Unconfigured remote hosts will be blocked and logged by the network ledger. For HTTP from Python, prefer pyodide.http.pyfetch with top-level await.`;

const clampTimeoutMs = (timeoutMs: number | undefined): number => {
  const requestedTimeout = Number.isFinite(timeoutMs)
    ? timeoutMs
    : DEFAULT_TIMEOUT_MS;

  return Math.min(
    MAX_TIMEOUT_MS,
    Math.max(MIN_TIMEOUT_MS, requestedTimeout)
  );
};

export class PythonInterpreterToolModule implements ControlModule {
  readonly id = "core-python-interpreter-tool";
  private unregisterCallbacks: (() => void)[] = [];

  async initialize(): Promise<void> {
    console.log(`[${this.id}] Initialized.`);
  }

  register(modApi: LLMChefModApi): void {
    if (this.unregisterCallbacks.length > 0) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    const pythonExecuteTool: Tool<typeof pythonExecuteSchema> = {
      description:
        "Run sandboxed Python/Pyodide for general-purpose computation: data analysis, parsing/transformation, calculations, validation, small algorithms, and extracting structured summaries from provided data.",
      inputSchema: pythonExecuteSchema,
    };

    this.unregisterCallbacks.push(
      modApi.registerTool(
        "pythonExecute",
        pythonExecuteTool,
        async ({
          code,
          context,
          timeoutMs,
          allowNetwork,
        }: z.infer<typeof pythonExecuteSchema>) => {
          try {
            const networkAllowed = allowNetwork === true;
            const result = await CodeExecutionService.executePy(
              code,
              context ?? {},
              {
                consent: { execute: true },
                permissions: {
                  network: networkAllowed,
                  storage: false,
                  provider: false,
                },
                allowedNetworkHosts: networkAllowed
                  ? getRuntimeAllowedOutboundHosts()
                  : [],
                timeoutMs: clampTimeoutMs(timeoutMs),
              }
            );

            return { success: true, result };
          } catch (error: any) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }
      )
    );

    this.unregisterCallbacks.push(
      modApi.registerRule({
        id: `${this.id}-control-rule`,
        name: "Python Interpreter Tool Control",
        content: PYTHON_INTERPRETER_CONTROL_PROMPT,
        description: "Guides use of the sandboxed pythonExecute chat tool",
        type: "control",
        alwaysOn: true,
        moduleId: this.id,
      })
    );
  }

  destroy(): void {
    this.unregisterCallbacks.forEach((callback) => callback());
    this.unregisterCallbacks = [];
  }
}
