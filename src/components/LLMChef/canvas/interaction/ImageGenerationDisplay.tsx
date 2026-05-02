import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Copy, Palette } from "lucide-react";
import type { ImageGenerationResult } from "@/services/ai-image-generation.service";
import { assertAllowedOutboundUrl } from "@/lib/llmchef/outbound-policy";

interface ImageGenerationDisplayProps {
  result: ImageGenerationResult;
  prompt: string;
  className?: string;
}

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/data:([^;]+)/)?.[1] || "application/octet-stream";
  const binary = atob(data || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
};

export const ImageGenerationDisplay: React.FC<ImageGenerationDisplayProps> = ({
  result,
  prompt,
  className = "",
}) => {
  const [displayUrl, setDisplayUrl] = useState<string | null>(
    result.image.startsWith("http") ? null : result.image,
  );
  const [imageBlob, setImageBlob] = useState<Blob | null>(
    result.image.startsWith("data:") ? dataUrlToBlob(result.image) : null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const isRemoteImage = useMemo(() => result.image.startsWith("http"), [result.image]);

  useEffect(() => {
    if (!isRemoteImage) {
      setDisplayUrl(result.image);
      setImageBlob(result.image.startsWith("data:") ? dataUrlToBlob(result.image) : null);
      setLoadError(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    const loadRemoteImage = async () => {
      try {
        setDisplayUrl(null);
        setLoadError(null);
        const allowedUrl = assertAllowedOutboundUrl(
          result.image,
          "image-generation:render",
        );
        const response = await fetch(allowedUrl);
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setImageBlob(blob);
          setDisplayUrl(objectUrl);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      }
    };

    void loadRemoteImage();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isRemoteImage, result.image]);

  const handleDownload = () => {
    if (!displayUrl) return;
    // Create a download link for the image
    const link = document.createElement("a");
    link.href = displayUrl;
    link.download = `generated-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyImage = async () => {
    try {
      if (!displayUrl) return;
      const blob = imageBlob;
      if (!blob) return;
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
    } catch (error) {
      console.error("Failed to copy image:", error);
    }
  };

  return (
    <Card className={`w-full max-w-2xl ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Palette className="h-4 w-4 text-pink-500" />
          <span className="text-sm font-medium">Generated Image</span>
          <Badge variant="secondary" className="text-xs">
            {result.finishReason}
          </Badge>
        </div>
        
        <div className="space-y-3">
          <div className="relative group">
            {displayUrl ? (
              <img
                src={displayUrl}
                alt={`Generated image: ${prompt}`}
                className="w-full rounded-lg shadow-md"
                style={{ maxHeight: "512px", objectFit: "contain" }}
              />
            ) : (
              <div className="flex min-h-40 items-center justify-center rounded-lg border border-border bg-muted text-sm text-muted-foreground">
                {loadError ? `Image blocked: ${loadError}` : "Loading generated image..."}
              </div>
            )}
            
            {/* Action buttons overlay */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 w-8 p-0"
                  onClick={handleCopyImage}
                  disabled={!displayUrl}
                  title="Copy image"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 w-8 p-0"
                  onClick={handleDownload}
                  disabled={!displayUrl}
                  title="Download image"
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground">
            <strong>Prompt:</strong> {prompt}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 
