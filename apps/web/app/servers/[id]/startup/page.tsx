"use client";

import { type JSX, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { cn } from "@workspace/ui/lib/utils";
import { TextureButton } from "@workspace/ui/components/texture-button";
import { SidebarTrigger } from "@workspace/ui/components/sidebar";
import { ConfirmationModal } from "@workspace/ui/components/confirmation-modal";
import { Spinner } from "@workspace/ui/components/spinner";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";
import { BsArrowRepeat, BsCheckCircle, BsInfoCircle } from "react-icons/bs";
import type { DockerImageOption, StartupVariable } from "@/lib/api";
import { servers } from "@/lib/api";
import { useServer } from "components/ServerStatusPages/server-provider";
import { ServerInstallingPlaceholder } from "components/ServerStatusPages/server-installing-placeholder";
import { ServerSuspendedPlaceholder } from "components/ServerStatusPages/server-suspended-placeholder";
import { toast } from "sonner";

const StartupPage = (): JSX.Element | null => {
  const params = useParams();
  const serverId = params.id as string;
  const { server, isInstalling } = useServer();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Startup configuration state
  const [variables, setVariables] = useState<StartupVariable[]>([]);
  const [originalVariables, setOriginalVariables] = useState<StartupVariable[]>([]);
  const [dockerImages, setDockerImages] = useState<DockerImageOption[]>([]);
  const [selectedDockerImage, setSelectedDockerImage] = useState("");
  const [originalDockerImage, setOriginalDockerImage] = useState("");
  const [startupCommand, setStartupCommand] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [customStartupCommands, setCustomStartupCommands] = useState("");
  const [originalCustomStartupCommands, setOriginalCustomStartupCommands] = useState("");

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [reinstallModalOpen, setReinstallModalOpen] = useState(false);
  const [isReinstalling, setIsReinstalling] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (serverId) {
      fetchStartupConfig();
    }
  }, [serverId]);

  const fetchStartupConfig = async () => {
    try {
      setIsLoading(true);
      const config = await servers.startup.get(serverId);
      setVariables(config.variables);
      setOriginalVariables(JSON.parse(JSON.stringify(config.variables)));
      setDockerImages(config.dockerImages);
      setSelectedDockerImage(config.selectedDockerImage);
      setOriginalDockerImage(config.selectedDockerImage);
      setStartupCommand(config.startupCommand);
      setFeatures(config.features);
      setCustomStartupCommands(config.customStartupCommands || "");
      setOriginalCustomStartupCommands(config.customStartupCommands || "");
    } catch {
      toast.error("Failed to load startup configuration");
    } finally {
      setIsLoading(false);
    }
  };

  if (isInstalling) {
    return (
      <div className="min-h-svh">
        {/* Background is now rendered in the layout for persistence */}
        <ServerInstallingPlaceholder serverName={server?.name} />
      </div>
    );
  }

  if (server?.status === "SUSPENDED") {
    return (
      <div className="min-h-svh">
        <ServerSuspendedPlaceholder serverName={server?.name} />
      </div>
    );
  }

  const handleVariableChange = (envVariable: string, value: string) => {
    setVariables((prev) => prev.map((v) => (v.envVariable === envVariable ? { ...v, value } : v)));
    setSaved(false);
  };

  const handleDockerImageChange = (image: string) => {
    setSelectedDockerImage(image);
    setSaved(false);
  };

  const handleCustomStartupCommandsChange = (value: string) => {
    setCustomStartupCommands(value);
    setSaved(false);
  };

  const hasChanges =
    JSON.stringify(variables) !== JSON.stringify(originalVariables) ||
    selectedDockerImage !== originalDockerImage ||
    customStartupCommands !== originalCustomStartupCommands;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Build variables object
      const variablesMap: Record<string, string> = {};
      variables.forEach((v) => {
        if (v.userEditable) {
          variablesMap[v.envVariable] = v.value;
        }
      });

      await servers.startup.update(serverId, {
        variables: variablesMap,
        dockerImage: selectedDockerImage,
        customStartupCommands: customStartupCommands,
      });

      setOriginalVariables(JSON.parse(JSON.stringify(variables)));
      setOriginalDockerImage(selectedDockerImage);
      setOriginalCustomStartupCommands(customStartupCommands);
      setSaveModalOpen(false);
      setSaved(true);
      toast.success("Startup configuration saved");
      setTimeout(() => setSaved(false), 2000);

      // Refresh to get updated startup command
      fetchStartupConfig();
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setVariables(JSON.parse(JSON.stringify(originalVariables)));
    setSelectedDockerImage(originalDockerImage);
    setCustomStartupCommands(originalCustomStartupCommands);
  };

  const handleReinstall = async () => {
    setIsReinstalling(true);
    try {
      await servers.reinstall(serverId);
      setReinstallModalOpen(false);
      toast.success("Server reinstalled successfully with new configuration");
    } catch {
      toast.error("Failed to reinstall server");
    } finally {
      setIsReinstalling(false);
    }
  };

  // Build the startup command preview with current values
  const getStartupCommandPreview = () => {
    let command = startupCommand;
    variables.forEach((v) => {
      const regex = new RegExp(`\\{\\{${v.envVariable}\\}\\}`, "g");
      command = command.replace(regex, v.value);
    });
    return command;
  };

  if (isLoading) {
    return (
      <div className="relative flex min-h-full items-center justify-center transition-colors">
        {/* Background is now rendered in the layout for persistence */}
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="relative min-h-full transition-colors">
      {/* Background is now rendered in the layout for persistence */}

      <div className="relative p-8">
        <div className="mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <SidebarTrigger
                className={cn(
                  "transition-all hover:scale-110 active:scale-95",
                  "text-zinc-400 hover:text-zinc-100"
                )}
              />
              <div>
                <h1 className={cn("text-2xl font-light tracking-wider", "text-zinc-100")}>
                  STARTUP PARAMETERS
                </h1>
                <p className={cn("mt-1 text-sm", "text-zinc-500")}>
                  Configure startup variables and Docker image
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <TextureButton variant="minimal" onClick={handleReset}>
                  <span className="text-xs tracking-wider uppercase">Reset</span>
                </TextureButton>
              )}
              <TextureButton
                variant="minimal"
                onClick={() => setSaveModalOpen(true)}
                disabled={!hasChanges}
              >
                {saved ? (
                  <>
                    <BsCheckCircle className="h-4 w-4" />
                    <span className="text-xs tracking-wider uppercase">Saved</span>
                  </>
                ) : (
                  <span className="text-xs tracking-wider uppercase">Save Changes</span>
                )}
              </TextureButton>
              <TextureButton
                variant="minimal"
                onClick={() => setReinstallModalOpen(true)}
                disabled={hasChanges}
                title={
                  hasChanges
                    ? "Save changes first before reinstalling"
                    : "Reinstall server with current configuration"
                }
              >
                <BsArrowRepeat className="h-4 w-4" />
                <span className="text-xs tracking-wider uppercase">Reinstall</span>
              </TextureButton>
            </div>
          </div>

          {/* Docker Image Selector */}
          {dockerImages.length > 0 && (
            <div
              className={cn(
                "relative mb-6 border p-4",
                "border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a]"
              )}
            >
              <Label>Docker Image</Label>
              <div className="mt-3 flex flex-wrap gap-2">
                {dockerImages.map((img) => (
                  <TextureButton
                    key={img.image}
                    variant="minimal"
                    onClick={() => handleDockerImageChange(img.image)}
                  >
                    {img.label}
                  </TextureButton>
                ))}
              </div>
              <p className={cn("mt-2 font-mono text-[10px]", "text-zinc-600")}>
                {selectedDockerImage}
              </p>
            </div>
          )}

          {/* Startup Command Preview */}
          <div
            className={cn(
              "relative mb-6 border p-4",
              "border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a]"
            )}
          >
            <Label>Startup Command</Label>
            <div
              className={cn(
                "mt-2 overflow-x-auto border p-3 font-mono text-xs",
                "border-zinc-700/50 bg-zinc-900/50 text-zinc-300"
              )}
            >
              {getStartupCommandPreview() || "No startup command configured"}
            </div>
          </div>

          {/* Custom Startup Commands */}
          <div
            className={cn(
              "relative mb-6 border p-4",
              "border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a]"
            )}
          >
            <Label>Custom Startup Commands</Label>
            <p className={cn("mt-1 mb-3 text-xs", "text-zinc-400")}>
              Additional commands to append to the startup command. These will be executed after the
              main command.
            </p>
            <Textarea
              value={customStartupCommands}
              onChange={(e) => handleCustomStartupCommandsChange(e.target.value)}
              placeholder="e.g., && echo 'Server started' || --additional-flag"
              rows={3}
            />
          </div>

          {/* Variables */}
          {variables.length === 0 ? (
            <div className={cn("border py-12 text-center", "border-zinc-800 text-zinc-500")}>
              No startup variables configured for this blueprint.
            </div>
          ) : (
            <div className="space-y-4">
              {variables.map((variable) => (
                <div
                  key={variable.envVariable}
                  className={cn(
                    "relative border p-6 transition-all",
                    "border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a]"
                  )}
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <h3
                          className={cn(
                            "text-sm font-medium tracking-wider uppercase",
                            "text-zinc-100"
                          )}
                        >
                          {variable.name}
                        </h3>
                        <span
                          className={cn(
                            "border px-2 py-0.5 font-mono text-[10px]",
                            "border-zinc-700 text-zinc-500"
                          )}
                        >
                          {variable.envVariable}
                        </span>
                        {!variable.userEditable && (
                          <span
                            className={cn(
                              "px-2 py-0.5 text-[10px] tracking-wider uppercase",
                              "bg-zinc-800 text-zinc-500"
                            )}
                          >
                            Read Only
                          </span>
                        )}
                      </div>
                      <p className={cn("mb-4 text-xs", "text-zinc-500")}>{variable.description}</p>
                      <Input
                        type="text"
                        value={variable.value}
                        onChange={(e) => handleVariableChange(variable.envVariable, e.target.value)}
                        disabled={!variable.userEditable}
                        placeholder={variable.defaultValue}
                      />
                      <div
                        className={cn("mt-2 flex items-center gap-1 text-[10px]", "text-zinc-600")}
                      >
                        <BsInfoCircle className="h-3 w-3" />
                        <span>Default: {variable.defaultValue || "(empty)"}</span>
                        {variable.rules && (
                          <>
                            <span className="mx-1">|</span>
                            <span>Rules: {variable.rules}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Save Confirmation Modal */}
      <ConfirmationModal
        open={saveModalOpen}
        onOpenChange={setSaveModalOpen}
        title="Save Changes"
        description="Are you sure you want to save these startup parameter changes? The server will need to be reinstalled for changes to take effect."
        onConfirm={handleSave}
        confirmLabel="Save"
        isLoading={isSaving}
      />

      {/* Reinstall Confirmation Modal */}
      <ConfirmationModal
        open={reinstallModalOpen}
        onOpenChange={setReinstallModalOpen}
        title="Reinstall Server"
        description="This will delete the current container and create a new one with the saved configuration. All running processes will be stopped and any unsaved data may be lost. Are you sure you want to continue?"
        onConfirm={handleReinstall}
        confirmLabel="Reinstall"
        isLoading={isReinstalling}
      />
    </div>
  );
};

export default StartupPage;
