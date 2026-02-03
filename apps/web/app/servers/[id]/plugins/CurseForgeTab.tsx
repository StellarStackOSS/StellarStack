"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@stellarUI/lib/utils";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import Input from "@stellarUI/components/Input/Input";
import { Badge } from "@stellarUI/components/Badge/Badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@stellarUI/components/Dialog/Dialog";
import ConfirmationModal from "@stellarUI/components/ConfirmationModal/ConfirmationModal";
import {
  BsSearch,
  BsDownload,
  BsBox,
  BsClock,
  BsExclamationTriangle,
  BsChevronLeft,
  BsChevronRight,
} from "react-icons/bs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { pluginsApi, type CurseForgeSearchResult } from "@/lib/api";
import { toast } from "sonner";

interface CurseForgeTabProps {
  serverId: string;
  pluginConfig: Record<string, unknown>;
}

type ModpackResult = CurseForgeSearchResult["data"][0];

const PAGE_SIZE = 12;

export const CurseForgeTab: React.FC<CurseForgeTabProps> = ({ serverId, pluginConfig }) => {
  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedMod, setSelectedMod] = useState<ModpackResult | null>(null);
  const [installTarget, setInstallTarget] = useState<{ mod: ModpackResult; fileId: number } | null>(
    null
  );

  const hasApiKey = !!(pluginConfig?.apiKey as string);

  // Single query for both search and popular (empty query = popular by downloads)
  const {
    data: results,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["curseforge", "search", activeQuery, pageIndex],
    queryFn: () =>
      pluginsApi.curseforge.search({
        query: activeQuery || undefined,
        pageSize: PAGE_SIZE,
        index: pageIndex * PAGE_SIZE,
      }),
    enabled: hasApiKey,
    placeholderData: (prev) => prev,
  });

  const installMutation = useMutation({
    mutationFn: ({ modId, fileId }: { modId: number; fileId: number }) =>
      pluginsApi.curseforge.install(serverId, modId, fileId),
    onSuccess: (data) => {
      toast.success(data.message || "Modpack installation started");
      setInstallTarget(null);
      setSelectedMod(null);
    },
    onError: () => {
      toast.error("Failed to install modpack");
    },
  });

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setActiveQuery(searchInput);
      setPageIndex(0);
    },
    [searchInput]
  );

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setActiveQuery("");
    setPageIndex(0);
  }, []);

  const handleInstallClick = useCallback((mod: ModpackResult, fileId?: number) => {
    const fId = fileId || mod.latestFiles?.[0]?.id;
    if (!fId) {
      toast.error("No files available for this modpack");
      return;
    }
    setInstallTarget({ mod, fileId: fId });
  }, []);

  const confirmInstall = useCallback(() => {
    if (!installTarget) return;
    installMutation.mutate({
      modId: installTarget.mod.id,
      fileId: installTarget.fileId,
    });
  }, [installTarget, installMutation]);

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

  const modpacks = results?.data || [];
  const totalResults = results?.pagination?.totalCount ?? modpacks.length;
  const totalPages = Math.ceil(totalResults / PAGE_SIZE);
  const currentPage = pageIndex + 1;

  // No API key
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
    <div className="space-y-4 p-4">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <Input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search CurseForge modpacks..."
          className="flex-1 border-zinc-700/50 bg-zinc-900/50 text-zinc-200 placeholder:text-zinc-600"
        />
        <TextureButton type="submit" variant="primary" size="sm">
          Search
        </TextureButton>
        {activeQuery && (
          <TextureButton type="button" variant="minimal" size="sm" onClick={handleClearSearch}>
            Clear
          </TextureButton>
        )}
      </form>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">
          {activeQuery ? `Results for "${activeQuery}"` : "Popular Modpacks"}
        </h3>
        <div className="flex items-center gap-3">
          {isFetching && !isLoading && <Spinner className="h-4 w-4 text-zinc-500" />}
          {totalResults > 0 && (
            <span className="text-xs text-zinc-500">
              {totalResults.toLocaleString()} result{totalResults !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner className="h-6 w-6 text-zinc-400" />
        </div>
      )}

      {/* Results Grid */}
      {!isLoading && modpacks.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modpacks.map((mod) => (
            <div
              key={mod.id}
              className={cn(
                "group flex cursor-pointer flex-col rounded-lg border border-zinc-800/50 bg-zinc-950/30 p-3 transition-all",
                "hover:border-zinc-700/50 hover:bg-zinc-900/30"
              )}
              onClick={() => setSelectedMod(mod)}
            >
              <div className="mb-2 flex items-start gap-3">
                {mod.logo?.thumbnailUrl ? (
                  <img
                    src={mod.logo.thumbnailUrl}
                    alt={mod.name}
                    className="h-10 w-10 flex-shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-zinc-800">
                    <BsBox className="h-5 w-5 text-zinc-600" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-medium text-zinc-200">{mod.name}</h4>
                  <p className="text-xs text-zinc-500">by {mod.authors?.[0]?.name || "Unknown"}</p>
                </div>
              </div>

              <p className="mb-3 line-clamp-2 flex-1 text-xs leading-relaxed text-zinc-500">
                {mod.summary}
              </p>

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
                  className="w-fit"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleInstallClick(mod);
                  }}
                >
                  Install
                </TextureButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {!isLoading && modpacks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BsSearch className="mb-4 h-12 w-12 text-zinc-700" />
          <p className="text-sm text-zinc-500">
            No modpacks found{activeQuery ? ` for "${activeQuery}"` : ""}.
          </p>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-2">
          <button
            disabled={pageIndex === 0 || isFetching}
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            className="flex h-8 w-8 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:pointer-events-none disabled:opacity-30"
          >
            <BsChevronLeft className="h-3.5 w-3.5" />
          </button>

          {/* Page numbers */}
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let page: number;
            if (totalPages <= 7) {
              page = i;
            } else if (pageIndex < 3) {
              page = i;
            } else if (pageIndex > totalPages - 4) {
              page = totalPages - 7 + i;
            } else {
              page = pageIndex - 3 + i;
            }
            return (
              <button
                key={page}
                onClick={() => setPageIndex(page)}
                disabled={isFetching}
                className={cn(
                  "h-8 w-8 rounded text-xs font-medium transition-colors",
                  page === pageIndex
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                )}
              >
                {page + 1}
              </button>
            );
          })}

          <button
            disabled={pageIndex >= totalPages - 1 || isFetching}
            onClick={() => setPageIndex((p) => p + 1)}
            className="flex h-8 w-8 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:pointer-events-none disabled:opacity-30"
          >
            <BsChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog
        open={!!selectedMod}
        onOpenChange={(open) => {
          if (!open) setSelectedMod(null);
        }}
      >
        <DialogContent className="max-w-2xl border-zinc-800 bg-zinc-900">
          {selectedMod && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {selectedMod.logo?.thumbnailUrl && (
                    <img
                      src={selectedMod.logo.thumbnailUrl}
                      alt={selectedMod.name}
                      className="h-12 w-12 rounded object-cover"
                    />
                  )}
                  <div>
                    <DialogTitle className="text-lg font-semibold text-zinc-100">
                      {selectedMod.name}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-zinc-400">
                      by {selectedMod.authors?.[0]?.name || "Unknown"} &middot;{" "}
                      {formatDownloads(selectedMod.downloadCount)} downloads
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                {/* Description */}
                <div className="rounded border border-zinc-800 bg-zinc-950/50 p-4">
                  <p className="text-sm leading-relaxed text-zinc-300">{selectedMod.summary}</p>
                </div>

                {/* Stats row */}
                <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <BsDownload className="h-3.5 w-3.5" />
                    {selectedMod.downloadCount.toLocaleString()} downloads
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BsClock className="h-3.5 w-3.5" />
                    Updated {formatDate(selectedMod.dateModified)}
                  </span>
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

                {/* Quick install */}
                <TextureButton
                  variant="primary"
                  className="w-full"
                  onClick={() => handleInstallClick(selectedMod)}
                  disabled={installMutation.isPending}
                >
                  <BsDownload className="mr-2 h-4 w-4" />
                  Install Latest Version
                </TextureButton>

                {/* Version list */}
                {selectedMod.latestFiles?.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-zinc-300">Available Versions</h4>
                    <div className="max-h-48 space-y-2 overflow-y-auto">
                      {selectedMod.latestFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/30 p-3"
                        >
                          <div className="mr-3 min-w-0 flex-1">
                            <p className="truncate text-sm text-zinc-200">{file.displayName}</p>
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
                            className="flex-shrink-0"
                            onClick={() => handleInstallClick(selectedMod, file.id)}
                            disabled={installMutation.isPending}
                          >
                            Install
                          </TextureButton>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Install Confirmation */}
      <ConfirmationModal
        open={!!installTarget}
        onOpenChange={(open) => {
          if (!open) setInstallTarget(null);
        }}
        title="Install Modpack"
        description={`Are you sure you want to install "${installTarget?.mod.name}"? This will download the modpack files to your server.${pluginConfig?.backupBeforeInstall ? " A backup will be created first." : ""}`}
        confirmLabel={installMutation.isPending ? "Installing..." : "Install"}
        onConfirm={confirmInstall}
        isLoading={installMutation.isPending}
      />
    </div>
  );
};
