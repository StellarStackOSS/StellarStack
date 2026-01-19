"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Spinner } from "@workspace/ui/components/spinner";
import { cn } from "@workspace/ui/lib/utils";
import { getMediaType } from "@/lib/media-utils";
import { MediaViewer } from "./MediaViewer";

interface MediaPreviewModalProps {
  isOpen: boolean;
  fileName: string;
  filePath: string;
  serverId: string;
  onClose: () => void;
  fetchFile: (serverId: string, path: string) => Promise<string>;
}

/**
 * Modal for previewing media files from the file browser
 */
export function MediaPreviewModal({
  isOpen,
  fileName,
  filePath,
  serverId,
  onClose,
  fetchFile,
}: MediaPreviewModalProps) {
  const [content, setContent] = useState<string>("");
  const [blobUrl, setBlobUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadMedia = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setBlobUrl("");

        const mediaType = getMediaType(fileName);
        const apiUrl =
          typeof window !== "undefined" &&
          window.location.hostname !== "localhost" &&
          window.location.hostname !== "127.0.0.1"
            ? window.location.origin
            : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

        // For binary media (video/audio/images), use the binary download endpoint
        if (mediaType === "video" || mediaType === "audio" || (mediaType === "image" && !fileName.endsWith(".svg"))) {
          try {
            // Use the public download endpoint with server and file parameters
            const downloadUrl = `${apiUrl}/download/file?server=${encodeURIComponent(serverId)}&file=${encodeURIComponent(filePath)}`;
            const response = await fetch(downloadUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setBlobUrl(url);
          } catch (binaryErr) {
            console.error("Failed to load binary file:", binaryErr);
            setError("Failed to load media file. Please try again.");
          }
        } else {
          // For text-based files (SVG, etc), use text API
          try {
            const data = await fetchFile(serverId, filePath);
            setContent(data);
          } catch (textErr) {
            console.error("Failed to load text file:", textErr);
            setError("Failed to load media file. Please try again.");
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load media file");
        console.error("Media load error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadMedia();

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [isOpen, fileName, filePath, serverId, fetchFile]);

  const mediaType = getMediaType(fileName);
  const isMedia = mediaType !== "unknown";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "border-zinc-700 bg-black/80 backdrop-blur-sm",
        mediaType === "video" ? "max-w-4xl" : mediaType === "audio" ? "max-w-2xl" : "max-h-[80vh]"
      )}>
        <DialogHeader>
          <DialogTitle className="text-zinc-200">{fileName}</DialogTitle>
        </DialogHeader>

        <div className={cn(
          "flex items-center justify-center",
          mediaType === "video" ? "min-h-[400px]" : "min-h-[300px]"
        )}>
          {isLoading ? (
            <Spinner className="h-8 w-8" />
          ) : error ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-red-400">Failed to load media</p>
              <p className="text-xs text-zinc-500">{error}</p>
            </div>
          ) : isMedia && (content || blobUrl) ? (
            <MediaViewer
              fileName={fileName}
              content={content}
              blobUrl={blobUrl}
            />
          ) : (
            <p className="text-sm text-zinc-400">Unsupported file type or empty content</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
