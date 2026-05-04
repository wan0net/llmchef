import type { WorkflowRun } from "@/types/llmchef/workflow";

const UNSAFE_PATH_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const getSafePathValue = (source: unknown, key: string): unknown => {
  if (!key || UNSAFE_PATH_KEYS.has(key)) return undefined;
  if (source === null || source === undefined) return undefined;
  if (!Object.prototype.hasOwnProperty.call(Object(source), key)) return undefined;
  return (source as Record<string, unknown>)[key];
};

export const resolveJsonPath = (source: unknown, path: string): unknown => {
  let normalizedPath = path;
  if (normalizedPath.startsWith("$.")) {
    normalizedPath = normalizedPath.slice(2);
  }

  try {
    return normalizedPath.split(".").reduce<unknown>((accumulator, part) => {
      if (accumulator === null || accumulator === undefined) return undefined;

      if (part.includes("[") && part.includes("]")) {
        const propMatch = part.match(/^([^[]*)/);
        const prop = propMatch ? propMatch[1] : "";
        const indexMatches = part.match(/\[(\d+)\]/g);
        if (!indexMatches) return undefined;

        let current = prop ? getSafePathValue(accumulator, prop) : accumulator;

        for (const indexMatch of indexMatches) {
          const index = Number.parseInt(indexMatch.slice(1, -1), 10);
          if (!Number.isSafeInteger(index) || index < 0 || !Array.isArray(current)) {
            return undefined;
          }
          current = current[index];
        }

        return current;
      }

      return getSafePathValue(accumulator, part);
    }, source);
  } catch (error) {
    console.warn(`[workflow-query-utils] JSONPath resolution failed for ${path}:`, error);
    return undefined;
  }
};

export type QueryValidationOptions = {
  allowStaticValues?: boolean;
};

export const validateJsonQuery = (
  query: string,
  context: Record<string, unknown>,
  options: QueryValidationOptions = {},
): { isValid: boolean; error?: string; result?: unknown } => {
  const { allowStaticValues = true } = options;

  if (!query.trim()) {
    return { isValid: false, error: "Query cannot be empty" };
  }

  if (allowStaticValues && query.startsWith('"') && query.endsWith('"')) {
    return { isValid: true, result: query.slice(1, -1) };
  }

  if (allowStaticValues && !Number.isNaN(Number(query))) {
    return { isValid: true, result: Number(query) };
  }

  if (allowStaticValues && (query === "true" || query === "false")) {
    return { isValid: true, result: query === "true" };
  }

  if (!query.startsWith("$.")) {
    return {
      isValid: false,
      error: allowStaticValues
        ? 'Query must start with "$." or be a static value ("text", number, true/false)'
        : 'Query must start with "$."',
    };
  }

  const invalidChars = /[^a-zA-Z0-9_.$[\]]/;
  if (invalidChars.test(query.replace(/\[(\d+)\]/g, ""))) {
    return { isValid: false, error: "Invalid characters in query" };
  }

  try {
    return { isValid: true, result: resolveJsonPath(context, query) };
  } catch (error) {
    return {
      isValid: false,
      error: `Query execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
};

export const buildWorkflowTransformContext = (
  run: WorkflowRun,
  stepIndex: number,
): Record<string, unknown> => {
  const outputs: unknown[] = [];

  if (run.stepOutputs.trigger) {
    outputs[0] = run.stepOutputs.trigger;
  }

  for (let index = 0; index < stepIndex; index += 1) {
    const step = run.template.steps[index];
    if (step && run.stepOutputs[step.id]) {
      outputs[index + 1] = run.stepOutputs[step.id];
    }
  }

  return {
    workflow: run.template,
    initial_step: run.stepOutputs.trigger || {},
    outputs,
  };
};

export const resolveWorkflowMappingValue = (
  context: Record<string, unknown>,
  query: string,
): unknown => {
  if (query.startsWith('"') && query.endsWith('"')) {
    return query.slice(1, -1);
  }
  if (!Number.isNaN(Number(query))) {
    return Number(query);
  }
  if (query === "true" || query === "false") {
    return query === "true";
  }
  if (query.startsWith("$.")) {
    return resolveJsonPath(context, query);
  }

  throw new Error(
    `Invalid query format: "${query}". Must be a JSON path starting with "$." or a static value.`,
  );
};
