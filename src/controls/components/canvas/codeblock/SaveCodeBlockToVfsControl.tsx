import React, { useCallback, useMemo, useState } from "react";
import { ActionTooltipButton } from "@/components/LLMChef/common/ActionTooltipButton";
import { FilePreviewDialog } from "@/components/LLMChef/file-manager/FilePreviewDialog";
import {
  buildCodeBlockVfsPath,
  mimeTypeForCodeBlock,
} from "@/lib/llmchef/code-block-vfs";
import {
  inferFilePreviewDescriptor,
  type FilePreviewDescriptor,
} from "@/lib/llmchef/file-preview";
import { basename } from "@/lib/llmchef/file-manager-utils";
import * as VfsOps from "@/lib/llmchef/vfs-operations";
import { useVfsStore } from "@/store/vfs.store";
import { vfsEvent } from "@/types/llmchef/events/vfs.events";
import { emitter } from "@/lib/llmchef/event-emitter";
import { EyeIcon, Loader2Icon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface SaveCodeBlockToVfsControlProps {
  interactionId?: string;
  codeBlockId?: string;
  language?: string;
  codeToSave: string;
  filepath?: string;
  disabled?: boolean;
}

interface SavedPreview {
  descriptor: FilePreviewDescriptor;
  data: Uint8Array;
}

export const SaveCodeBlockToVfsControl: React.FC<
  SaveCodeBlockToVfsControlProps
> = ({
  interactionId,
  codeBlockId,
  language,
  codeToSave,
  filepath,
  disabled,
}) => {
  const { t } = useTranslation("canvas");
  const [isSaving, setIsSaving] = useState(false);
  const [preview, setPreview] = useState<SavedPreview | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const targetPath = useMemo(
    () =>
      buildCodeBlockVfsPath({
        filepath,
        language,
        interactionId,
        blockId: codeBlockId,
      }),
    [codeBlockId, filepath, interactionId, language]
  );

  const handleSave = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const viewport = document.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement;
      if (viewport) {
        (viewport as any)._isCodeblockButtonInteraction = true;
        setTimeout(() => {
          (viewport as any)._isCodeblockButtonInteraction = false;
        }, 100);
      }

      if (disabled || !codeToSave || isSaving) return;

      const fsInstance = useVfsStore.getState().fs;
      if (!fsInstance) {
        toast.error(t("actions.vfsUnavailable", "VFS is not ready."));
        return;
      }

      setIsSaving(true);
      try {
        const data = new TextEncoder().encode(codeToSave);
        await VfsOps.writeFileOp(targetPath, codeToSave, { fsInstance });
        emitter.emit(vfsEvent.fetchNodesRequest, { parentId: null });

        const descriptor = inferFilePreviewDescriptor({
          name: basename(targetPath),
          path: targetPath,
          size: data.byteLength,
          mimeType: mimeTypeForCodeBlock(language, targetPath),
        });

        setPreview({ descriptor, data });
        setIsPreviewOpen(true);
        toast.success(
          t("actions.savedToVfs", "Saved to VFS: {{path}}", {
            path: targetPath,
          })
        );
      } catch (error) {
        console.error("Failed to save code block to VFS:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : t("actions.saveToVfsFailed", "Failed to save code block to VFS.")
        );
      } finally {
        setIsSaving(false);
      }
    },
    [codeToSave, disabled, isSaving, language, t, targetPath]
  );

  return (
    <>
      <ActionTooltipButton
        tooltipText={t(
          "actions.saveToVfsAndPreview",
          "Save to VFS and preview"
        )}
        onClick={handleSave}
        aria-label={t(
          "actions.saveToVfsAndPreviewAriaLabel",
          "Save code block to VFS and preview it"
        )}
        disabled={disabled || !codeToSave || isSaving}
        icon={
          isSaving ? (
            <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
          ) : preview ? (
            <EyeIcon />
          ) : (
            <SaveIcon />
          )
        }
        iconClassName="h-3.5 w-3.5"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
      />
      <FilePreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        descriptor={preview?.descriptor ?? null}
        data={preview?.data ?? null}
      />
    </>
  );
};
