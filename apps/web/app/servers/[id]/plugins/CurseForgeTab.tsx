"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { TextureButton } from "@workspace/ui/components/texture-button";
import { Spinner } from "@workspace/ui/components/spinner";
import { Input } from "@workspace/ui/components";
import { Badge } from "@workspace/ui/components/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { ConfirmationModal } from "@workspace/ui/components/confirmation-modal";
import {
  BsSearch,
  BsDownload,
  BsArrowRepeat,
  BsBox,
  BsClock,
  BsPeople,
  BsExclamationTriangle,
} from "react-icons/bs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { pluginsApi, type CurseForgeSearchResult } from "@/lib/api";
import { toast } from "sonner";

interface CurseForgeTabProps {
  serverId: string;
  pluginConfig: Record<string, unknown>;
}

type ModpackResult = CurseForgeSearchResult["data"][0];

export const CurseForgeTab: React.FC<CurseForgeTabProps> = ({ serverId, pluginConfig }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedMod, setSelectedMod] = useState<ModpackResult | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [installConfirmOpen, setInstallConfirmOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);

  const hasApiKey = !!(pluginConfig?.apiKey as string);

  // Search modpacks
  const {
    data: searchResults,
    isLoading: isSearching,
    refetch,
  } = useQuery({
    queryKey: ["curseforge", "search", searchQuery],
    queryFn: () =>
      pluginsApi.curseforge.search({
        query: searchQuery,
        pageSize: 20,
      }),
    enabled: hasApiKey && searchQuery.length > 0,
  });

  // Popular modpacks (default view)
  const { data: popularResults, isLoading: isLoadingPopular } = useQuery({
    queryKey: ["curseforge", "popular"],
    queryFn: () =>
      pluginsApi.curseforge.search({
        pageSize: 12,
      }),
    enabled: hasApiKey && searchQuery.length === 0,
  });

  // Install mutation
  const installMutation = useMutation({
    mutationFn: ({ modId, fileId }: { modId: number; fileId: number }) =>
      pluginsApi.curseforge.install(serverId, modId, fileId),
    onSuccess: (data) => {
      toast.success(data.message || "Modpack installation started");
      setInstallConfirmOpen(false);
      setDetailModalOpen(false);
    },
    onError: () => {
      toast.error("Failed to install modpack");
    },
  });

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSearchQuery(searchInput);
    },
    [searchInput]
  );

  const handleModClick = (mod: ModpackResult) => {
    setSelectedMod(mod);
    setDetailModalOpen(true);
  };

  const handleInstallClick = (mod: ModpackResult, fileId?: number) => {
    setSelectedMod(mod);
    const fId = fileId || mod.latestFiles?.[0]?.id;
    if (!fId) {
      toast.error("No files available for this modpack");
      return;
    }
    setSelectedFileId(fId);
    setInstallConfirmOpen(true);
  };

  const confirmInstall = () => {
    if (!selectedMod || !selectedFileId) return;
    installMutation.mutate({
      modId: selectedMod.id,
      fileId: selectedFileId,
    });
  };

  const formatDownloads = (count: number): string => {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return String(count);
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const displayResults = searchQuery ? searchResults?.data : popularResults?.data;
  const isLoading = searchQuery ? isSearching : isLoadingPopular;

  // No API key configured
  if (!hasApiKey) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <BsExclamationTriangle className="mb-4 h-12 w-12 text-amber-500" />
        <h3 className="mb-2 text-sm font-medium text-zinc-300">CurseForge API Key Required</h3>
        <p className="mb-4 max-w-md text-xs text-zinc-500">
          To browse and install CurseForge modpacks, you need to configure an API key. Go to Admin
          &gt; Plugins &gt; CurseForge Modpack Installer settings to add your key.
        </p>
        <a
          href="https://console.curseforge.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-400 underline hover:text-zinc-200"
        >
          Get a CurseForge API Key
        </a>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <BsSearch className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search CurseForge modpacks..."
            className="border-zinc-700/50 bg-zinc-900/50 pr-20 pl-9 text-zinc-200 placeholder:text-zinc-600"
          />
          <TextureButton
            type="submit"
            variant="primary"
            size="sm"
            className="absolute top-1/2 right-2 -translate-y-1/2"
          >
            Search
          </TextureButton>
        </div>
      </form>

      {/* Results Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">
          {searchQuery ? `Results for "${searchQuery}"` : "Popular Modpacks"}
        </h3>
        {displayResults && (
          <span className="text-xs text-zinc-500">{displayResults.length} result(s)</span>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner className="h-6 w-6 text-zinc-400" />
        </div>
      )}

      {/* Results Grid */}
      {!isLoading && displayResults && displayResults.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayResults.map((mod) => (
            <div
              key={mod.id}
              className={cn(
                "group flex cursor-pointer flex-col rounded-lg border border-zinc-800/50 bg-zinc-950/30 p-3 transition-all",
                "hover:border-zinc-700/50 hover:bg-zinc-900/30"
              )}
              onClick={() => handleModClick(mod)}
            >
              {/* Mod Header */}
              <div className="mb-2 flex items-start gap-3">
                {mod.logo?.thumbnailUrl ? (
                  <img
                    src={mod.logo.thumbnailUrl}
                    alt={mod.name}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800">
                    <BsBox className="h-5 w-5 text-zinc-600" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-medium text-zinc-200">{mod.name}</h4>
                  <p className="text-xs text-zinc-500">by {mod.authors?.[0]?.name || "Unknown"}</p>
                </div>
              </div>

              {/* Description */}
              <p className="mb-3 line-clamp-2 flex-1 text-xs leading-relaxed text-zinc-500">
                {mod.summary}
              </p>

              {/* Footer Stats */}
              <div className="flex items-center justify-between border-t border-zinc-800/50 pt-2">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-zinc-600">
                    <BsDownload className="h-3 w-3" />
                    {formatDownloads(mod.downloadCount)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-zinc-600">
                    <BsClock className="h-3 w-3" />
                    {formatDate(mod.dateModified)}
                  </span>
                </div>
                <TextureButton
                  variant="primary"
                  size="sm"
                  className="w-fit opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleInstallClick(mod);
                  }}
                >
                  <BsDownload className="h-3 w-3" />
                  Install
                </TextureButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {!isLoading && displayResults && displayResults.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BsSearch className="mb-4 h-12 w-12 text-zinc-700" />
          <p className="text-sm text-zinc-500">
            No modpacks found{searchQuery ? ` for "${searchQuery}"` : ""}.
          </p>
        </div>
      )}

      {/* Mod Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {selectedMod?.logo?.thumbnailUrl && (
                <img
                  src={selectedMod.logo.thumbnailUrl}
                  alt={selectedMod.name}
                  className="h-12 w-12 rounded object-cover"
                />
              )}
              <div>
                <DialogTitle className="text-lg font-semibold text-zinc-100">
                  {selectedMod?.name}
                </DialogTitle>
                <DialogDescription className="text-sm text-zinc-400">
                  by {selectedMod?.authors?.[0]?.name || "Unknown"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedMod && (
            <div className="mt-4 space-y-4">
              {/* Stats */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <BsDownload className="h-4 w-4" />
                  {formatDownloads(selectedMod.downloadCount)} downloads
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <BsClock className="h-4 w-4" />
                  Updated {formatDate(selectedMod.dateModified)}
                </div>
              </div>

              {/* Description */}
              <div className="rounded border border-zinc-800 bg-zinc-950/50 p-4">
                <p className="text-sm leading-relaxed text-zinc-300">{selectedMod.summary}</p>
              </div>

              {/* Categories */}
              {selectedMod.categories?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedMod.categories.map((cat) => (
                    <Badge
                      key={cat.id}
                      variant="outline"
                      className="border-zinc-700 text-xs text-zinc-400"
                    >
                      {cat.name}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Available Versions */}
              {selectedMod.latestFiles?.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-zinc-300">Available Versions</h4>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {selectedMod.latestFiles.slice(0, 5).map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/30 p-3"
                      >
                        <div>
                          <p className="text-sm text-zinc-200">{file.displayName}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs text-zinc-500">
                              {file.gameVersions?.slice(0, 3).join(", ")}
                            </span>
                            <span className="text-xs text-zinc-600">
                              {formatDate(file.fileDate)}
                            </span>
                          </div>
                        </div>
                        <TextureButton
                          variant="primary"
                          size="sm"
                          className="w-fit"
                          onClick={() => handleInstallClick(selectedMod, file.id)}
                        >
                          <BsDownload className="h-3 w-3" />
                          Install
                        </TextureButton>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Install Confirmation */}
      <ConfirmationModal
        open={installConfirmOpen}
        onOpenChange={setInstallConfirmOpen}
        title="Install Modpack"
        description={`Are you sure you want to install "${selectedMod?.name}"? This will download the modpack files to your server. ${pluginConfig.backupBeforeInstall ? "A backup will be created first." : ""}`}
        confirmLabel={installMutation.isPending ? "Installing..." : "Install"}
        onConfirm={confirmInstall}
      />
    </div>
  );
};
