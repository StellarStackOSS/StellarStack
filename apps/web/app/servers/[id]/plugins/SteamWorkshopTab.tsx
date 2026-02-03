"use client";

import React, { useState, useCallback } from "react";
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
  BsHeart,
  BsStar,
  BsController,
} from "react-icons/bs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pluginsApi } from "@/lib/api";
import { toast } from "sonner";

interface SteamWorkshopTabProps {
  serverId: string;
}

interface WorkshopItem {
  publishedfileid: string;
  title: string;
  description: string;
  preview_url: string;
  subscriptions: number;
  favorited: number;
  time_updated: number;
  file_size: number;
  tags: Array<{ tag: string }>;
  creator?: string;
}

export function SteamWorkshopTab({ serverId }: SteamWorkshopTabProps) {
  const [workshopUrl, setWorkshopUrl] = useState("");
  const [workshopIds, setWorkshopIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Get installed workshop items from plugin storage
  const { data: installedItems, isLoading } = useQuery({
    queryKey: ["plugins", "steam-workshop", "installed", serverId],
    queryFn: async () => {
      try {
        const res = await pluginsApi.get("steam-workshop");
        if (res.status !== "enabled") return [];
        // Fetch from plugin storage
        const storageRes = await fetch(
          `/api/plugins/steam-workshop/storage/installed-items?serverId=${serverId}`,
          { credentials: "include" }
        );
        if (!storageRes.ok) return [];
        const data = await storageRes.json();
        return (data.value as WorkshopItem[]) || [];
      } catch {
        return [];
      }
    },
  });

  // Add workshop item mutation
  const addItemMutation = useMutation({
    mutationFn: async (workshopId: string) => {
      // Store the workshop ID in plugin storage
      const currentItems = installedItems || [];
      const newItem: WorkshopItem = {
        publishedfileid: workshopId,
        title: `Workshop Item #${workshopId}`,
        description: "Loading details...",
        preview_url: "",
        subscriptions: 0,
        favorited: 0,
        time_updated: Date.now() / 1000,
        file_size: 0,
        tags: [],
      };
      const updatedItems = [...currentItems, newItem];

      await fetch(`/api/plugins/steam-workshop/storage/installed-items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: updatedItems, serverId }),
      });

      return workshopId;
    },
    onSuccess: (workshopId) => {
      toast.success(`Workshop item ${workshopId} added`);
      queryClient.invalidateQueries({ queryKey: ["plugins", "steam-workshop", "installed"] });
      setWorkshopUrl("");
    },
    onError: (err: Error) => {
      toast.error(`Failed to add item: ${err.message}`);
    },
  });

  // Remove workshop item mutation
  const removeItemMutation = useMutation({
    mutationFn: async (workshopId: string) => {
      const currentItems = installedItems || [];
      const updatedItems = currentItems.filter((item) => item.publishedfileid !== workshopId);

      await fetch(`/api/plugins/steam-workshop/storage/installed-items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: updatedItems, serverId }),
      });

      return workshopId;
    },
    onSuccess: (workshopId) => {
      toast.success(`Workshop item ${workshopId} removed`);
      queryClient.invalidateQueries({ queryKey: ["plugins", "steam-workshop", "installed"] });
    },
    onError: (err: Error) => {
      toast.error(`Failed to remove item: ${err.message}`);
    },
  });

  const extractWorkshopId = useCallback((input: string): string | null => {
    // Accept raw ID or Steam Workshop URL
    const idMatch = input.match(/^(\d+)$/);
    if (idMatch?.[1]) return idMatch[1];

    const urlMatch = input.match(/id=(\d+)/);
    if (urlMatch?.[1]) return urlMatch[1];

    return null;
  }, []);

  const handleAddItem = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const workshopId = extractWorkshopId(workshopUrl);
      if (!workshopId) {
        toast.error("Invalid Workshop URL or ID. Enter a Steam Workshop URL or numeric ID.");
        return;
      }
      if ((installedItems || []).some((i) => i.publishedfileid === workshopId)) {
        toast.error("This item is already added.");
        return;
      }
      addItemMutation.mutate(workshopId);
    },
    [workshopUrl, extractWorkshopId, installedItems, addItemMutation]
  );

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "Unknown";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const items = installedItems || [];

  return (
    <div className="space-y-6">
      {/* Add Workshop Item */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="mb-3 text-sm font-medium text-zinc-300">Add Workshop Item</h3>
        <form onSubmit={handleAddItem} className="flex gap-3">
          <div className="relative flex-1">
            <BsController className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={workshopUrl}
              onChange={(e) => setWorkshopUrl(e.target.value)}
              placeholder="Steam Workshop URL or ID (e.g. 123456789)"
              className="border-zinc-800 bg-zinc-900/50 pl-10"
            />
          </div>
          <TextureButton
            type="submit"
            variant="primary"
            disabled={addItemMutation.isPending || !workshopUrl}
          >
            {addItemMutation.isPending ? "Adding..." : "Add Item"}
          </TextureButton>
        </form>
      </div>

      {/* Installed Items */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-zinc-300">Installed Items ({items.length})</h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="h-6 w-6" />
            <span className="ml-3 text-zinc-400">Loading workshop items...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 py-12 text-center text-zinc-500">
            <BsBox className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
            <p>No workshop items installed</p>
            <p className="mt-1 text-sm">Add Steam Workshop items using the form above</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.publishedfileid}
                className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
              >
                {item.preview_url ? (
                  <img
                    src={item.preview_url}
                    alt={item.title}
                    className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                    <BsController className="h-6 w-6 text-zinc-600" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h4 className="truncate font-medium text-zinc-200">{item.title}</h4>
                  <p className="mt-1 text-xs text-zinc-500">
                    ID: {item.publishedfileid}
                    {item.file_size > 0 && ` · ${formatSize(item.file_size)}`}
                  </p>
                  {item.tags.length > 0 && (
                    <div className="mt-1 flex gap-1">
                      {item.tags.slice(0, 3).map((t) => (
                        <Badge
                          key={t.tag}
                          variant="outline"
                          className="border-zinc-700 bg-zinc-800/50 text-xs text-zinc-400"
                        >
                          {t.tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <TextureButton
                  variant="destructive"
                  size="sm"
                  onClick={() => removeItemMutation.mutate(item.publishedfileid)}
                  disabled={removeItemMutation.isPending}
                >
                  Remove
                </TextureButton>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
        <p className="text-xs text-zinc-500">
          Workshop items will be synced with your game server on the next restart. Ensure your
          server has sufficient disk space for the subscribed items.
        </p>
      </div>
    </div>
  );
}
