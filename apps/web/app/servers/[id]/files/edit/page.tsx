"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { ArrowLeft, File, Loader2, Save } from "lucide-react";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import { detectLanguage, FileEditor } from "@/components/FileEditor/FileEditor";
import { useFileContent, useFileMutations } from "@/hooks/queries/UseFiles";
import { TextureButton } from "@stellarUI/components/TextureButton";
import TextureBadge from "@stellarUI/components/TextureBadge/TextureBadge";
import { MediaViewer } from "@/components/MediaViewer/MediaViewer";
import { GetMediaType } from "@/lib/MediaUtils";
import { GetApiEndpoint } from "@/lib/PublicEnv";
import { servers } from "@/lib/Api";

export default function FileEditPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resolvedTheme } = useTheme();

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
        const mediaType = GetMediaType(fileName);
        if (mediaType !== "unknown" && !fileName.endsWith(".svg")) {
          // For binary media files, use the download endpoint with token
          try {
            const { token } = await servers.files.getDownloadToken(serverId, filePath);

            if (cancelled) return;

            const downloadUrl = GetApiEndpoint(
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

  const mediaType = GetMediaType(fileName);
  const isMedia = mediaType !== "unknown";

  return (
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        <div className="bg-card relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg px-4 pb-4">
          {/* Header */}
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <TextureButton variant="minimal" size="sm" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-xs tracking-wider uppercase">Back</span>
                </TextureButton>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-300">{fileName}</span>
                  <span className="text-xs text-zinc-600">{filePath}</span>
                </div>
                {hasChanges && (
                  <TextureBadge variant="warning" className="uppercase">
                    Unsaved
                  </TextureBadge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <TextureBadge variant="accent" className="uppercase">
                  {language}
                </TextureBadge>
                <TextureButton
                  variant="primary"
                  size="sm"
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
            </div>
          </FadeIn>

          {/* Editor Card */}
          <FadeIn delay={0.05} className="flex flex-1 flex-col">
            <div className="bg-muted flex flex-1 flex-col rounded-lg border border-white/5 p-1 pt-2">
              <div className="flex shrink-0 items-center gap-2 pb-2 pl-2 text-xs opacity-50">
                <File className="h-3 w-3" />
                Editor
              </div>
              <div className="from-card via-secondary to-background flex flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200/10 bg-gradient-to-b shadow-lg shadow-black/20">
                {isLoading ? (
                  <div className="flex flex-1 items-center justify-center py-12">
                    <Spinner />
                  </div>
                ) : error ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12">
                    <File className="mb-4 h-12 w-12 text-zinc-600" />
                    <h3 className="text-sm font-medium text-zinc-300">Failed to load file</h3>
                    <p className="text-xs text-zinc-500">
                      The file could not be read from the server.
                    </p>
                    <TextureButton variant="minimal" size="sm" onClick={handleBack}>
                      Go Back
                    </TextureButton>
                  </div>
                ) : isMedia ? (
                  <div className="flex flex-1 overflow-auto p-8">
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
          </FadeIn>
        </div>
      </div>
    </FadeIn>
  );
}
