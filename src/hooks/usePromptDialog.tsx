import React, { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface PromptOptions {
  title: string;
  description?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputPlaceholder?: string;
}

export function usePromptDialog(): {
  prompt: (options: PromptOptions) => Promise<string | null>;
  PromptDialog: React.FC;
} {
  const [state, setState] = useState<
    (PromptOptions & { open: boolean; resolve: (value: string | null) => void }) | null
  >(null);
  const [value, setValue] = useState("");

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setValue(options.defaultValue ?? "");
      setState({ ...options, open: true, resolve });
    });
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        state?.resolve(null);
        setState(null);
      }
    },
    [state]
  );

  const handleConfirm = useCallback(() => {
    state?.resolve(value);
    setState(null);
  }, [state, value]);

  const handleCancel = useCallback(() => {
    state?.resolve(null);
    setState(null);
  }, [state]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleConfirm, handleCancel]
  );

  const PromptDialog = useCallback(() => {
    if (!state) return null;
    return (
      <Dialog open={state.open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{state.title}</DialogTitle>
            {state.description && <DialogDescription>{state.description}</DialogDescription>}
          </DialogHeader>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={state.inputPlaceholder}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              {state.cancelLabel ?? "Cancel"}
            </Button>
            <Button onClick={handleConfirm}>{state.confirmLabel ?? "OK"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }, [state, value, handleOpenChange, handleConfirm, handleCancel, handleKeyDown]);

  return { prompt, PromptDialog };
}
