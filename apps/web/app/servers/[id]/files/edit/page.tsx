"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { ArrowLeft, File, Loader2, Save } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { FadeIn } from "@workspace/ui/components/fade-in";
import { Spinner } from "@workspace/ui/components/spinner";
import { detectLanguage, FileEditor } from "@/components/FileEditor/FileEditor";
import { useFileContent, useFileMutations } from "@/hooks/queries";
import { TextureButton } from "@workspace/ui/components/texture-button";
import { TextureBadge } from "@workspace/ui/components/TextureBadge/TextureBadge";
import { MediaViewer } from "@/components/MediaViewer/MediaViewer";
import { getMediaType } from "@/lib/media-utils";
import { getApiEndpoint } from "@/lib/public-env";
import { servers } from "@/lib/api";

export default function FileEditPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  useTheme(); // Theme context required for editor

  const serverId = params.id as string;
  const filePath = searchParams.get("path") || "";
  const fileName = filePath.split("/").pop() || "file";

  // Fetch file content
  const { data: originalContent, isLoading, error } = useFileContent(serverId, filePath);

  // File mutations
  const { write } = useFileMutations(serverId);

  // Local state for editing
  const [content, setContent] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [blobUrl, setBlobUrl] = useState("");
  const blobUrlRef = useRef<string>("");

  // Set initial content when loaded
  useEffect(() => {
    if (originalContent !== undefined) {
      setContent(originalContent);
      setHasChanges(false);
    }
  }, [originalContent]);

  // Track changes
  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      setHasChanges(newContent !== originalContent);
    },
    [originalContent]
  );

  // Handle save
  const handleSave = async () => {
    try {
      await write.mutateAsync({ path: filePath, content });
      setHasChanges(false);
      toast.success("File saved successfully");
    } catch (err) {
      toast.error("Failed to save file");
      console.error("Save error:", err);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (hasChanges) {
      const confirmed = window.confirm("You have unsaved changes. Are you sure you want to leave?");
      if (!confirmed) return;
    }

    // Navigate back to files page
    const parentPath = filePath.split("/").slice(0, -1).join("/");
    router.push(`/servers/${serverId}/files${parentPath ? `/${parentPath}` : ""}`);
  };

  // Update ref when blobUrl changes
  useEffect(() => {
    blobUrlRef.current = blobUrl;
  }, [blobUrl]);

  // Load blob URL for media files
  useEffect(() => {
    if (!fileName || !serverId || !filePath) return;

    let cancelled = false;

    const loadBlobUrl = async () => {
      try {
        const mediaType = getMediaType(fileName);
        if (mediaType !== "unknown" && !fileName.endsWith(".svg")) {
          // For binary media files, use the download endpoint with token
          try {
            const { token } = await servers.files.getDownloadToken(serverId, filePath);

            if (cancelled) return;

            const downloadUrl = getApiEndpoint(
              `/api/servers/${serverId}/files/download?token=${token}`
            );
            const response = await fetch(downloadUrl, {
              credentials: "include", // Include cookies for auth
            });
            if (response.ok && !cancelled) {
              const blob = await response.blob();
              if (!cancelled) {
                const url = URL.createObjectURL(blob);
                blobUrlRef.current = url;
                setBlobUrl(url);
              }
            }
          } catch (err) {
            if (!cancelled) {
              console.debug("Could not load blob URL, will use data URL:", err);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("Failed to load blob URL for media:", err);
        }
      }
    };

    // Clean up previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = "";
      setBlobUrl("");
    }

    loadBlobUrl();

    return () => {
      cancelled = true;
      // Clean up blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = "";
      }
    };
  }, [fileName, serverId, filePath]);

  // Warn on page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  const language = detectLanguage(fileName);

  const mediaType = getMediaType(fileName);
  const isMedia = mediaType !== "unknown";

  return (
    <div className={cn("relative min-h-screen", "bg-black")}>
      {/* Background is now rendered in the layout for persistence */}

      <div className="relative z-10 flex h-screen flex-col">
        {/* Header */}
        <FadeIn>
          <header
            className={cn(
              "flex items-center justify-between border-b px-6 py-4",
              "border-zinc-800 bg-black/50"
            )}
          >
            <div className="flex items-center gap-4">
              <TextureButton variant="minimal" onClick={handleBack}>
                <ArrowLeft className="h-5 w-5" />
              </TextureButton>

              <div className="flex items-center gap-3">
                <div className={cn("border p-2", "border-zinc-700 bg-zinc-800")}>
                  <File className={cn("h-5 w-5", "text-zinc-400")} />
                </div>
                <div>
                  <h1 className={cn("text-lg font-medium", "text-white")}>{fileName}</h1>
                  <p className={cn("text-xs", "text-zinc-500")}>{filePath}</p>
                </div>
              </div>

              {hasChanges && (
                <span className={cn("border px-2 py-1 text-xs", "border-zinc-600 text-zinc-400")}>
                  Unsaved changes
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <TextureBadge variant="accent" className="uppercase">
                {language}
              </TextureBadge>

              <TextureButton
                variant="minimal"
                onClick={handleSave}
                disabled={!hasChanges || write.isPending}
              >
                {write.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </TextureButton>
            </div>
          </header>
        </FadeIn>

        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner className="h-8 w-8" />
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <p className={cn("text-lg", "text-red-400")}>Failed to load file</p>
              <TextureButton variant="minimal" onClick={handleBack}>
                Go Back
              </TextureButton>
            </div>
          ) : isMedia ? (
            <div className="flex h-full overflow-auto p-8">
              <div className="mx-auto w-full">
                <MediaViewer
                  fileName={fileName}
                  content={originalContent || ""}
                  blobUrl={blobUrl}
                />
              </div>
            </div>
          ) : (
            <FileEditor
              value={content}
              onChange={handleContentChange}
              filename={fileName}
              height="100%"
              className="h-full rounded-none border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}
