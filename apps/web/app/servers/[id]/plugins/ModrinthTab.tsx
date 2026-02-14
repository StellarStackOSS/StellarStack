"use client";

import React, { type JSX, useState, useCallback } from "react";
import { cn } from "@stellarUI/lib/Utils";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import Input from "@stellarUI/components/Input/Input";
import Badge from "@stellarUI/components/Badge/Badge";
import Dialog, {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@stellarUI/components/Dialog/Dialog";
import ConfirmationModal from "@stellarUI/components/ConfirmationModal/ConfirmationModal";
import { BsSearch, BsDownload, BsBox, BsClock, BsHeart } from "react-icons/bs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { pluginsApi } from "@/lib/Api";
import { toast } from "sonner";

interface ModrinthTabProps {
  serverId: string;
}

interface ModrinthProject {
  slug: string;
  title: string;
  description: string;
  categories: string[];
  client_side: string;
  server_side: string;
  project_type: string;
  downloads: number;
  follows: number;
  icon_url: string | null;
  date_created: string;
  date_modified: string;
  latest_version: string;
  license: string;
  versions: string[];
  game_versions: string[];
  loaders: string[];
  gallery: Array<{ url: string; title: string }>;
  author?: string;
}

interface ModrinthVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  date_published: string;
  downloads: number;
  files: Array<{
    url: string;
    filename: string;
    size: number;
  }>;
}

