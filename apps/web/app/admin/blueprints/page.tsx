"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@stellarUI/lib/utils";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import FormModal from "@stellarUI/components/FormModal/FormModal";
import ConfirmationModal from "@stellarUI/components/ConfirmationModal/ConfirmationModal";
import { SidebarTrigger } from "@stellarUI/components/Sidebar/Sidebar";
import Input from "@stellarUI/components/Input/Input";
import Label from "@stellarUI/components/Label/Label";
import Textarea from "@stellarUI/components/Textarea";
import {
  BsBox,
  BsPlus,
  BsDownload,
  BsUpload,
  BsPencil,
  BsTrash,
  BsEye,
  BsEyeSlash,
  BsPerson,
  BsDiagram3,
} from "react-icons/bs";
import { useBlueprintMutations, useBlueprints } from "@/hooks/queries";
import type { Blueprint, CreateBlueprintData, PterodactylEgg } from "@/lib/api";
import { toast } from "sonner";

export default function BlueprintsPage() {
  const { data: blueprintsList = [], isLoading } = useBlueprints();
  const { create, update, remove, importEgg, exportEgg } = useBlueprintMutations();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingBlueprint, setEditingBlueprint] = useState<Blueprint | null>(null);
  const [deleteConfirmBlueprint, setDeleteConfirmBlueprint] = useState<Blueprint | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [importJson, setImportJson] = useState("");

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
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-black px-4 pb-4">
          {/* Header */}
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-between">
              <SidebarTrigger className="text-zinc-400 transition-all hover:scale-110 hover:text-zinc-100 active:scale-95" />
              <div className="flex items-center gap-2">
                <Link href="/admin/blueprints/builder">
                  <TextureButton variant="minimal" size="sm" className="w-fit">
                    <BsDiagram3 className="h-4 w-4" />
                    Builder
                  </TextureButton>
                </Link>
                <TextureButton
                  variant="minimal"
                  size="sm"
                  className="w-fit"
                  onClick={() => setIsImportModalOpen(true)}
                >
                  <BsUpload className="h-4 w-4" />
                  Import
                </TextureButton>
                <TextureButton
                  variant="primary"
                  size="sm"
                  className="w-fit"
                  onClick={() => {
                    resetForm();
                    setIsModalOpen(true);
                  }}
                >
                  <BsPlus className="h-4 w-4" />
                  Add Blueprint
                </TextureButton>
              </div>
            </div>
          </FadeIn>

          {/* Search */}
          <FadeIn delay={0.05}>
            <div className="mb-4">
              <Input
                type="text"
                placeholder="Search blueprints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9"
              />
            </div>
          </FadeIn>

          {/* Blueprints List */}
          <FadeIn delay={0.1}>
            <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
              <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
                <div className="flex items-center gap-2 text-xs opacity-50">
                  <BsBox className="h-3 w-3" />
                  Blueprints
                </div>
                <span className="text-xs text-zinc-500">
                  {filteredBlueprints.length} blueprint{filteredBlueprints.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner />
                  </div>
                ) : filteredBlueprints.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <BsBox className="mb-4 h-12 w-12 text-zinc-600" />
                    <h3 className="mb-2 text-sm font-medium text-zinc-300">No Blueprints</h3>
                    <p className="mb-4 text-xs text-zinc-500">
                      {searchQuery
                        ? "No blueprints match your search."
                        : "Add your first blueprint to get started."}
                    </p>
                    {!searchQuery && (
                      <TextureButton
                        variant="minimal"
                        size="sm"
                        className="w-fit"
                        onClick={() => {
                          resetForm();
                          setIsModalOpen(true);
                        }}
                      >
                        <BsPlus className="h-4 w-4" />
                        Add Blueprint
                      </TextureButton>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredBlueprints.map((blueprint) => (
                      <div
                        key={blueprint.id}
                        className="flex flex-col rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-4 transition-colors hover:border-zinc-600"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-700/50 bg-amber-900/30">
                              <BsBox className="h-5 w-5 text-amber-400" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-zinc-100">
                                  {blueprint.name}
                                </span>
                                {blueprint.isPublic ? (
                                  <BsEye className="h-3 w-3 text-zinc-500" />
                                ) : (
                                  <BsEyeSlash className="h-3 w-3 text-zinc-600" />
                                )}
                              </div>
                              <div className="mt-1 font-mono text-xs text-zinc-500">
                                {Object.values(blueprint.dockerImages || {})[0] ||
                                  "No docker images"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1">
                          {blueprint.category && (
                            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 uppercase">
                              {blueprint.category}
                            </span>
                          )}
                          {blueprint.dockerImages &&
                            Object.keys(blueprint.dockerImages).length > 1 && (
                              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                                {Object.keys(blueprint.dockerImages).length} images
                              </span>
                            )}
                          {blueprint.variables && blueprint.variables.length > 0 && (
                            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                              {blueprint.variables.length} vars
                            </span>
                          )}
                        </div>

                        {blueprint.author && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-zinc-500">
                            <BsPerson className="h-3 w-3" />
                            {blueprint.author}
                          </div>
                        )}

                        {blueprint.description && (
                          <p className="mt-2 line-clamp-2 text-xs text-zinc-600">
                            {blueprint.description}
                          </p>
                        )}

                        <div className="mt-3 flex items-center justify-end gap-1 border-t border-zinc-800/50 pt-3">
                          <TextureButton
                            variant="minimal"
                            size="sm"
                            className="w-fit"
                            onClick={() => handleExportCore(blueprint)}
                            disabled={exportEgg.isPending}
                          >
                            <BsDownload className="h-3.5 w-3.5" />
                          </TextureButton>
                          <Link href={`/admin/blueprints/builder?id=${blueprint.id}`}>
                            <TextureButton variant="minimal" size="sm" className="w-fit">
                              <BsDiagram3 className="h-3.5 w-3.5" />
                            </TextureButton>
                          </Link>
                          <TextureButton
                            variant="minimal"
                            size="sm"
                            className="w-fit"
                            onClick={() => handleEdit(blueprint)}
                          >
                            <BsPencil className="h-3.5 w-3.5" />
                          </TextureButton>
                          <TextureButton
                            variant="secondary"
                            size="sm"
                            className="w-fit text-red-400 hover:text-red-300"
                            onClick={() => setDeleteConfirmBlueprint(blueprint)}
                          >
                            <BsTrash className="h-3.5 w-3.5" />
                          </TextureButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
            <Label>Docker Image</Label>
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
            />
          </div>

          <div className="flex items-center gap-2">
            <input
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
                size="sm"
                type="button"
                onClick={() => setShowJsonEditor(!showJsonEditor)}
              >
                {showJsonEditor ? "Hide" : "Show"} Editor
              </TextureButton>
            </div>
            {showJsonEditor ? (
              <Textarea
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                placeholder='{"environment": {"EULA": "TRUE"}}'
                rows={10}
                className="font-mono text-xs"
              />
            ) : (
              <div className="max-h-32 overflow-auto rounded-lg border border-zinc-700 bg-zinc-900 p-3 font-mono text-xs text-zinc-400">
                <pre>{configJson}</pre>
              </div>
            )}
          </div>
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
            <Input type="file" accept=".json" onChange={handleFileImport} />
          </div>
          <div>
            <Label>Or Paste JSON</Label>
            <Textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='{"name": "Paper", "docker_images": {...}}'
              rows={15}
              className="font-mono text-xs"
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
    </FadeIn>
  );
}
