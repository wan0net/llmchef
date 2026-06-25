// src/components/LLMChef/file-manager/FolderSyncConfirmDialog.tsx

import React from "react";
import { ActionDialog } from "@/components/LLMChef/common/ActionDialog";
import type { RealFsSyncPlan } from "@/lib/llmchef/real-fs-sync";
import { useTranslation } from "react-i18next";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";

interface FolderSyncConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  plan: RealFsSyncPlan | null;
  folderName: string;
  isSubmitting: boolean;
  onConfirm: () => void | Promise<void>;
}

const MAX_ENTRIES_SHOWN = 30;

export const FolderSyncConfirmDialog: React.FC<FolderSyncConfirmDialogProps> = ({
  isOpen,
  onOpenChange,
  plan,
  folderName,
  isSubmitting,
  onConfirm,
}) => {
  const { t } = useTranslation("vfs");

  if (!plan) return null;

  const toImport = plan.entries.filter((e) => e.action === "import");
  const toExport = plan.entries.filter((e) => e.action === "export");
  const changed = toImport.length + toExport.length;

  const allChanged = [...toImport, ...toExport];
  const shown = allChanged.slice(0, MAX_ENTRIES_SHOWN);
  const overflow = allChanged.length - shown.length;

  const description =
    changed === 0
      ? t("folderSync.confirmDialog.nothingToSync", "Everything is already up to date.")
      : t("folderSync.confirmDialog.description", {
          changed,
          folderName,
          defaultValue: `{{changed}} file(s) will be written to/from "{{folderName}}". Review the changes below and confirm to proceed.`,
        });

  return (
    <ActionDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t("folderSync.confirmDialog.title", "Confirm Folder Sync")}
      description={description}
      submitLabel={
        changed === 0
          ? t("folderSync.confirmDialog.close", "Close")
          : t("folderSync.confirmDialog.syncNow", "Sync Now")
      }
      onSubmit={changed === 0 ? () => onOpenChange(false) : onConfirm}
      isSubmitting={isSubmitting}
      contentClassName="max-h-[50vh] overflow-y-auto px-4"
    >
      {shown.length > 0 ? (
        <ul className="text-xs font-mono space-y-0.5">
          {shown.map((entry) => (
            <li key={entry.path} className="flex items-center gap-1.5 truncate">
              {entry.action === "import" ? (
                <ArrowDownIcon className="h-3 w-3 shrink-0 text-blue-500" aria-label={t("folderSync.confirmDialog.willImport", "will import")} />
              ) : entry.action === "export" ? (
                <ArrowUpIcon className="h-3 w-3 shrink-0 text-green-500" aria-label={t("folderSync.confirmDialog.willExport", "will export")} />
              ) : (
                <MinusIcon className="h-3 w-3 shrink-0 text-muted-foreground" aria-label={t("folderSync.confirmDialog.skip", "skip")} />
              )}
              <span className="truncate text-muted-foreground">{entry.path}</span>
            </li>
          ))}
          {overflow > 0 && (
            <li className="text-muted-foreground italic pl-5">
              {t("folderSync.confirmDialog.andMore", {
                count: overflow,
                defaultValue: "…and {{count}} more",
              })}
            </li>
          )}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("folderSync.confirmDialog.nothingToSync", "Everything is already up to date.")}
        </p>
      )}
    </ActionDialog>
  );
};
