"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@workspace/ui/lib/utils";
import { TextureButton } from "@workspace/ui/components/texture-button";
import { Spinner } from "@workspace/ui/components/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { Switch } from "@workspace/ui/components/switch";
import { FadeIn } from "@workspace/ui/components/fade-in";
import {
  ArrowLeftIcon,
  BoxIcon,
  CpuIcon,
  ImageIcon,
  InfoIcon,
  NetworkIcon,
  ServerIcon,
  VariableIcon,
} from "lucide-react";
import { useBlueprints, useNode, useNodes, useServerMutations, useUsers } from "@/hooks/queries";
import type { CreateServerData } from "@/lib/api";
import { toast } from "sonner";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";

export default function NewServerPage() {
  const router = useRouter();

  // React Query hooks
  const { data: nodesList = [], isLoading: isLoadingNodes } = useNodes();
  const { data: blueprintsList = [], isLoading: isLoadingBlueprints } = useBlueprints();
  const { data: usersList = [], isLoading: isLoadingUsers } = useUsers();
  const { create } = useServerMutations();

  // UI state
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const { data: selectedNode } = useNode(selectedNodeId || undefined);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [selectedDockerImage, setSelectedDockerImage] = useState<string>("");
  const [activeTab, setActiveTab] = useState("basic");

  // Form state
  const [formData, setFormData] = useState<
    CreateServerData & {
      cpuPinning: string;
      swap: number;
      oomKillDisable: boolean;
      backupLimit: number;
    }
  >({
    name: "",
    description: "",
    nodeId: "",
    blueprintId: "",
    ownerId: "",
    memory: 1024,
    disk: 10240,
    cpu: 100,
    cpuPinning: "",
    swap: -1, // unlimited
    oomKillDisable: false,
    backupLimit: 3,
    allocationIds: [],
  });

  // Update selected blueprint and initialize variables when blueprintId changes
  const selectedBlueprint = blueprintsList.find((b) => b.id === formData.blueprintId);

  useEffect(() => {
    if (selectedBlueprint) {
      // Initialize variable values with defaults
      const defaults: Record<string, string> = {};
      if (selectedBlueprint.variables && Array.isArray(selectedBlueprint.variables)) {
        for (const v of selectedBlueprint.variables) {
          defaults[v.env_variable] = v.default_value || "";
        }
      }
      setVariableValues(defaults);

      // Set default docker image
      if (
        selectedBlueprint.dockerImages &&
        Object.keys(selectedBlueprint.dockerImages).length > 0
      ) {
        const firstImage = Object.values(selectedBlueprint.dockerImages)[0] ?? "";
        setSelectedDockerImage(firstImage);
      } else {
        // Fallback to default image if none available
        setSelectedDockerImage("alpine:latest");
      }
    } else {
      setVariableValues({});
      setSelectedDockerImage("");
    }
  }, [selectedBlueprint]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.allocationIds.length === 0) {
      toast.error("Please select at least one allocation");
      setActiveTab("allocations");
      return;
    }

    if (!formData.blueprintId) {
      toast.error("Please select a blueprint");
      setActiveTab("blueprint");
      return;
    }

    try {
      const data: CreateServerData = {
        name: formData.name,
        description: formData.description || undefined,
        nodeId: formData.nodeId,
        blueprintId: formData.blueprintId,
        ownerId: formData.ownerId || undefined,
        memory: formData.memory,
        disk: formData.disk,
        cpu: formData.cpu,
        cpuPinning: formData.cpuPinning || undefined,
        swap: formData.swap,
        oomKillDisable: formData.oomKillDisable,
        backupLimit: formData.backupLimit,
        allocationIds: formData.allocationIds,
        variables: Object.keys(variableValues).length > 0 ? variableValues : undefined,
        dockerImage: selectedDockerImage || undefined,
      };

      await create.mutateAsync(data);
      toast.success("Server created successfully");
      router.push("/admin/servers");
    } catch (error: any) {
      toast.error(error.message || "Failed to create server");
    }
  };

  const toggleAllocation = (allocationId: string) => {
    setFormData((prev) => {
      const ids = prev.allocationIds.includes(allocationId)
        ? prev.allocationIds.filter((id) => id !== allocationId)
        : [...prev.allocationIds, allocationId];
      return { ...prev, allocationIds: ids };
    });
  };

  const isLoading = isLoadingNodes || isLoadingBlueprints || isLoadingUsers;

  if (isLoading) {
    return (
      <div className={cn("relative flex min-h-svh items-center justify-center bg-[#0b0b0a]")}>
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className={cn("relative min-h-svh bg-[#0b0b0a] transition-colors")}>
      <div className="relative p-8">
        <div className="mx-auto">
          <FadeIn delay={0}>
            {/* Header */}
            <div className="mb-8 flex items-center gap-4">
              <TextureButton
                variant="ghost"
                size="sm"
                onClick={() => router.push("/admin/servers")}
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </TextureButton>
              <div>
                <h1 className={cn("text-2xl font-light tracking-wider text-zinc-100")}>
                  CREATE SERVER
                </h1>
                <p className={cn("mt-1 text-sm text-zinc-500")}>
                  Configure a new game server instance
                </p>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <form onSubmit={handleSubmit}>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList
                  className={cn(
                    "h-auto w-full justify-start gap-0 rounded-none border-b border-zinc-700/50 bg-transparent p-0"
                  )}
                >
                  <TabsTrigger
                    value="basic"
                    className={cn(
                      "-mb-px flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-2.5 text-xs tracking-wider text-zinc-500 uppercase hover:text-zinc-300 data-[state=active]:border-zinc-100 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none"
                    )}
                  >
                    <InfoIcon className="h-3.5 w-3.5" />
                    Basic Info
                  </TabsTrigger>
                  <TabsTrigger
                    value="resources"
                    className={cn(
                      "-mb-px flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-2.5 text-xs tracking-wider text-zinc-500 uppercase hover:text-zinc-300 data-[state=active]:border-zinc-100 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none"
                    )}
                  >
                    <CpuIcon className="h-3.5 w-3.5" />
                    Resources
                  </TabsTrigger>
                  <TabsTrigger
                    value="allocations"
                    className={cn(
                      "-mb-px flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-2.5 text-xs tracking-wider text-zinc-500 uppercase hover:text-zinc-300 data-[state=active]:border-zinc-100 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none"
                    )}
                  >
                    <NetworkIcon className="h-3.5 w-3.5" />
                    Allocations
                    {formData.allocationIds.length > 0 && (
                      <span
                        className={cn(
                          "ml-1 rounded bg-green-900/50 px-1.5 py-0.5 text-[10px] text-green-400"
                        )}
                      >
                        {formData.allocationIds.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="blueprint"
                    className={cn(
                      "-mb-px flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-2.5 text-xs tracking-wider text-zinc-500 uppercase hover:text-zinc-300 data-[state=active]:border-zinc-100 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none"
                    )}
                  >
                    <BoxIcon className="h-3.5 w-3.5" />
                    Blueprint
                  </TabsTrigger>
                </TabsList>

                {/* Basic Info Tab */}
                <TabsContent value="basic" className="mt-6 space-y-4">
                  <div>
                    <h3 className={cn("mb-4 text-sm font-medium text-zinc-200")}>Server Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Name *</Label>
                        <Input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="My Minecraft Server"
                          required
                        />
                      </div>
                      <div>
                        <Label>Owner *</Label>
                        <Select
                          value={formData.ownerId}
                          onValueChange={(value) => setFormData({ ...formData, ownerId: value })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select owner..." />
                          </SelectTrigger>
                          <SelectContent>
                            {usersList.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name} ({user.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Label>Description</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Optional description..."
                        rows={3}
                        className={cn("resize-none")}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className={cn("mb-4 text-sm font-medium text-zinc-200")}>
                      Backup Settings
                    </h3>
                    <div className="w-48">
                      <Label>Backup Limit</Label>
                      <Input
                        type="number"
                        value={formData.backupLimit}
                        onChange={(e) =>
                          setFormData({ ...formData, backupLimit: parseInt(e.target.value) || 0 })
                        }
                        min={0}
                        max={100}
                      />
                      <p className={cn("mt-1 text-xs text-zinc-600")}>
                        Maximum number of backups to keep
                      </p>
                    </div>
                  </div>
                </TabsContent>

                {/* Resources Tab */}
                <TabsContent value="resources" className="mt-6 space-y-4">
                  <div>
                    <h3 className={cn("mb-4 text-sm font-medium text-zinc-200")}>
                      Resource Limits
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Memory (MiB) *</Label>
                        <Input
                          type="number"
                          value={formData.memory}
                          onChange={(e) =>
                            setFormData({ ...formData, memory: parseInt(e.target.value) || 0 })
                          }
                          min={128}
                          required
                        />
                        <p className={cn("mt-1 text-xs text-zinc-600")}>
                          {(formData.memory / 1024).toFixed(2)} GiB
                        </p>
                      </div>
                      <div>
                        <Label>Disk (MiB) *</Label>
                        <Input
                          type="number"
                          value={formData.disk}
                          onChange={(e) =>
                            setFormData({ ...formData, disk: parseInt(e.target.value) || 0 })
                          }
                          min={1024}
                          required
                        />
                        <p className={cn("mt-1 text-xs text-zinc-600")}>
                          {(formData.disk / 1024).toFixed(2)} GiB
                        </p>
                      </div>
                      <div>
                        <Label>CPU (%) *</Label>
                        <Input
                          type="number"
                          value={formData.cpu}
                          onChange={(e) =>
                            setFormData({ ...formData, cpu: parseInt(e.target.value) || 0 })
                          }
                          min={1}
                          max={10000}
                          required
                        />
                        <p className={cn("mt-1 text-xs text-zinc-600")}>
                          {formData.cpu}% = {(formData.cpu / 100).toFixed(2)} thread(s)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className={cn("mb-4 text-sm font-medium text-zinc-200")}>CPU Pinning</h3>
                    <div>
                      <Label>Pin to CPUs</Label>
                      <Input
                        type="text"
                        value={formData.cpuPinning}
                        onChange={(e) => setFormData({ ...formData, cpuPinning: e.target.value })}
                        placeholder="e.g., 0,1,2,3 or 0-4"
                      />
                      <p className={cn("mt-1 text-xs text-zinc-600")}>
                        Leave empty to use any available CPU. Use comma-separated list (0,1,2) or
                        range (0-4).
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className={cn("mb-4 text-sm font-medium text-zinc-200")}>
                      Memory Settings
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Swap Memory</Label>
                        <Select
                          value={
                            formData.swap === -1
                              ? "unlimited"
                              : formData.swap === 0
                                ? "disabled"
                                : "limited"
                          }
                          onValueChange={(val) => {
                            if (val === "unlimited") setFormData({ ...formData, swap: -1 });
                            else if (val === "disabled") setFormData({ ...formData, swap: 0 });
                            else setFormData({ ...formData, swap: formData.memory });
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unlimited">Unlimited</SelectItem>
                            <SelectItem value="disabled">Disabled</SelectItem>
                            <SelectItem value="limited">Limited</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {formData.swap > 0 && (
                        <div>
                          <Label>Swap Limit (MiB)</Label>
                          <Input
                            type="number"
                            value={formData.swap}
                            onChange={(e) =>
                              setFormData({ ...formData, swap: parseInt(e.target.value) || 0 })
                            }
                            min={1}
                          />
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <Label>OOM Killer</Label>
                        <p className={cn("text-xs text-zinc-600")}>
                          When disabled, container won't be killed when out of memory
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs text-zinc-500")}>
                          {formData.oomKillDisable ? "Disabled" : "Enabled"}
                        </span>
                        <Switch
                          checked={formData.oomKillDisable}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, oomKillDisable: checked })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Allocations Tab */}
                <TabsContent value="allocations" className="mt-6 space-y-4">
                  <div>
                    <h3 className={cn("mb-4 text-sm font-medium text-zinc-200")}>Select Node</h3>
                    <Select
                      value={formData.nodeId}
                      onValueChange={(value) => {
                        setFormData({ ...formData, nodeId: value, allocationIds: [] });
                        setSelectedNodeId(value);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select node..." />
                      </SelectTrigger>
                      <SelectContent>
                        {nodesList.map((node) => (
                          <SelectItem key={node.id} value={node.id}>
                            {node.displayName} ({node.host}:{node.port}) -{" "}
                            {node.location?.name || "Unknown"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedNode && (
                    <div>
                      <h3 className={cn("mb-4 text-sm font-medium text-zinc-200")}>
                        Available Allocations
                      </h3>
                      {!selectedNode.allocations || selectedNode.allocations.length === 0 ? (
                        <div className={cn("py-8 text-center text-sm text-zinc-500")}>
                          No allocations available on this node. Add allocations in the Nodes
                          section.
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {selectedNode.allocations
                            .filter((a) => !a.assigned || formData.allocationIds.includes(a.id))
                            .map((allocation) => (
                              <Label
                                key={allocation.id}
                                className={cn(
                                  "flex cursor-pointer items-center gap-2 border p-3 transition-colors",
                                  formData.allocationIds.includes(allocation.id)
                                    ? "border-zinc-400 bg-zinc-800/50"
                                    : "border-zinc-700 hover:border-zinc-600"
                                )}
                              >
                                <Input
                                  type="checkbox"
                                  checked={formData.allocationIds.includes(allocation.id)}
                                  onChange={() => toggleAllocation(allocation.id)}
                                  className="h-4 w-4"
                                />
                                <div>
                                  <span className={cn("font-mono text-sm text-zinc-300")}>
                                    {allocation.ip}:{allocation.port}
                                  </span>
                                  {allocation.alias && (
                                    <span className={cn("block text-xs text-zinc-500")}>
                                      {allocation.alias}
                                    </span>
                                  )}
                                </div>
                              </Label>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* Blueprint Tab */}
                <TabsContent value="blueprint" className="mt-6 space-y-4">
                  <div>
                    <h3 className={cn("mb-4 text-sm font-medium text-zinc-200")}>
                      Select Blueprint
                    </h3>
                    <Select
                      value={formData.blueprintId}
                      onValueChange={(value) => setFormData({ ...formData, blueprintId: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a blueprint..." />
                      </SelectTrigger>
                      <SelectContent>
                        {blueprintsList.map((blueprint) => {
                          const dockerImage =
                            Object.values(blueprint.dockerImages || {})[0] || "No image";
                          return (
                            <SelectItem key={blueprint.id} value={blueprint.id}>
                              {blueprint.name} - {dockerImage}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {selectedBlueprint && (
                      <div className={cn("mt-3 border border-zinc-700 bg-zinc-900/50 p-3 text-xs")}>
                        {selectedBlueprint.description && (
                          <p className={"text-zinc-400"}>{selectedBlueprint.description}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedBlueprint.dockerImages &&
                            Object.keys(selectedBlueprint.dockerImages).length > 0 && (
                              <span
                                className={cn(
                                  "border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500"
                                )}
                              >
                                {Object.keys(selectedBlueprint.dockerImages).length} docker images
                              </span>
                            )}
                          {selectedBlueprint.variables &&
                            selectedBlueprint.variables.length > 0 && (
                              <span
                                className={cn(
                                  "border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500"
                                )}
                              >
                                {selectedBlueprint.variables.length} variables
                              </span>
                            )}
                          {selectedBlueprint.startup && (
                            <span
                              className={cn(
                                "border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500"
                              )}
                            >
                              startup command
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Docker Image Selection */}
                  {selectedBlueprint?.dockerImages &&
                    Object.keys(selectedBlueprint.dockerImages).length > 0 && (
                      <div>
                        <h3
                          className={cn(
                            "mb-4 flex items-center gap-2 text-sm font-medium text-zinc-200"
                          )}
                        >
                          <ImageIcon className="h-4 w-4" />
                          Docker Image
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(selectedBlueprint.dockerImages).map(([label, image]) => (
                            <TextureButton
                              variant="minimal"
                              key={label}
                              type="button"
                              onClick={() => setSelectedDockerImage(image)}
                            >
                              {label}
                            </TextureButton>
                          ))}
                        </div>
                        <p className={cn("mt-2 font-mono text-[10px] text-zinc-600")}>
                          {selectedDockerImage}
                        </p>
                      </div>
                    )}

                  {/* Startup Variables */}
                  {selectedBlueprint?.variables && selectedBlueprint.variables.length > 0 && (
                    <div>
                      <h3
                        className={cn(
                          "mb-4 flex items-center gap-2 text-sm font-medium text-zinc-200"
                        )}
                      >
                        <VariableIcon className="h-4 w-4" />
                        Startup Variables
                      </h3>
                      <div className="space-y-4">
                        {selectedBlueprint.variables
                          .filter((v: any) => v.user_viewable !== false)
                          .map((variable: any) => (
                            <div key={variable.env_variable}>
                              <div className="mb-1 flex items-center gap-2">
                                <Label>{variable.name}</Label>
                                <span
                                  className={cn(
                                    "rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600"
                                  )}
                                >
                                  {variable.env_variable}
                                </span>
                                {variable.user_editable === false && (
                                  <span
                                    className={cn(
                                      "rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500"
                                    )}
                                  >
                                    read only
                                  </span>
                                )}
                              </div>
                              {variable.description && (
                                <p className={cn("mb-2 text-[11px] text-zinc-500")}>
                                  {variable.description}
                                </p>
                              )}
                              <Input
                                type="text"
                                value={variableValues[variable.env_variable] || ""}
                                onChange={(e) =>
                                  setVariableValues((prev) => ({
                                    ...prev,
                                    [variable.env_variable]: e.target.value,
                                  }))
                                }
                                disabled={variable.user_editable === false}
                                placeholder={variable.default_value || ""}
                                className={cn(
                                  "font-mono text-sm",
                                  variable.user_editable === false &&
                                    "cursor-not-allowed opacity-60"
                                )}
                              />
                              <div
                                className={cn(
                                  "mt-1 flex items-center gap-2 text-[10px] text-zinc-600"
                                )}
                              >
                                <span>Default: {variable.default_value || "(empty)"}</span>
                                {variable.rules && (
                                  <>
                                    <span>|</span>
                                    <span>Rules: {variable.rules}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {/* Submit Button */}
              <div className={cn("mt-6 flex justify-end gap-3 border-t border-zinc-700/50 pt-6")}>
                <TextureButton
                  type="button"
                  variant="destructive"
                  onClick={() => router.push("/admin/servers")}
                >
                  Cancel
                </TextureButton>
                <TextureButton type="submit" disabled={create.isPending}>
                  {create.isPending ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <ServerIcon className="h-4 w-4" />
                  )}
                  {create.isPending ? "Creating..." : "Create Server"}
                </TextureButton>
              </div>
            </form>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
