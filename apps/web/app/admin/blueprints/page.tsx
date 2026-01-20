"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@workspace/ui/lib/utils";
import { TextureButton } from "@workspace/ui/components/texture-button";
import { Spinner } from "@workspace/ui/components/spinner";
import { FadeIn } from "@workspace/ui/components/fade-in";
import { FormModal } from "@workspace/ui/components/form-modal";
import { ConfirmationModal } from "@workspace/ui/components/confirmation-modal";
import {
  DownloadIcon,
  EditIcon,
  EyeIcon,
  EyeOffIcon,
  ImageIcon,
  PackageIcon,
  PlusIcon,
  TerminalIcon,
  TrashIcon,
  UploadIcon,
  UserIcon,
  VariableIcon,
  GitBranch,
} from "lucide-react";
import { AdminEmptyState, AdminPageHeader, AdminSearchBar } from "components/AdminPageComponents";
import { useBlueprintMutations, useBlueprints } from "@/hooks/queries";
import type { Blueprint, CreateBlueprintData, PterodactylEgg } from "@/lib/api";
import { toast } from "sonner";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { Input } from "@workspace/ui/components";

export default function BlueprintsPage() {
  // React Query hooks
  const { data: blueprintsList = [], isLoading } = useBlueprints();
  const { create, update, remove, importEgg, exportEgg } = useBlueprintMutations();

  // UI state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingBlueprint, setEditingBlueprint] = useState<Blueprint | null>(null);
  const [deleteConfirmBlueprint, setDeleteConfirmBlueprint] = useState<Blueprint | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [importJson, setImportJson] = useState("");

  // Form state
  const [formData, setFormData] = useState<CreateBlueprintData>({
    name: "",
    description: "",
    category: "",
    author: "",
    dockerImages: {},
    startup: "",
    config: {},
    scripts: {},
    variables: [],
    features: [],
    fileDenylist: [],
    dockerConfig: {},
    isPublic: true,
  });
  const [configJson, setConfigJson] = useState("{}");

  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      description: "",
      category: "",
      author: "",
      dockerImages: {},
      startup: "",
      config: {},
      scripts: {},
      variables: [],
      features: [],
      fileDenylist: [],
      dockerConfig: {},
      isPublic: true,
    });
    setConfigJson("{}");
    setEditingBlueprint(null);
    setShowJsonEditor(false);
  }, []);

  const handleSubmit = async () => {
    try {
      let config = {};
      try {
        config = JSON.parse(configJson);
      } catch {
        toast.error("Invalid JSON in config");
        return;
      }

      const data = { ...formData, config };

      if (editingBlueprint) {
        await update.mutateAsync({ id: editingBlueprint.id, data });
        toast.success("Blueprint updated successfully");
      } else {
        await create.mutateAsync(data);
        toast.success("Blueprint created successfully");
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      toast.error(editingBlueprint ? "Failed to update blueprint" : "Failed to create blueprint");
    }
  };

  const handleEdit = (blueprint: Blueprint) => {
    setEditingBlueprint(blueprint);
    setFormData({
      name: blueprint.name,
      description: blueprint.description || "",
      category: blueprint.category || "",
      author: blueprint.author || "",
      dockerImages: blueprint.dockerImages || {},
      startup: blueprint.startup || "",
      config: blueprint.config || {},
      scripts: blueprint.scripts || {},
      variables: blueprint.variables || [],
      features: blueprint.features || [],
      fileDenylist: blueprint.fileDenylist || [],
      dockerConfig: blueprint.dockerConfig || {},
      isPublic: blueprint.isPublic,
    });
    setConfigJson(JSON.stringify(blueprint.config, null, 2));
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirmBlueprint) return;
    try {
      await remove.mutateAsync(deleteConfirmBlueprint.id);
      toast.success("Blueprint deleted successfully");
      setDeleteConfirmBlueprint(null);
    } catch (error) {
      toast.error("Failed to delete blueprint");
    }
  };

  const handleImportCore = async () => {
    try {
      const core = JSON.parse(importJson) as PterodactylEgg;
      const result = await importEgg.mutateAsync(core);
      toast.success(result.message);
      setIsImportModalOpen(false);
      setImportJson("");
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error("Invalid JSON format");
      } else {
        toast.error("Failed to import core");
      }
    }
  };

  const handleExportCore = async (blueprint: Blueprint) => {
    try {
      const core = await exportEgg.mutateAsync(blueprint.id);
      const blob = new Blob([JSON.stringify(core, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${blueprint.name.toLowerCase().replace(/\s+/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Core exported successfully");
    } catch {
      toast.error("Failed to export core");
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImportJson(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const filteredBlueprints = useMemo(() => {
    if (!searchQuery) return blueprintsList;
    const query = searchQuery.toLowerCase();
    return blueprintsList.filter((blueprint) => {
      const dockerImageMatch = Object.values(blueprint.dockerImages || {}).some((img) =>
        img.toLowerCase().includes(query)
      );
      return (
        blueprint.name.toLowerCase().includes(query) ||
        dockerImageMatch ||
        blueprint.category?.toLowerCase().includes(query) ||
        blueprint.description?.toLowerCase().includes(query) ||
        blueprint.author?.toLowerCase().includes(query)
      );
    });
  }, [blueprintsList, searchQuery]);

  return (
    <div className={cn("relative min-h-svh bg-[#0b0b0a] transition-colors")}>
      <div className="relative p-8">
        <div className="w-full">
          <FadeIn delay={0}>
            <AdminPageHeader
              title="BLUEPRINTS"
              description="Docker container templates"
              action={{
                label: "Add Blueprint",
                icon: <PlusIcon className="h-4 w-4" />,
                onClick: () => {
                  resetForm();
                  setIsModalOpen(true);
                },
              }}
            />

            <div className="mb-6 flex gap-2">
              <Link href="/admin/blueprints/builder">
                <TextureButton variant="minimal">
                  <GitBranch className="h-4 w-4" />
                  Open Builder
                </TextureButton>
              </Link>
              <TextureButton onClick={() => setIsImportModalOpen(true)} variant="minimal">
                <UploadIcon className="h-4 w-4" />
                Import Core
              </TextureButton>
            </div>

            <AdminSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search blueprints..."
            />
          </FadeIn>

          {/* Blueprints Grid */}
          <FadeIn delay={0.1}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {isLoading ? (
                <div className="col-span-full flex justify-center py-12">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : filteredBlueprints.length === 0 ? (
                <AdminEmptyState
                  message={
                    searchQuery
                      ? "No blueprints match your search."
                      : "No blueprints configured. Add your first blueprint."
                  }
                />
              ) : (
                filteredBlueprints.map((blueprint) => (
                  <div
                    key={blueprint.id}
                    className={cn(
                      "relative rounded-lg border border-zinc-700 bg-zinc-900/50 p-4 transition-colors hover:border-zinc-600"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <PackageIcon className={cn("mt-0.5 h-6 w-6 text-zinc-400")} />
                        <div>
                          <div className={cn("flex items-center gap-2 font-medium text-zinc-100")}>
                            {blueprint.name}
                            {blueprint.isPublic ? (
                              <EyeIcon className={cn("h-3 w-3 text-zinc-500")} />
                            ) : (
                              <EyeOffIcon className={cn("h-3 w-3 text-zinc-600")} />
                            )}
                          </div>
                          <div className={cn("mt-1 font-mono text-xs text-zinc-500")}>
                            {Object.values(blueprint.dockerImages || {})[0] || "No docker images"}
                          </div>
                          {blueprint.category && (
                            <div
                              className={cn(
                                "mt-2 inline-block border border-zinc-700 px-1.5 py-0.5 text-[10px] tracking-wider text-zinc-400 uppercase"
                              )}
                            >
                              {blueprint.category}
                            </div>
                          )}
                          {blueprint.author && (
                            <div
                              className={cn("mt-1 flex items-center gap-1 text-xs text-zinc-500")}
                            >
                              <UserIcon className="h-3 w-3" />
                              {blueprint.author}
                            </div>
                          )}
                          {blueprint.description && (
                            <div className={cn("mt-2 line-clamp-2 text-xs text-zinc-600")}>
                              {blueprint.description}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {blueprint.dockerImages &&
                              Object.keys(blueprint.dockerImages).length > 1 && (
                                <span
                                  className={cn(
                                    "border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500"
                                  )}
                                >
                                  {Object.keys(blueprint.dockerImages).length} images
                                </span>
                              )}
                            {blueprint.variables && blueprint.variables.length > 0 && (
                              <span
                                className={cn(
                                  "border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500"
                                )}
                              >
                                {blueprint.variables.length} variables
                              </span>
                            )}
                            {blueprint.startup && (
                              <span
                                className={cn(
                                  "border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500"
                                )}
                              >
                                startup
                              </span>
                            )}
                            {(blueprint.scripts as any)?.installation?.script && (
                              <span
                                className={cn(
                                  "border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500"
                                )}
                              >
                                install script
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <TextureButton
                          variant="minimal"
                          size="sm"
                          onClick={() => handleExportCore(blueprint)}
                          disabled={exportEgg.isPending}
                          title="Export as Core"
                        >
                          <DownloadIcon className="h-3 w-3" />
                        </TextureButton>
                        <Link href={`/admin/blueprints/builder?id=${blueprint.id}`}>
                          <TextureButton variant="minimal" size="sm" title="Edit in Builder">
                            <GitBranch className="h-3 w-3" />
                          </TextureButton>
                        </Link>
                        <TextureButton
                          variant="minimal"
                          size="sm"
                          onClick={() => handleEdit(blueprint)}
                          title="Edit Form"
                        >
                          <EditIcon className="h-3 w-3" />
                        </TextureButton>
                        <TextureButton
                          variant="minimal"
                          size="sm"
                          onClick={() => setDeleteConfirmBlueprint(blueprint)}
                        >
                          <TrashIcon className="h-3 w-3" />
                        </TextureButton>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <FormModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) resetForm();
        }}
        title={editingBlueprint ? "Edit Blueprint" : "Create Blueprint"}
        submitLabel={editingBlueprint ? "Update" : "Create"}
        onSubmit={handleSubmit}
        isLoading={create.isPending || update.isPending}
        isValid={formData.name.length > 0 && Object.keys(formData.dockerImages || {}).length > 0}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name</Label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Minecraft Vanilla"
                required
              />
            </div>
            <div>
              <Label>Category</Label>
              <Input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="gaming"
              />
            </div>
          </div>

          <div>
            <Label>Docker Image (e.g., itzg/minecraft-server:latest)</Label>
            <Input
              type="text"
              value={Object.values(formData.dockerImages || {})[0] || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  dockerImages: e.target.value ? { Default: e.target.value } : {},
                })
              }
              placeholder="ghcr.io/ptero-eggs/yolks:java_21"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Author</Label>
              <Input
                type="text"
                value={formData.author || ""}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                placeholder="Author name"
              />
            </div>
            <div>
              <Label>Startup Command</Label>
              <Input
                type="text"
                value={formData.startup || ""}
                onChange={(e) => setFormData({ ...formData, startup: e.target.value })}
                placeholder="java -jar server.jar"
              />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description..."
              rows={2}
              className={cn("resize-none")}
            />
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="checkbox"
              id="isPublic"
              checked={formData.isPublic}
              onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
              className="h-4 w-4"
            />
            <Label htmlFor="isPublic">Public (visible to all users)</Label>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label>Docker Config (JSON)</Label>
              <TextureButton
                variant="minimal"
                type="button"
                onClick={() => setShowJsonEditor(!showJsonEditor)}
              >
                {showJsonEditor ? "Hide" : "Show"} Editor
              </TextureButton>
            </div>
            {showJsonEditor && (
              <Textarea
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                placeholder='{"environment": {"EULA": "TRUE"}, "ports": [...]}'
                rows={10}
                className={cn("resize-none font-mono text-xs")}
              />
            )}
            {!showJsonEditor && (
              <div
                className={cn(
                  "max-h-32 overflow-auto border border-zinc-700 bg-zinc-900 p-3 font-mono text-xs text-zinc-400"
                )}
              >
                <pre>{configJson}</pre>
              </div>
            )}
          </div>

          {/* Docker Images (from Pterodactyl egg) */}
          {editingBlueprint?.dockerImages &&
            Object.keys(editingBlueprint.dockerImages).length > 0 && (
              <div>
                <Label>
                  <ImageIcon className="h-3 w-3" />
                  Docker Images
                </Label>
                <div className={cn("space-y-2 border border-zinc-700 bg-zinc-900/50 p-3")}>
                  {Object.entries(editingBlueprint.dockerImages).map(([label, image]) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <span className={cn("text-xs font-medium text-zinc-300")}>{label}</span>
                      <span className={cn("font-mono text-xs text-zinc-500")}>{image}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Startup Command (from Pterodactyl egg) */}
          {editingBlueprint?.startup && (
            <div>
              <Label>
                <TerminalIcon className="h-3 w-3" />
                Startup Command
              </Label>
              <div
                className={cn(
                  "overflow-x-auto border border-zinc-700 bg-zinc-900/50 p-3 font-mono text-xs text-zinc-400"
                )}
              >
                {editingBlueprint.startup}
              </div>
            </div>
          )}

          {/* Variables (from Pterodactyl egg) */}
          {editingBlueprint?.variables && editingBlueprint.variables.length > 0 && (
            <div>
              <Label>
                <VariableIcon className="h-3 w-3" />
                Variables ({editingBlueprint.variables.length})
              </Label>
              <div
                className={cn(
                  "max-h-64 divide-y divide-zinc-700/50 overflow-y-auto border border-zinc-700 bg-zinc-900/50"
                )}
              >
                {editingBlueprint.variables.map((variable) => (
                  <div key={variable.env_variable} className="p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className={cn("text-xs font-medium text-zinc-200")}>
                        {variable.name}
                      </span>
                      <span
                        className={cn(
                          "rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500"
                        )}
                      >
                        {variable.env_variable}
                      </span>
                    </div>
                    {variable.description && (
                      <p className={cn("mb-2 text-[11px] text-zinc-500")}>{variable.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-[10px]">
                      <span className={"text-zinc-600"}>
                        Default:{" "}
                        <span className="font-mono">{variable.default_value || "(empty)"}</span>
                      </span>
                      {variable.rules && (
                        <span className={"text-zinc-600"}>Rules: {variable.rules}</span>
                      )}
                      <div className="flex gap-2">
                        {variable.user_viewable && (
                          <span className={cn("rounded bg-zinc-800 px-1 py-0.5 text-zinc-500")}>
                            viewable
                          </span>
                        )}
                        {variable.user_editable && (
                          <span className={cn("rounded bg-zinc-800 px-1 py-0.5 text-zinc-500")}>
                            editable
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className={cn("mt-1 text-[10px] text-zinc-600")}>
                Variables are imported from Pterodactyl eggs and can be overridden per-server.
              </p>
            </div>
          )}
        </div>
      </FormModal>

      {/* Import Core Modal */}
      <FormModal
        open={isImportModalOpen}
        onOpenChange={(open) => {
          setIsImportModalOpen(open);
          if (!open) setImportJson("");
        }}
        title="Import Core"
        description="Paste the contents of a core JSON file or upload a file."
        submitLabel="Import"
        onSubmit={handleImportCore}
        isLoading={importEgg.isPending}
        isValid={importJson.length > 0}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <Label>Upload File</Label>
            <Input
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className={cn(
                "w-full text-sm text-zinc-400 file:mr-4 file:border-0 file:bg-zinc-800 file:px-4 file:py-2 file:text-sm file:font-medium file:text-zinc-300"
              )}
            />
          </div>

          <div>
            <Label>Or Paste JSON</Label>
            <Textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='{"name": "Paper", "docker_images": {...}, ...}'
              rows={15}
              className={cn("resize-none font-mono text-xs")}
              required
            />
          </div>
        </div>
      </FormModal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        open={!!deleteConfirmBlueprint}
        onOpenChange={(open) => !open && setDeleteConfirmBlueprint(null)}
        title="Delete Blueprint"
        description={`Are you sure you want to delete "${deleteConfirmBlueprint?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isLoading={remove.isPending}
      />
    </div>
  );
}
