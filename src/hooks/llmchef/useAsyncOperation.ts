// src/hooks/llmchef/useAsyncOperation.ts

import { useState, useCallback } from "react";
import { BackgroundTaskToast } from "@/services/background-task-toast.service";

// Corrected type definition
type AsyncOperation<TArgs extends any[], TResult> = (
  ...args: TArgs
) => Promise<TResult>;

interface UseAsyncOperationResult<TArgs extends any[], TResult> {
  run: (...args: TArgs) => Promise<TResult | undefined>;
  isLoading: boolean;
  error: string | null;
  resetError: () => void;
}

export function useAsyncOperation<TArgs extends any[], TResult>(
  // Corrected usage of the generic type
  operation: AsyncOperation<TArgs, TResult>,
  options?: {
    setLoading?: (loading: boolean) => void;
    setError?: (error: string | null) => void;
    successMessage?: string | ((result: TResult) => string);
    errorMessagePrefix?: string;
    loadingMessage?: string;
    toastId?: string;
  },
): UseAsyncOperationResult<TArgs, TResult> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);

  const setLoading = options?.setLoading ?? setIsLoading;
  const setError = options?.setError ?? setErrorState;
  const prefix = options?.errorMessagePrefix ?? "Operation failed";
  const toastId = options?.toastId ?? `async-operation:${prefix}`;

  const resetError = useCallback(() => {
    setError(null);
  }, [setError]);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (isLoading) {
        console.warn("Operation already in progress, skipping.");
        if (options?.loadingMessage) {
          BackgroundTaskToast.loading({
            id: toastId,
            message: options.loadingMessage,
            description: "This action is already running.",
          });
        }
        return undefined;
      }
      setLoading(true);
      setError(null);
      if (options?.loadingMessage) {
        BackgroundTaskToast.loading({
          id: toastId,
          message: options.loadingMessage,
        });
      }
      try {
        const result = await operation(...args);
        if (options?.successMessage) {
          const message =
            typeof options.successMessage === "function"
              ? options.successMessage(result)
              : options.successMessage;
          BackgroundTaskToast.success({ id: toastId, message });
        } else if (options?.loadingMessage) {
          BackgroundTaskToast.dismiss(toastId);
        }
        return result;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("[useAsyncOperation Error - ", prefix, "]:", err);
        setError(errorMsg);
        BackgroundTaskToast.error({
          id: toastId,
          message: prefix,
          description: errorMsg,
        });
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [isLoading, setLoading, setError, operation, options, prefix, toastId],
  );

  return { run, isLoading, error, resetError };
}
