import React, { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ConfirmDialogService,
  type ConfirmRequest,
} from "@/services/confirm-dialog.service";

export const ConfirmDialogHost: React.FC = () => {
  const [requests, setRequests] = useState<ConfirmRequest[]>([]);

  useEffect(() => {
    ConfirmDialogService.setListener(setRequests);
    return () => ConfirmDialogService.setListener(null);
  }, []);

  const current = requests[0] ?? null;

  return (
    <AlertDialog
      open={!!current}
      onOpenChange={(open) => {
        if (!open && current) {
          ConfirmDialogService.resolve(current.id, false);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{current?.title ?? ""}</AlertDialogTitle>
          {current?.description && (
            <AlertDialogDescription>{current.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => current && ConfirmDialogService.resolve(current.id, false)}
          >
            {current?.cancelLabel ?? "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => current && ConfirmDialogService.resolve(current.id, true)}
            className={
              current?.destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {current?.confirmLabel ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
