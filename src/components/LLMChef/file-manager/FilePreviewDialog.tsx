import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/llmchef/file-manager-utils";
import {
  HTML_PREVIEW_SANDBOX,
  buildSandboxedHtmlPreviewDocument,
  createPreviewBlob,
  decodePreviewText,
  type FilePreviewDescriptor,
} from "@/lib/llmchef/file-preview";
import { DownloadIcon, FileWarningIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  descriptor: FilePreviewDescriptor | null;
  data: Uint8Array | null;
  onDownload?: () => void;
}

const MAX_INLINE_TEXT_BYTES = 1024 * 1024;

const BLOB_PREVIEW_KINDS = new Set(["image", "svg", "audio", "video"]);

export const FilePreviewDialog: React.FC<FilePreviewDialogProps> = ({
  open,
  onOpenChange,
  descriptor,
  data,
  onDownload,
}) => {
  const { t } = useTranslation("vfs");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  const isBlobPreview =
    descriptor !== null && BLOB_PREVIEW_KINDS.has(descriptor.kind);

  useEffect(() => {
    if (!open || !descriptor || !data || !isBlobPreview) {
      setObjectUrl(null);
      return;
    }

    const url = URL.createObjectURL(createPreviewBlob(data, descriptor));
    setObjectUrl(url);

    return () => {
      URL.revokeObjectURL(url);
      setObjectUrl(null);
    };
  }, [data, descriptor, isBlobPreview, open]);

  const textPreview = useMemo(() => {
    if (!descriptor || !data) return null;
    if (data.byteLength > MAX_INLINE_TEXT_BYTES) return null;
    if (
      descriptor.kind !== "html" &&
      descriptor.kind !== "json" &&
      descriptor.kind !== "markdown" &&
      descriptor.kind !== "code" &&
      descriptor.kind !== "text"
    ) {
      return null;
    }

    const text = decodePreviewText(data);
    if (descriptor.kind !== "json") return text;

    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }, [data, descriptor]);

  const renderPreview = () => {
    if (!descriptor || !data) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          {t("filePreview.noFileSelected", "No file selected.")}
        </div>
      );
    }

    if (!descriptor.canPreview) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <FileWarningIcon className="h-8 w-8" />
          <p>
            {descriptor.reason ??
              t("filePreview.unavailable", "Preview unavailable.")}
          </p>
        </div>
      );
    }

    if (textPreview === null && !isBlobPreview) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <FileWarningIcon className="h-8 w-8" />
          <p>
            {t(
              "filePreview.tooLarge",
              "This file is too large to preview inline."
            )}
          </p>
        </div>
      );
    }

    if (descriptor.kind === "html" && textPreview !== null) {
      return (
        <iframe
          title={descriptor.name}
          sandbox={HTML_PREVIEW_SANDBOX}
          srcDoc={buildSandboxedHtmlPreviewDocument(textPreview)}
          className="h-full w-full border-0 bg-white"
        />
      );
    }

    if (
      (descriptor.kind === "image" || descriptor.kind === "svg") &&
      objectUrl
    ) {
      return (
        <div className="flex h-full items-center justify-center bg-muted/20">
          <img
            src={objectUrl}
            alt={descriptor.name}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      );
    }

    if (descriptor.kind === "audio" && objectUrl) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <audio controls src={objectUrl} className="w-full max-w-2xl">
            {t(
              "filePreview.audioUnsupported",
              "Audio preview is not supported by this browser."
            )}
          </audio>
        </div>
      );
    }

    if (descriptor.kind === "video" && objectUrl) {
      return (
        <div className="flex h-full items-center justify-center bg-muted/20">
          <video controls src={objectUrl} className="max-h-full max-w-full">
            {t(
              "filePreview.videoUnsupported",
              "Video preview is not supported by this browser."
            )}
          </video>
        </div>
      );
    }

    return (
      <pre className="h-full overflow-auto whitespace-pre-wrap break-words bg-muted/20 p-4 font-mono text-xs leading-relaxed text-foreground">
        {textPreview}
      </pre>
    );
  };

  const description = descriptor
    ? [
        descriptor.path,
        descriptor.size !== null ? formatBytes(descriptor.size) : null,
        descriptor.mimeType || descriptor.kind,
      ]
        .filter(Boolean)
        .join(" | ")
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[88vh] max-h-[900px] w-[min(1100px,calc(100vw-2rem))] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-3 p-4 sm:p-5">
        <DialogHeader className="min-w-0 pr-8">
          <DialogTitle className="truncate text-base">
            {descriptor?.name ?? t("filePreview.title", "File preview")}
          </DialogTitle>
          <DialogDescription className="truncate font-mono text-xs">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div
          className={cn(
            "min-h-0 overflow-hidden border bg-background",
            descriptor?.kind === "html" && "bg-white"
          )}
        >
          {renderPreview()}
        </div>
        <DialogFooter>
          {onDownload && (
            <Button variant="outline" size="sm" onClick={onDownload}>
              <DownloadIcon className="mr-2 h-4 w-4" />
              {t("filePreview.download", "Download")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
