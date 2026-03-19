"use client";

import { type JSX, useEffect, useState, useRef } from "react";
import Dialog, {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@stellarUI/components/Dialog/Dialog";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import { cn } from "@stellarUI/lib/Utils";
import { GetMediaType } from "@/lib/MediaUtils";
import { GetApiEndpoint } from "@/lib/PublicEnv";
import { MediaViewer } from "../../MediaViewer/MediaViewer";

interface MediaPreviewModalProps {
  isOpen: boolean;
  fileName: string;
  filePath: string;
  serverId: string;
  onClose: () => void;
  fetchFile: (serverId: string, path: string) => Promise<string>;
  fileSize?: string;
  fileSizeBytes?: number;
  modified?: string;
  fileType?: "folder" | "file";
}

/**
 * Modal for previewing media files from the file browser
 */
export const MediaPreviewModal = ({
  isOpen,
  fileName,
  filePath,
  serverId,
  onClose,
  fetchFile,
  fileSize,
  fileSizeBytes,
  modified,
  fileType,
}: MediaPreviewModalProps): JSX.Element => {
  const [content, setContent] = useState<string>("");
  const [blobUrl, setBlobUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string>("");

  // Update ref when blobUrl changes
  useEffect(() => {
    blobUrlRef.current = blobUrl;
  }, [blobUrl]);

  useEffect(() => {
    if (!isOpen) {
      // Clean up blob URL when modal closes
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = "";
      }
      setBlobUrl("");
      setContent("");
      setError(null);
      return;
    }

    let cancelled = false;

    const loadMedia = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Clean up previous blob URL
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = "";
        }
        setBlobUrl("");

        const mediaType = GetMediaType(fileName);

        // For binary media (video/audio/images), use the binary download endpoint
        if (
          mediaType === "video" ||
          mediaType === "audio" ||
          (mediaType === "image" && !fileName.endsWith(".svg"))
        ) {
          try {
            // Use the API's download endpoint with token authentication
            const { servers } = await import("@/lib/Api");
            const { token } = await servers.files.getDownloadToken(serverId, filePath);

            if (cancelled) return;

            const downloadUrl = GetApiEndpoint(
              `/api/servers/${serverId}/files/download?token=${token}`
            );

            const response = await fetch(downloadUrl, {
              credentials: "include", // Include cookies for auth
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            if (cancelled) return;

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            blobUrlRef.current = url;
            setBlobUrl(url);
          } catch (binaryErr) {
            if (cancelled) return;
            console.error("Failed to load binary file:", binaryErr);
            setError("Failed to load media file. Please try again.");
          }
        } else {
          // For text-based files (SVG, etc), use text API
          try {
            const data = await fetchFile(serverId, filePath);
            if (cancelled) return;
            setContent(data);
          } catch (textErr) {
            if (cancelled) return;
            console.error("Failed to load text file:", textErr);
            setError("Failed to load media file. Please try again.");
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load media file");
        console.error("Media load error:", err);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadMedia();

    return () => {
      cancelled = true;
      // Cleanup will happen in the next effect when isOpen changes
    };
  }, [isOpen, fileName, filePath, serverId]); // Removed fetchFile from dependencies

  const mediaType = GetMediaType(fileName);
  const isMedia = mediaType !== "unknown";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full min-w-6xl">
        <DialogHeader>
          <DialogTitle className="max-w-md overflow-hidden text-clip text-zinc-200"></DialogTitle>
        </DialogHeader>

        <div
          className={cn(
            "flex items-center justify-center",
            mediaType === "video" ? "min-h-[400px]" : "min-h-[300px]"
          )}
        >
          {isLoading ? (
            <Spinner />
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
              fileSize={fileSize}
              fileSizeBytes={fileSizeBytes}
              modified={modified}
              fileType={fileType}
            />
          ) : (
            <p className="text-sm text-zinc-400">Unsupported file type or empty content</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
