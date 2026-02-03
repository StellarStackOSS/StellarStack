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
  BsMegaphone,
  BsPlus,
  BsClock,
  BsTrash,
  BsPencil,
  BsToggleOn,
  BsToggleOff,
} from "react-icons/bs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pluginsApi } from "@/lib/api";
import { toast } from "sonner";

interface AnnouncerTabProps {
  serverId: string;
}

interface Announcement {
  id: string;
  message: string;
  intervalMinutes: number;
  enabled: boolean;
  lastSentAt: string | null;
  createdAt: string;
}

export function AnnouncerTab({ serverId }: AnnouncerTabProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [formMessage, setFormMessage] = useState("");
  const [formInterval, setFormInterval] = useState("30");
  const queryClient = useQueryClient();

  // Get announcements from plugin storage
  const { data: announcements, isLoading } = useQuery({
    queryKey: ["plugins", "server-announcer", "announcements", serverId],
    queryFn: async () => {
      try {
        const res = await pluginsApi.get("server-announcer");
        if (res.status !== "enabled") return [];
        const storageRes = await fetch(
          `/api/plugins/server-announcer/storage/announcements?serverId=${serverId}`,
          { credentials: "include" }
        );
        if (!storageRes.ok) return [];
        const data = await storageRes.json();
        return (data.value as Announcement[]) || [];
      } catch {
        return [];
      }
    },
  });

  const saveAnnouncements = useCallback(
    async (items: Announcement[]) => {
      await fetch(`/api/plugins/server-announcer/storage/announcements`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: items, serverId }),
      });
    },
    [serverId]
  );

  // Create announcement
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!formMessage.trim()) throw new Error("Message is required");
      const interval = parseInt(formInterval, 10);
      if (isNaN(interval) || interval < 1) throw new Error("Interval must be at least 1 minute");

      const newAnnouncement: Announcement = {
        id: crypto.randomUUID(),
        message: formMessage.trim(),
        intervalMinutes: interval,
        enabled: true,
        lastSentAt: null,
        createdAt: new Date().toISOString(),
      };

      const current = announcements || [];
      await saveAnnouncements([...current, newAnnouncement]);
      return newAnnouncement;
    },
    onSuccess: () => {
      toast.success("Announcement created");
      queryClient.invalidateQueries({ queryKey: ["plugins", "server-announcer", "announcements"] });
      setIsCreateOpen(false);
      setFormMessage("");
      setFormInterval("30");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Update announcement
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingAnnouncement) throw new Error("No announcement selected");
      if (!formMessage.trim()) throw new Error("Message is required");
      const interval = parseInt(formInterval, 10);
      if (isNaN(interval) || interval < 1) throw new Error("Interval must be at least 1 minute");

      const current = announcements || [];
      const updated = current.map((a) =>
        a.id === editingAnnouncement.id
          ? { ...a, message: formMessage.trim(), intervalMinutes: interval }
          : a
      );
      await saveAnnouncements(updated);
    },
    onSuccess: () => {
      toast.success("Announcement updated");
      queryClient.invalidateQueries({ queryKey: ["plugins", "server-announcer", "announcements"] });
      setEditingAnnouncement(null);
      setFormMessage("");
      setFormInterval("30");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Toggle announcement
  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const current = announcements || [];
      const updated = current.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a));
      await saveAnnouncements(updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugins", "server-announcer", "announcements"] });
    },
    onError: (err: Error) => {
      toast.error(`Failed to toggle: ${err.message}`);
    },
  });

  // Delete announcement
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const current = announcements || [];
      const updated = current.filter((a) => a.id !== id);
      await saveAnnouncements(updated);
    },
    onSuccess: () => {
      toast.success("Announcement deleted");
      queryClient.invalidateQueries({ queryKey: ["plugins", "server-announcer", "announcements"] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete: ${err.message}`);
    },
  });

  const openCreate = useCallback(() => {
    setFormMessage("");
    setFormInterval("30");
    setIsCreateOpen(true);
  }, []);

  const openEdit = useCallback((announcement: Announcement) => {
    setFormMessage(announcement.message);
    setFormInterval(String(announcement.intervalMinutes));
    setEditingAnnouncement(announcement);
  }, []);

  const items = announcements || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-zinc-300">Scheduled Announcements</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Automatically send messages to your game server at regular intervals
          </p>
        </div>
        <TextureButton variant="primary" onClick={openCreate}>
          <BsPlus className="mr-1 h-4 w-4" />
          New Announcement
        </TextureButton>
      </div>

      {/* Announcements List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-6 w-6" />
          <span className="ml-3 text-zinc-400">Loading announcements...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 py-12 text-center text-zinc-500">
          <BsMegaphone className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
          <p>No announcements configured</p>
          <p className="mt-1 text-sm">
            Create an announcement to automatically send messages to your server
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((announcement) => (
            <div
              key={announcement.id}
              className={`rounded-lg border bg-zinc-900/50 p-4 transition-colors ${
                announcement.enabled ? "border-zinc-800" : "border-zinc-800/50 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-200">{announcement.message}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <BsClock className="h-3 w-3" />
                      Every {announcement.intervalMinutes} min
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        announcement.enabled
                          ? "border-emerald-800 bg-emerald-900/30 text-emerald-400"
                          : "border-zinc-700 bg-zinc-800/50 text-zinc-500"
                      }`}
                    >
                      {announcement.enabled ? "Active" : "Paused"}
                    </Badge>
                    {announcement.lastSentAt && (
                      <span className="text-zinc-600">
                        Last sent: {new Date(announcement.lastSentAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    onClick={() => toggleMutation.mutate(announcement.id)}
                    className="p-1 text-zinc-400 transition-colors hover:text-zinc-200"
                    title={announcement.enabled ? "Pause" : "Enable"}
                  >
                    {announcement.enabled ? (
                      <BsToggleOn className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <BsToggleOff className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    onClick={() => openEdit(announcement)}
                    className="p-1 text-zinc-400 transition-colors hover:text-zinc-200"
                    title="Edit"
                  >
                    <BsPencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(announcement)}
                    className="p-1 text-zinc-400 transition-colors hover:text-red-400"
                    title="Delete"
                  >
                    <BsTrash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateOpen || !!editingAnnouncement}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingAnnouncement(null);
          }
        }}
      >
        <DialogContent className="max-w-lg border-zinc-800 bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              {editingAnnouncement ? "Edit Announcement" : "New Announcement"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Configure a message to be sent at regular intervals
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Message</label>
              <Input
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                placeholder="e.g. Server will restart in 5 minutes!"
                className="border-zinc-800 bg-zinc-900/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Interval (minutes)</label>
              <Input
                type="number"
                min="1"
                max="1440"
                value={formInterval}
                onChange={(e) => setFormInterval(e.target.value)}
                placeholder="30"
                className="border-zinc-800 bg-zinc-900/50"
              />
              <p className="mt-1 text-xs text-zinc-500">
                How often to send this message (1-1440 minutes)
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <TextureButton
                variant="secondary"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingAnnouncement(null);
                }}
              >
                Cancel
              </TextureButton>
              <TextureButton
                variant="primary"
                onClick={() =>
                  editingAnnouncement ? updateMutation.mutate() : createMutation.mutate()
                }
                disabled={
                  createMutation.isPending || updateMutation.isPending || !formMessage.trim()
                }
              >
                {editingAnnouncement ? "Save Changes" : "Create"}
              </TextureButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmationModal
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Announcement"
        description={`Are you sure you want to delete this announcement? "${deleteTarget?.message}"`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
