"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import Input from "@stellarUI/components/Input/Input";
import Badge from "@stellarUI/components/Badge/Badge";
import {
  BsSearch,
  BsBox,
  BsPuzzle,
  BsDownload,
  BsArrowRepeat,
  BsCheckCircle,
  BsController,
  BsGraphUp,
  BsMegaphone,
  BsTree,
} from "react-icons/bs";
import { useServer } from "components/ServerStatusPages/ServerProvider/ServerProvider";
import { useServerTabPlugins } from "@/hooks/queries/UsePlugins";
import { ServerInstallingPlaceholder } from "components/ServerStatusPages/ServerInstallingPlaceholder/ServerInstallingPlaceholder";
import { ServerSuspendedPlaceholder } from "components/ServerStatusPages/ServerSuspendedPlaceholder/ServerSuspendedPlaceholder";
import { CurseForgeTab } from "./CurseForgeTab";
import { ModrinthTab } from "./ModrinthTab";
import { SteamWorkshopTab } from "./SteamWorkshopTab";
import { AnnouncerTab } from "./AnnouncerTab";
import { SchemaRenderer } from "@/components/plugin-ui/SchemaRenderer";
import type { UISchema } from "@stellarstack/plugin-sdk";
import type { PluginInfo } from "@/lib/Api";

const PLUGIN_ICONS: Record<string, React.ReactNode> = {
  flame: <BsBox className="h-5 w-5 text-orange-400" />,
  leaf: <BsTree className="h-5 w-5 text-green-400" />,
  gamepad: <BsController className="h-5 w-5 text-blue-400" />,
  megaphone: <BsMegaphone className="h-5 w-5 text-purple-400" />,
  chart: <BsGraphUp className="h-5 w-5 text-cyan-400" />,
};

const ServerPluginsPage = () => {
  const params = useParams();
  const serverId = params.id as string;
  const { server, isInstalling } = useServer();
  const { data: tabPlugins = [], isLoading } = useServerTabPlugins(serverId);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Find active tab plugin and tab
  const activePlugin = useMemo(() => {
    if (!activeTabId) return null;
    return tabPlugins.find((p) => {
      const tabs = p.uiMetadata?.serverTabs || [];
      return tabs.some((t) => `${p.pluginId}:${t.id}` === activeTabId);
    });
  }, [activeTabId, tabPlugins]);

  const activeTab = useMemo(() => {
    if (!activeTabId || !activePlugin) return null;
    const tabs = activePlugin.uiMetadata?.serverTabs || [];
    return tabs.find((t) => `${activePlugin.pluginId}:${t.id}` === activeTabId);
  }, [activeTabId, activePlugin]);

  // Auto-select first tab when plugins load
  React.useEffect(() => {
    if (!activeTabId && tabPlugins.length > 0) {
      const firstPlugin = tabPlugins[0];
      const firstTab = firstPlugin?.uiMetadata?.serverTabs?.[0];
      if (firstTab) {
        setActiveTabId(`${firstPlugin.pluginId}:${firstTab.id}`);
      }
    }
  }, [tabPlugins, activeTabId]);

  if (isInstalling) {
    return (
      <div className="min-h-svh">
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

  // Render the active plugin tab component
  const renderActiveTab = () => {
    if (!activePlugin || !activeTab) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BsPuzzle className="mb-4 h-12 w-12 text-zinc-700" />
          <h3 className="mb-2 text-sm font-medium text-zinc-400">No Extension Selected</h3>
          <p className="text-xs text-zinc-600">
            Select an extension tab from the sidebar to get started.
          </p>
        </div>
      );
    }

    // Check if tab has a declarative UI schema (new system)
    const uiSchema = (activeTab as { uiSchema?: UISchema })?.uiSchema;
    if (uiSchema) {
      return (
        <SchemaRenderer
          schema={uiSchema}
          pluginId={activePlugin.pluginId}
          serverId={serverId}
          pluginConfig={activePlugin.config}
        />
      );
    }

    // Fallback to hardcoded components for legacy plugins (temporarily)
    // These will eventually be migrated to use schemas
    switch (`${activePlugin.pluginId}:${activeTab.id}`) {
      case "curseforge-installer:modpacks":
        return <CurseForgeTab serverId={serverId} pluginConfig={activePlugin.config} />;
      case "modrinth-installer:modrinth":
        return <ModrinthTab serverId={serverId} />;
      case "steam-workshop:workshop":
        return <SteamWorkshopTab serverId={serverId} />;
      case "server-announcer:announcements":
        return <AnnouncerTab serverId={serverId} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BsPuzzle className="mb-4 h-12 w-12 text-zinc-700" />
            <h3 className="mb-2 text-sm font-medium text-zinc-400">{activeTab.label}</h3>
            <p className="text-xs text-zinc-600">This extension tab is coming soon.</p>
          </div>
        );
    }
  };

  return (
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-card px-4 pb-4">
        {/* Header */}
        <FadeIn delay={0}>
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-lg font-semibold text-zinc-100">Extensions</h1>
                <p className="text-xs text-zinc-500">Extensions and integrations for this server</p>
              </div>
            </div>
          </div>
        </FadeIn>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="h-6 w-6 text-zinc-400" />
          </div>
        ) : tabPlugins.length === 0 ? (
          <FadeIn delay={0.05}>
            <div className="flex h-full flex-col rounded-lg border border-white/5 bg-muted p-1 pt-2">
              <div className="shrink-0 pb-2 pl-2 text-xs opacity-50">Extensions</div>
              <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-200/10 bg-gradient-to-b from-card via-secondary to-background py-20 shadow-lg shadow-black/20">
                <BsPuzzle className="mb-4 h-12 w-12 text-zinc-700" />
                <h3 className="mb-2 text-sm font-medium text-zinc-400">No Extensions Available</h3>
                <p className="max-w-sm text-center text-xs text-zinc-600">
                  No extensions are enabled for this server type. Ask your administrator to enable
                  extensions in the admin panel.
                </p>
              </div>
            </div>
          </FadeIn>
        ) : (
          <div className="space-y-4">
            {/* Plugin Tab Bar */}
            <FadeIn delay={0.05}>
              <div className="flex flex-wrap gap-2 rounded-lg border border-white/5 bg-muted p-2">
                {tabPlugins.map((plugin) =>
                  (plugin.uiMetadata?.serverTabs || []).map((tab) => {
                    const tabId = `${plugin.pluginId}:${tab.id}`;
                    const isActive = activeTabId === tabId;
                    return (
                      <TextureButton
                        key={tabId}
                        variant={isActive ? "primary" : "minimal"}
                        size="sm"
                        onClick={() => setActiveTabId(tabId)}
                        className="flex items-center gap-2"
                      >
                        {PLUGIN_ICONS[plugin.icon || ""] || <BsPuzzle className="h-3.5 w-3.5" />}
                        <span className="text-xs">{tab.label}</span>
                      </TextureButton>
                    );
                  })
                )}
              </div>
            </FadeIn>

            {/* Active Tab Content */}
            <FadeIn delay={0.1}>
              <div className="flex h-full flex-col rounded-lg border border-white/5 bg-muted p-1 pt-2">
                <div className="shrink-0 pb-2 pl-2 text-xs opacity-50">
                  {activeTab?.label || "Extension"}
                </div>
                <div className="rounded-lg border border-zinc-200/10 bg-gradient-to-b from-card via-secondary to-background shadow-lg shadow-black/20">
                  {renderActiveTab()}
                </div>
              </div>
            </FadeIn>
          </div>
        )}
      </div>
    </FadeIn>
  );
};

export default ServerPluginsPage;
