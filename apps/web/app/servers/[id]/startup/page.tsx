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
import { FadeIn } from "@workspace/ui/components/fade-in";
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-black px-4 pb-4">
          {/* Header */}
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger
                  className={cn(
                    "text-zinc-400 transition-all hover:scale-110 hover:text-zinc-100 active:scale-95"
                  )}
                />
              </div>
              <div className="flex items-center gap-2">
                {hasChanges && (
                  <TextureButton
                    variant="minimal"
                    size="sm"
                    className="w-fit"
                    onClick={handleReset}
                  >
                    Reset
                  </TextureButton>
                )}
                <TextureButton
                  variant={saved ? "primary" : "minimal"}
                  size="sm"
                  className="w-fit"
                  onClick={() => setSaveModalOpen(true)}
                  disabled={!hasChanges}
                >
                  {saved ? (
                    <>
                      <BsCheckCircle className="h-4 w-4" />
                      Saved
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </TextureButton>
                <TextureButton
                  variant="minimal"
                  size="sm"
                  className="w-fit"
                  onClick={() => setReinstallModalOpen(true)}
                  disabled={hasChanges}
                  title={
                    hasChanges
                      ? "Save changes first before reinstalling"
                      : "Reinstall server with current configuration"
                  }
                >
                  <BsArrowRepeat className="h-4 w-4" />
                  Reinstall
                </TextureButton>
              </div>
            </div>
          </FadeIn>

          <div className="space-y-4">
            {/* Docker Image Selector */}
            {dockerImages.length > 0 && (
              <FadeIn delay={0.05}>
                <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
                  <div className="shrink-0 pb-2 pl-2 text-xs opacity-50">Docker Image</div>
                  <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-4 shadow-lg shadow-black/20">
                    <div className="flex flex-wrap gap-2">
                      {dockerImages.map((img) => (
                        <TextureButton
                          key={img.image}
                          variant={selectedDockerImage === img.image ? "primary" : "minimal"}
                          size="sm"
                          className="w-fit"
                          onClick={() => handleDockerImageChange(img.image)}
                        >
                          {img.label}
                        </TextureButton>
                      ))}
                    </div>
                    <p className="mt-3 font-mono text-[10px] text-zinc-600">
                      {selectedDockerImage}
                    </p>
                  </div>
                </div>
              </FadeIn>
            )}

            {/* Startup Command Preview */}
            <FadeIn delay={0.1}>
              <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
                <div className="shrink-0 pb-2 pl-2 text-xs opacity-50">Startup Command</div>
                <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-4 shadow-lg shadow-black/20">
                  <div className="overflow-x-auto rounded border border-zinc-700/50 bg-zinc-900/50 p-3 font-mono text-xs text-zinc-300">
                    {getStartupCommandPreview() || "No startup command configured"}
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Custom Startup Commands */}
            <FadeIn delay={0.15}>
              <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
                <div className="shrink-0 pb-2 pl-2 text-xs opacity-50">Custom Startup Commands</div>
                <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-4 shadow-lg shadow-black/20">
                  <p className="mb-3 text-xs text-zinc-400">
                    Additional commands to append to the startup command. These will be executed
                    after the main command.
                  </p>
                  <Textarea
                    value={customStartupCommands}
                    onChange={(e) => handleCustomStartupCommandsChange(e.target.value)}
                    placeholder="e.g., && echo 'Server started' || --additional-flag"
                    rows={3}
                  />
                </div>
              </div>
            </FadeIn>

            {/* Variables */}
            {variables.length === 0 ? (
              <FadeIn delay={0.2}>
                <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
                  <div className="shrink-0 pb-2 pl-2 text-xs opacity-50">Variables</div>
                  <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-8 shadow-lg shadow-black/20">
                    <p className="text-sm text-zinc-500">
                      No startup variables configured for this blueprint.
                    </p>
                  </div>
                </div>
              </FadeIn>
            ) : (
              <FadeIn delay={0.2}>
                <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
                  <div className="shrink-0 pb-2 pl-2 text-xs opacity-50">
                    Variables ({variables.length})
                  </div>
                  <div className="flex flex-1 flex-col gap-3 rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-4 shadow-lg shadow-black/20">
                    {variables.map((variable, index) => (
                      <div
                        key={variable.envVariable}
                        className="rounded-lg border border-zinc-800/50 bg-zinc-900/30 p-4"
                      >
                        <div className="mb-2 flex items-center gap-3">
                          <h3 className="text-sm font-medium tracking-wider text-zinc-100 uppercase">
                            {variable.name}
                          </h3>
                          <span className="rounded border border-zinc-700 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
                            {variable.envVariable}
                          </span>
                          {!variable.userEditable && (
                            <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] tracking-wider text-zinc-500 uppercase">
                              Read Only
                            </span>
                          )}
                        </div>
                        <p className="mb-4 text-xs text-zinc-500">{variable.description}</p>
                        <Input
                          type="text"
                          value={variable.value}
                          onChange={(e) =>
                            handleVariableChange(variable.envVariable, e.target.value)
                          }
                          disabled={!variable.userEditable}
                          placeholder={variable.defaultValue}
                        />
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-zinc-600">
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
                    ))}
                  </div>
                </div>
              </FadeIn>
            )}
          </div>
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
    </FadeIn>
  );
};

export default StartupPage;
