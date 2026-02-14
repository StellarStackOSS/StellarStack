"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@stellarUI/lib/Utils";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import Switch from "@stellarUI/components/Switch/Switch";
import Input from "@stellarUI/components/Input/Input";
import Label from "@stellarUI/components/Label/Label";
import Badge from "@stellarUI/components/Badge/Badge";
import Dialog, {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@stellarUI/components/Dialog/Dialog";
import {
  BsSearch,
  BsGear,
  BsCheckCircle,
  BsXCircle,
  BsExclamationTriangle,
  BsBox,
  BsGlobe,
  BsShield,
  BsArrowRepeat,
  BsPuzzle,
  BsController,
  BsGraphUp,
  BsMegaphone,
  BsTree,
  BsDownload,
  BsGit,
} from "react-icons/bs";
import { usePlugins, usePluginMutations } from "@/hooks/queries/UsePlugins";
import type { PluginInfo } from "@/lib/Api";
import { toast } from "sonner";
import { pluginsApi } from "@/lib/Api";

const CATEGORY_LABELS: Record<string, string> = {
  "game-management": "Game Management",
  modding: "Modding",
  monitoring: "Monitoring",
  automation: "Automation",
  integration: "Integration",
  security: "Security",
  utility: "Utility",
  theme: "Theme",
  other: "Other",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  modding: <BsPuzzle className="h-4 w-4" />,
  monitoring: <BsGraphUp className="h-4 w-4" />,
  automation: <BsArrowRepeat className="h-4 w-4" />,
  integration: <BsGlobe className="h-4 w-4" />,
  security: <BsShield className="h-4 w-4" />,
  utility: <BsGear className="h-4 w-4" />,
  other: <BsBox className="h-4 w-4" />,
};

const PLUGIN_ICONS: Record<string, React.ReactNode> = {
  flame: <BsBox className="h-6 w-6 text-orange-400" />,
  leaf: <BsTree className="h-6 w-6 text-green-400" />,
  gamepad: <BsController className="h-6 w-6 text-blue-400" />,
  megaphone: <BsMegaphone className="h-6 w-6 text-purple-400" />,
  chart: <BsGraphUp className="h-6 w-6 text-cyan-400" />,
};

const PluginsPage = () => {
  const { data: plugins = [], isLoading } = usePlugins();
  const { enable, disable, updateConfig } = usePluginMutations();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginInfo | null>(null);
  const [configForm, setConfigForm] = useState<Record<string, unknown>>({});
  const [installRepoUrl, setInstallRepoUrl] = useState("");
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  // Get unique categories from plugins
  const categories = useMemo(() => {
    const cats = new Set(plugins.map((p) => p.category));
    return Array.from(cats).sort();
  }, [plugins]);

  // Filter plugins
  const filteredPlugins = useMemo(() => {
    let filtered = plugins;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.pluginId.toLowerCase().includes(query)
      );
    }
    if (selectedCategory) {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }
    return filtered;
  }, [plugins, searchQuery, selectedCategory]);

  const handleTogglePlugin = async (plugin: PluginInfo) => {
    if (plugin.status === "enabled") {
      disable.mutate(plugin.pluginId);
    } else {
      enable.mutate(plugin.pluginId);
    }
  };

  const handleOpenConfig = (plugin: PluginInfo) => {
    setSelectedPlugin(plugin);
    setConfigForm(plugin.config || {});
    setConfigModalOpen(true);
  };

  const handleSaveConfig = async () => {
    if (!selectedPlugin) return;
    updateConfig.mutate(
      { pluginId: selectedPlugin.pluginId, config: configForm },
      {
        onSuccess: () => {
          setConfigModalOpen(false);
          setSelectedPlugin(null);
        },
      }
    );
  };

  const handleInstallPlugin = async () => {
    if (!installRepoUrl.trim()) {
      setInstallError("Please enter a repository URL");
      return;
    }

    setIsInstalling(true);
    setInstallError(null);

    try {
      // Validate URL format (basic check)
      if (!installRepoUrl.includes("github.com") && !installRepoUrl.includes("gitlab.com")) {
        setInstallError(
          "Only GitHub and GitLab repositories are supported. Please use a URL like https://github.com/username/plugin-name"
        );
        setIsInstalling(false);
        return;
      }

      // This would call the plugin install API
      // TODO: Implement actual API call to install plugin from git
      console.log("Installing plugin from:", installRepoUrl);
      toast.success("Plugin installation started. Please check the console for progress.");

      // Reset form
      setInstallRepoUrl("");
      setInstallModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to install plugin";
      setInstallError(message);
      toast.error(message);
    } finally {
      setIsInstalling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "enabled":
        return (
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <BsCheckCircle className="h-3 w-3" />
            Enabled
          </span>
        );
      case "disabled":
      case "installed":
        return (
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            <BsXCircle className="h-3 w-3" />
            Disabled
          </span>
        );
      case "error":
        return (
          <span className="flex items-center gap-1.5 text-xs text-red-400">
            <BsExclamationTriangle className="h-3 w-3" />
            Error
          </span>
        );
      default:
        return <span className="text-xs text-zinc-500">{status}</span>;
    }
  };

  // Render config field based on JSON Schema type
  const renderConfigField = (key: string, schema: Record<string, unknown>) => {
    const type = schema.type as string;
    const title = (schema.title as string) || key;
    const description = schema.description as string;
    const value = configForm[key];

    if (type === "boolean") {
      return (
        <div
          key={key}
          className="flex items-center justify-between rounded-lg border border-zinc-800 p-4"
        >
          <div>
            <Label className="text-sm text-zinc-200">{title}</Label>
            {description && <p className="mt-1 text-xs text-zinc-500">{description}</p>}
          </div>
          <Switch
            checked={(value as boolean) ?? (schema.default as boolean) ?? false}
            onCheckedChange={(checked) => setConfigForm((prev) => ({ ...prev, [key]: checked }))}
          />
        </div>
      );
    }

    return (
      <div key={key} className="space-y-2">
        <Label className="text-sm text-zinc-200">{title}</Label>
        {description && <p className="text-xs text-zinc-500">{description}</p>}
        <Input
          type={type === "number" ? "number" : "text"}
          value={String(value ?? schema.default ?? "")}
          onChange={(e) =>
            setConfigForm((prev) => ({
              ...prev,
              [key]: type === "number" ? Number(e.target.value) : e.target.value,
            }))
          }
          placeholder={`Enter ${title.toLowerCase()}`}
          className="border-zinc-700/50 bg-zinc-900/50 text-zinc-200 placeholder:text-zinc-600"
        />
      </div>
    );
  };

  return (
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-black px-4 pb-4">
        {/* Header */}
        <FadeIn delay={0}>
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-lg font-semibold text-zinc-100">Extensions</h1>
                <p className="text-xs text-zinc-500">
                  Manage extensions and integrations for StellarStack
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-zinc-500">
                {plugins.filter((p) => p.status === "enabled").length} / {plugins.length} enabled
              </span>
              <TextureButton
                onClick={() => setInstallModalOpen(true)}
                className="flex items-center gap-2"
              >
                <BsDownload className="h-4 w-4" />
                Install from Git
              </TextureButton>
            </div>
          </div>
        </FadeIn>

        <div className="space-y-4">
          {/* Search & Filters */}
          <FadeIn delay={0.05}>
            <div className="flex flex-col gap-4 rounded-lg border border-white/5 bg-[#090909] p-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <BsSearch className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search extensions..."
                    className="border-zinc-700/50 bg-zinc-900/50 pl-9 text-zinc-200 placeholder:text-zinc-600"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    selectedCategory === null
                      ? "bg-zinc-100 text-zinc-900"
                      : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  )}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      selectedCategory === cat
                        ? "bg-zinc-100 text-zinc-900"
                        : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    )}
                  >
                    {CATEGORY_LABELS[cat] || cat}
                  </button>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* Plugin Grid */}
          <FadeIn delay={0.1}>
            <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
              <div className="shrink-0 pb-2 pl-2 text-xs opacity-50">
                Available Extensions ({filteredPlugins.length})
              </div>
              <div className="rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-4 shadow-lg shadow-black/20">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Spinner className="h-6 w-6 text-zinc-400" />
                  </div>
                ) : filteredPlugins.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <BsPuzzle className="mb-4 h-12 w-12 text-zinc-700" />
                    <p className="text-sm text-zinc-500">
                      {searchQuery
                        ? "No extensions match your search."
                        : "No extensions available."}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredPlugins.map((plugin) => (
                      <div
                        key={plugin.pluginId}
                        className={cn(
                          "group relative flex flex-col rounded-lg border p-4 transition-all",
                          plugin.status === "enabled"
                            ? "border-zinc-700/50 bg-zinc-900/30"
                            : "border-zinc-800/50 bg-zinc-950/30",
                          "hover:border-zinc-600/50"
                        )}
                      >
                        {/* Header */}
                        <div className="mb-3 flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800/50">
                              {PLUGIN_ICONS[plugin.icon || ""] || (
                                <BsPuzzle className="h-5 w-5 text-zinc-400" />
                              )}
                            </div>
                            <div>
                              <h3 className="text-sm font-medium text-zinc-200">{plugin.name}</h3>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-600">v{plugin.version}</span>
                                {plugin.isBuiltIn && (
                                  <Badge
                                    variant="outline"
                                    className="border-zinc-700 px-1.5 py-0 text-[10px] text-zinc-500"
                                  >
                                    Official
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Switch
                            checked={plugin.status === "enabled"}
                            onCheckedChange={() => handleTogglePlugin(plugin)}
                            disabled={enable.isPending || disable.isPending}
                          />
                        </div>

                        {/* Description */}
                        <p className="mb-3 flex-1 text-xs leading-relaxed text-zinc-500">
                          {plugin.description}
                        </p>

                        {/* Footer */}
                        <div className="flex items-center justify-between border-t border-zinc-800/50 pt-3">
                          <div className="flex items-center gap-3">
                            {getStatusBadge(plugin.status)}
                            <span className="text-xs text-zinc-600">
                              {CATEGORY_LABELS[plugin.category] || plugin.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {plugin.gameTypes.length > 0 && !plugin.gameTypes.includes("*") && (
                              <span className="text-xs text-zinc-600">
                                {plugin.gameTypes.join(", ")}
                              </span>
                            )}
                            {plugin.configSchema && (
                              <TextureButton
                                variant="ghost"
                                size="sm"
                                className="w-fit opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={() => handleOpenConfig(plugin)}
                              >
                                <BsGear className="h-3.5 w-3.5" />
                              </TextureButton>
                            )}
                          </div>
                        </div>

                        {/* Error display */}
                        {plugin.error && (
                          <div className="mt-2 rounded border border-red-900/50 bg-red-950/20 p-2">
                            <p className="text-xs text-red-400">{plugin.error}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </FadeIn>

          {/* Info Section */}
          <FadeIn delay={0.15}>
            <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
              <div className="shrink-0 pb-2 pl-2 text-xs opacity-50">Extension System</div>
              <div className="rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-6 shadow-lg shadow-black/20">
                <div className="grid gap-6 sm:grid-cols-3">
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-zinc-300">About Extensions</h3>
                    <p className="text-xs leading-relaxed text-zinc-500">
                      Extensions enhance StellarStack with additional features like modpack
                      installers, monitoring tools, and game integrations. Enable or disable them as
                      needed.
                    </p>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-zinc-300">Configuration</h3>
                    <p className="text-xs leading-relaxed text-zinc-500">
                      Some extensions require configuration before they can be used. Click the
                      settings icon on an extension card to configure it. For example, the
                      CurseForge extension requires an API key.
                    </p>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-zinc-300">Community Extensions</h3>
                    <p className="text-xs leading-relaxed text-zinc-500">
                      Community developers can build extensions using the StellarStack Extension SDK.
                      Click "Install from Git" to install community-developed extensions from GitHub or
                      GitLab repositories.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Config Modal */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="max-w-lg border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-zinc-100">
              {selectedPlugin?.name} Settings
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              Configure extension settings and preferences.
            </DialogDescription>
          </DialogHeader>
          {selectedPlugin?.configSchema && (
            <div className="mt-4 space-y-4">
              {Object.entries(
                (
                  selectedPlugin.configSchema as {
                    properties?: Record<string, Record<string, unknown>>;
                  }
                ).properties || {}
              ).map(([key, schema]) => renderConfigField(key, schema))}

              <div className="mt-6 flex justify-end gap-2">
                <TextureButton variant="minimal" onClick={() => setConfigModalOpen(false)}>
                  Cancel
                </TextureButton>
                <TextureButton onClick={handleSaveConfig} disabled={updateConfig.isPending}>
                  {updateConfig.isPending ? "Saving..." : "Save Changes"}
                </TextureButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Install Plugin Modal */}
      <Dialog open={installModalOpen} onOpenChange={setInstallModalOpen}>
        <DialogContent className="max-w-lg border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
              <BsGit className="h-5 w-5" />
              Install Community Extension
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              Install a community-developed extension from a Git repository. Only GitHub and GitLab
              are supported.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-zinc-200">Repository URL</Label>
              <Input
                type="url"
                placeholder="https://github.com/username/extension-name"
                value={installRepoUrl}
                onChange={(e) => {
                  setInstallRepoUrl(e.target.value);
                  setInstallError(null);
                }}
                className="border-zinc-700/50 bg-zinc-900/50 text-zinc-200 placeholder:text-zinc-600"
                disabled={isInstalling}
              />
              <p className="text-xs text-zinc-500">
                Enter the full URL to the Git repository containing the extension's stellarstack.json
                manifest.
              </p>
            </div>

            {/* Security Warning */}
            <div className="rounded-lg border border-yellow-900/50 bg-yellow-950/20 p-3">
              <div className="flex gap-2">
                <BsExclamationTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-600" />
                <div className="text-xs text-yellow-700">
                  <p className="font-medium mb-1">Only install extensions you trust</p>
                  <p>
                    Community extensions run in isolated processes but still have access to your server
                    data. Review the source code before installing.
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {installError && (
              <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-3">
                <p className="text-xs text-red-400">{installError}</p>
              </div>
            )}

            {/* Info Section */}
            <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3">
              <h4 className="mb-2 text-xs font-medium text-zinc-300">What happens next:</h4>
              <ol className="space-y-1 text-xs text-zinc-400">
                <li>1. Repository is cloned from Git</li>
                <li>2. stellarstack.json manifest is validated</li>
                <li>3. Automatic security analysis runs</li>
                <li>4. Extension appears in your list with trust badge</li>
              </ol>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <TextureButton
                variant="minimal"
                onClick={() => {
                  setInstallModalOpen(false);
                  setInstallRepoUrl("");
                  setInstallError(null);
                }}
                disabled={isInstalling}
              >
                Cancel
              </TextureButton>
              <TextureButton
                onClick={handleInstallPlugin}
                disabled={isInstalling || !installRepoUrl.trim()}
                className="flex items-center gap-2"
              >
                {isInstalling ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    Installing...
                  </>
                ) : (
                  <>
                    <BsDownload className="h-4 w-4" />
                    Install
                  </>
                )}
              </TextureButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </FadeIn>
  );
};

export default PluginsPage;
