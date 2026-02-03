"use client";

import { type JSX, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { cn } from "@stellarUI/lib/utils";
import { TextureButton } from "@stellarUI/components/TextureButton";
import ConfirmationModal from "@stellarUI/components/ConfirmationModal/ConfirmationModal";
import FormModal from "@stellarUI/components/FormModal/FormModal";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import { BsGlobe, BsPencil, BsPlus, BsTrash } from "react-icons/bs";
import { TbWand } from "react-icons/tb";
import { useServer } from "components/ServerStatusPages/server-provider";
import { ServerInstallingPlaceholder } from "components/ServerStatusPages/server-installing-placeholder";
import { ServerSuspendedPlaceholder } from "components/ServerStatusPages/server-suspended-placeholder";
import { WebhookEventSelector } from "./WebhookEventSelector";
import { WebhookUrlField } from "./WebhookUrlField";
import { type Webhook, type WebhookEvent, webhooks } from "@/lib/api";
import { toast } from "sonner";
import Label from "@stellarUI/components/Label/Label";
import { SidebarTrigger } from "@stellarUI/components";

const webhookEvents: { value: WebhookEvent; label: string; description: string }[] = [
  { value: "server.started", label: "Server Started", description: "When the server starts" },
  { value: "server.stopped", label: "Server Stopped", description: "When the server stops" },
  { value: "backup.created", label: "Backup Created", description: "When a backup is created" },
  { value: "backup.restored", label: "Backup Restored", description: "When a backup is restored" },
  { value: "backup.deleted", label: "Backup Deleted", description: "When a backup is deleted" },
];

const WebhooksPage = (): JSX.Element | null => {
  const params = useParams();
  const serverId = params.id as string;
  const { server, isInstalling } = useServer();
  const [webhookList, setWebhookList] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);

  // Form states
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<WebhookEvent[]>([]);
  const [formEnabled, setFormEnabled] = useState(true);

  useEffect(() => {
    if (serverId) {
      fetchWebhooks();
    }
  }, [serverId]);

  const fetchWebhooks = async () => {
    try {
      setLoading(true);
      const data = await webhooks.list();
      // Filter to show only webhooks for this server
      setWebhookList(data.filter((w) => w.serverId === serverId));
    } catch (error) {
      console.error("Failed to fetch webhooks:", error);
      toast.error("Failed to load webhooks");
    } finally {
      setLoading(false);
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

  const resetForm = () => {
    setFormUrl("");
    setFormEvents([]);
    setFormEnabled(true);
  };

  const openAddModal = () => {
    resetForm();
    setAddModalOpen(true);
  };

  const openEditModal = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setFormUrl(webhook.url);
    setFormEvents(webhook.events as WebhookEvent[]);
    setFormEnabled(webhook.enabled);
    setEditModalOpen(true);
  };

  const openDeleteModal = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setDeleteModalOpen(true);
  };

  const handleAdd = async () => {
    if (formEvents.length === 0) return;
    try {
      const newWebhook = await webhooks.create({
        serverId,
        url: formUrl,
        events: formEvents,
      });
      setWebhookList((prev) => [...prev, newWebhook]);
      setAddModalOpen(false);
      resetForm();
      toast.success("Webhook created");

      try {
        await webhooks.test(newWebhook.id);
        toast.success("Test message sent to webhook");
      } catch (error) {
        toast.info("Webhook created, but test message failed to send");
      }
    } catch (error) {
      toast.error("Failed to create webhook");
    }
  };

  const handleEdit = async () => {
    if (!selectedWebhook || formEvents.length === 0) return;
    try {
      const updated = await webhooks.update(selectedWebhook.id, {
        url: formUrl,
        events: formEvents,
        enabled: formEnabled,
      });
      setWebhookList((prev) => prev.map((w) => (w.id === selectedWebhook.id ? updated : w)));
      setEditModalOpen(false);
      setSelectedWebhook(null);
      toast.success("Webhook updated");
    } catch (error) {
      toast.error("Failed to update webhook");
    }
  };

  const handleDelete = async () => {
    if (!selectedWebhook) return;
    try {
      await webhooks.delete(selectedWebhook.id);
      setWebhookList((prev) => prev.filter((w) => w.id !== selectedWebhook.id));
      setDeleteModalOpen(false);
      setSelectedWebhook(null);
      toast.success("Webhook deleted");
    } catch (error) {
      toast.error("Failed to delete webhook");
    }
  };

  const handleTestWebhook = async (webhook: Webhook) => {
    try {
      await webhooks.test(webhook.id);
      toast.success("Test message sent successfully");
    } catch (error) {
      toast.error("Failed to send test message");
    }
  };

  const handleRegenerateSecret = async (webhook: Webhook) => {
    try {
      await webhooks.delete(webhook.id);
      setWebhookList((prev) => prev.filter((w) => w.id !== webhook.id));
      toast.success("Webhook deleted");
    } catch (error) {
      toast.error("Failed to delete webhook");
    }
  };

  const toggleEvent = (event: WebhookEvent) => {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const isFormValid = formUrl.startsWith("http") && formEvents.length > 0;

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
                <TextureButton variant="primary" size="sm" className="w-fit" onClick={openAddModal}>
                  <BsPlus className="h-4 w-4" />
                  Add Webhook
                </TextureButton>
              </div>
            </div>
          </FadeIn>

          {/* Webhooks Card */}
          <FadeIn delay={0.05}>
            <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
              <div className="shrink-0 pb-2 pl-2 text-xs opacity-50">
                Webhooks {webhookList.length > 0 && `(${webhookList.length})`}
              </div>
              <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner />
                  </div>
                ) : webhookList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <BsGlobe className="mb-4 h-12 w-12 text-zinc-600" />
                    <h3 className="mb-2 text-sm font-medium text-zinc-300">No Webhooks</h3>
                    <p className="mb-4 text-xs text-zinc-500">
                      Add a webhook to receive notifications about server events.
                    </p>
                    <TextureButton
                      variant="minimal"
                      size="sm"
                      className="w-fit"
                      onClick={openAddModal}
                    >
                      <BsPlus className="h-4 w-4" />
                      Add Webhook
                    </TextureButton>
                  </div>
                ) : (
                  webhookList.map((webhook, index) => (
                    <div
                      key={webhook.id}
                      className={cn(
                        "flex items-center justify-between p-4 transition-colors hover:bg-zinc-800/20",
                        index !== webhookList.length - 1 && "border-b border-zinc-800/50"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800/50">
                          <BsGlobe className="h-5 w-5 text-zinc-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="max-w-[400px] truncate font-mono text-sm text-zinc-200">
                              {webhook.url}
                            </span>
                            <span
                              className={cn(
                                "rounded border px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase",
                                webhook.enabled
                                  ? "border-green-700/50 text-green-400"
                                  : "border-zinc-700 text-zinc-500"
                              )}
                            >
                              {webhook.enabled ? "Active" : "Disabled"}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {webhook.events.map((event) => (
                              <span
                                key={event}
                                className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500"
                              >
                                {event.replace(/[._]/g, " ")}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TextureButton
                          variant="minimal"
                          size="sm"
                          className="w-fit"
                          onClick={() => openEditModal(webhook)}
                        >
                          <BsPencil className="h-4 w-4" />
                        </TextureButton>
                        <TextureButton
                          variant="minimal"
                          size="sm"
                          className="w-fit"
                          onClick={() => handleTestWebhook(webhook)}
                          title="Send test message to webhook"
                        >
                          <TbWand className="h-4 w-4" />
                        </TextureButton>
                        <TextureButton
                          variant="destructive"
                          size="sm"
                          className="w-fit"
                          onClick={() => openDeleteModal(webhook)}
                        >
                          <BsTrash className="h-4 w-4" />
                        </TextureButton>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Add Webhook Modal */}
      <FormModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        title="Add Webhook"
        description="Create a new webhook to receive server event notifications."
        onSubmit={handleAdd}
        submitLabel="Create Webhook"
        isValid={isFormValid}
      >
        <div className="space-y-4">
          <WebhookUrlField value={formUrl} onChange={setFormUrl} />
          <div>
            <Label>Events</Label>
            <WebhookEventSelector
              events={webhookEvents}
              selectedEvents={formEvents}
              onToggle={toggleEvent}
            />
          </div>
        </div>
      </FormModal>

      {/* Edit Webhook Modal */}
      <FormModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        title="Edit Webhook"
        description="Update webhook settings."
        onSubmit={handleEdit}
        submitLabel="Save Changes"
        isValid={isFormValid}
      >
        <div className="space-y-4">
          <WebhookUrlField value={formUrl} onChange={setFormUrl} />
          <div>
            <Label>Status</Label>
            <TextureButton onClick={() => setFormEnabled(!formEnabled)}>
              <div
                className={cn(
                  "relative h-5 w-10 rounded-full transition-colors",
                  formEnabled ? "bg-green-600" : "bg-zinc-700"
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                    formEnabled ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </div>
              <span className={cn("text-sm", "text-zinc-300")}>
                {formEnabled ? "Enabled" : "Disabled"}
              </span>
            </TextureButton>
          </div>
          <div>
            <Label>Events</Label>
            <WebhookEventSelector
              events={webhookEvents}
              selectedEvents={formEvents}
              onToggle={toggleEvent}
            />
          </div>
        </div>
      </FormModal>

      {/* Delete Webhook Modal */}
      <ConfirmationModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Delete Webhook"
        description="Are you sure you want to delete this webhook? This action cannot be undone."
        onConfirm={handleDelete}
        confirmLabel="Delete"
      />
    </FadeIn>
  );
};

export default WebhooksPage;