export const ModrinthTab = ({ serverId }: ModrinthTabProps): JSX.Element => {
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<ModrinthProject | null>(null);
  const [installTarget, setInstallTarget] = useState<{
    project: ModrinthProject;
    version?: ModrinthVersion;
  } | null>(null);

  // Search projects
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["modrinth", "search", submittedQuery],
    queryFn: async () => {
      const params: Record<string, string> = {
        facets:
          '[[\"project_type:modpack\"],[\"server_side:required\"],[\"server_side:optional\"]]',
        limit: "20",
      };
      if (submittedQuery) params.query = submittedQuery;
      else params.index = "downloads";
      const res = await pluginsApi.modrinth.search(params);
      return res as { hits: ModrinthProject[]; total_hits: number };
    },
    enabled: true,
  });

  // Get project versions when selected
  const { data: projectVersions, isLoading: isLoadingVersions } = useQuery({
    queryKey: ["modrinth", "versions", selectedProject?.slug],
    queryFn: async () => {
      if (!selectedProject) return [];
      const res = await pluginsApi.modrinth.getProjectVersions(selectedProject.slug);
      return res as ModrinthVersion[];
    },
    enabled: !!selectedProject,
  });

  // Install mutation
  const installMutation = useMutation({
    mutationFn: async ({ projectSlug, versionId }: { projectSlug: string; versionId?: string }) => {
      return pluginsApi.modrinth.install(serverId, projectSlug, versionId);
    },
    onSuccess: () => {
      toast.success("Modpack installation started");
      setInstallTarget(null);
      setSelectedProject(null);
    },
    onError: (err: Error) => {
      toast.error(`Installation failed: ${err.message}`);
    },
  });

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSubmittedQuery(searchQuery);
    },
    [searchQuery]
  );

  const handleInstall = useCallback(() => {
    if (!installTarget) return;
    installMutation.mutate({
      projectSlug: installTarget.project.slug,
      versionId: installTarget.version?.id,
    });
  }, [installTarget, installMutation]);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  };

  const projects = searchResults?.hits || [];

  return (
    <div className="space-y-6">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <BsSearch className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Modrinth modpacks..."
            className="border-zinc-800 bg-zinc-900/50 pl-10"
          />
        </div>
        <TextureButton type="submit" variant="primary" disabled={isSearching}>
          Search
        </TextureButton>
      </form>

      {/* Results */}
      {isSearching ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-6 w-6" />
          <span className="ml-3 text-zinc-400">Searching Modrinth...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="py-12 text-center text-zinc-500">
          {submittedQuery
            ? `No results found for "${submittedQuery}"`
            : "Search for modpacks to get started"}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project.slug}
              className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:border-zinc-700"
              onClick={() => setSelectedProject(project)}
            >
              <div className="flex items-start gap-3">
                {project.icon_url ? (
                  <img
                    src={project.icon_url}
                    alt={project.title}
                    className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                    <BsBox className="h-6 w-6 text-zinc-600" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-zinc-100">{project.title}</h3>
                  {project.author && <p className="text-sm text-zinc-500">by {project.author}</p>}
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-zinc-400">{project.description}</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <BsDownload className="h-3 w-3" />
                  {formatNumber(project.downloads)}
                </span>
                <span className="flex items-center gap-1">
                  <BsHeart className="h-3 w-3" />
                  {formatNumber(project.follows)}
                </span>
                <span className="flex items-center gap-1">
                  <BsClock className="h-3 w-3" />
                  {new Date(project.date_modified).toLocaleDateString()}
                </span>
              </div>
              {project.categories.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {project.categories.slice(0, 3).map((cat) => (
                    <Badge
                      key={cat}
                      variant="outline"
                      className="border-zinc-700 bg-zinc-800/50 text-xs text-zinc-400"
                    >
                      {cat}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Project Detail Modal */}
      <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto border-zinc-800 bg-zinc-950">
          {selectedProject && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {selectedProject.icon_url && (
                    <img
                      src={selectedProject.icon_url}
                      alt={selectedProject.title}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <DialogTitle className="text-zinc-100">{selectedProject.title}</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                      {selectedProject.author && `by ${selectedProject.author} · `}
                      {formatNumber(selectedProject.downloads)} downloads
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <p className="text-sm text-zinc-300">{selectedProject.description}</p>

                {/* Stats */}
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-zinc-500">Downloads</span>
                    <p className="font-medium text-zinc-100">
                      {formatNumber(selectedProject.downloads)}
                    </p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Followers</span>
                    <p className="font-medium text-zinc-100">
                      {formatNumber(selectedProject.follows)}
                    </p>
                  </div>
                  <div>
                    <span className="text-zinc-500">License</span>
                    <p className="font-medium text-zinc-100">
                      {selectedProject.license || "Unknown"}
                    </p>
                  </div>
                </div>

                {/* Categories */}
                {selectedProject.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedProject.categories.map((cat) => (
                      <Badge
                        key={cat}
                        variant="outline"
                        className="border-zinc-700 bg-zinc-800/50 text-xs text-zinc-400"
                      >
                        {cat}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Install latest */}
                <TextureButton
                  variant="primary"
                  className="w-full"
                  onClick={() => setInstallTarget({ project: selectedProject })}
                  disabled={installMutation.isPending}
                >
                  <BsDownload className="mr-2 h-4 w-4" />
                  Install Latest Version
                </TextureButton>

                {/* Versions */}
                {isLoadingVersions ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner className="h-5 w-5" />
                    <span className="ml-2 text-sm text-zinc-400">Loading versions...</span>
                  </div>
                ) : (projectVersions ?? []).length > 0 ? (
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-zinc-300">Versions</h4>
                    <div className="max-h-60 space-y-2 overflow-y-auto">
                      {(projectVersions ?? []).slice(0, 15).map((version) => (
                        <div
                          key={version.id}
                          className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                        >
                          <div>
                            <p className="text-sm font-medium text-zinc-200">{version.name}</p>
                            <p className="text-xs text-zinc-500">
                              {version.game_versions.slice(0, 3).join(", ")}
                              {version.loaders.length > 0 && ` · ${version.loaders.join(", ")}`}
                            </p>
                          </div>
                          <TextureButton
                            variant="secondary"
                            size="sm"
                            onClick={() => setInstallTarget({ project: selectedProject, version })}
                            disabled={installMutation.isPending}
                          >
                            <BsDownload className="mr-1 h-3 w-3" />
                            Install
                          </TextureButton>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Install Confirmation Modal */}
      <ConfirmationModal
        open={!!installTarget}
        onOpenChange={(open) => {
          if (!open) setInstallTarget(null);
        }}
        onConfirm={handleInstall}
        title="Install Modpack"
        description={`Install "${installTarget?.project.title}"${installTarget?.version ? ` (${installTarget.version.name})` : ""}? This will modify your server files.`}
        confirmLabel="Install"
        isLoading={installMutation.isPending}
      />
    </div>
  );
};
