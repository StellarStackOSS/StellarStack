"use client";

import {type JSX, useEffect, useState} from "react";
import {useParams} from "next/navigation";
import {useTheme as useNextTheme} from "next-themes";
import {cn} from "@workspace/ui/lib/utils";
import {Button} from "@workspace/ui/components/button";
import {Input} from "@workspace/ui/components/input";
import {ConfirmationModal} from "@workspace/ui/components/confirmation-modal";
import {FormModal} from "@workspace/ui/components/form-modal";
import {BsGlobe, BsPencil, BsPlus, BsTrash,} from "react-icons/bs";
import {TbWand} from "react-icons/tb";
import {useServer} from "components/ServerStatusPages/server-provider";
import {ServerInstallingPlaceholder} from "components/ServerStatusPages/server-installing-placeholder";
import {ServerSuspendedPlaceholder} from "components/ServerStatusPages/server-suspended-placeholder";
import {PageHeader, EmptyState, CardWithCorners, StatusBadge, FormFieldLabel} from "components/ServerPageComponents";
import {WebhookEventSelector} from "./WebhookEventSelector";
import {WebhookUrlField} from "./WebhookUrlField";
import {type Webhook, type WebhookEvent, webhooks} from "@/lib/api";
import {toast} from "sonner";

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
    <div className="relative min-h-svh transition-colors">
      {/* Background is now rendered in the layout for persistence */}

      <div className="relative p-8">
        <div className="mx-auto max-w-6xl">
          <PageHeader
            title="WEBHOOKS"
            subtitle={`Server ${serverId} • ${webhookList.length} webhooks`}
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={openAddModal}
                className={cn(
                  "gap-2 transition-all",
                  "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-100"
                )}
              >
                <BsPlus className="h-4 w-4" />
                <span className="text-xs tracking-wider uppercase">Add Webhook</span>
              </Button>
            }
          />

          {/* Loading State */}
          {loading ? (
            <div className={cn("py-12 text-center", "text-zinc-500")}>
              Loading webhooks...
            </div>
          ) : webhookList.length === 0 ? (
            <EmptyState
              icon={<BsGlobe className="h-12 w-12" />}
              title="No Webhooks"
              description="Add a webhook to receive notifications about server events."
              action={{ label: "Add Webhook", onClick: openAddModal }}
              isDark={isDark}
            />
          ) : (
            /* Webhooks List */
            <div className="space-y-4">
              {webhookList.map((webhook) => (
                <CardWithCorners key={webhook.id} isDark={isDark}>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center border",
                            "border-zinc-700 bg-zinc-800/50"
                          )}
                        >
                          <BsGlobe
                            className={cn("h-4 w-4", "text-zinc-400")}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "max-w-[400px] truncate font-mono text-xs",
                              "text-zinc-400"
                            )}
                          >
                            {webhook.url}
                          </span>
                          <StatusBadge
                            label={webhook.enabled ? "Active" : "Disabled"}
                            color={webhook.enabled ? "green" : "zinc"}
                            isDark={isDark}
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {webhook.events.map((event) => (
                          <StatusBadge
                            key={event}
                            label={event.replace(/_/g, " ")}
                            isDark={isDark}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(webhook)}
                        className={cn(
                          "p-2 transition-all",
                          "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-100"
                        )}
                      >
                        <BsPencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestWebhook(webhook)}
                        className={cn(
                          "p-2 transition-all",
                          "border-blue-900/60 text-blue-400/80 hover:border-blue-700 hover:text-blue-300"
                        )}
                        title="Send test message to webhook"
                      >
                        <TbWand className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteModal(webhook)}
                        className={cn(
                          "p-2 transition-all",
                          "border-red-900/60 text-red-400/80 hover:border-red-700 hover:text-red-300"
                        )}
                      >
                        <BsTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardWithCorners>
              ))}
            </div>
          )}
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
          <WebhookUrlField value={formUrl} onChange={setFormUrl} isDark={isDark} />
          <div>
            <FormFieldLabel label="Events" isDark={isDark} />
            <WebhookEventSelector
              events={webhookEvents}
              selectedEvents={formEvents}
              onToggle={toggleEvent}
              isDark={isDark}
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
          <WebhookUrlField value={formUrl} onChange={setFormUrl} isDark={isDark} />
          <div>
            <FormFieldLabel label="Status" isDark={isDark} />
            <button
              type="button"
              onClick={() => setFormEnabled(!formEnabled)}
              className={cn(
                "flex w-full items-center gap-3 border p-3 transition-all",
                formEnabled
                  ? "border-green-700/50 bg-green-900/20"
                  : "border-zinc-700"
              )}
            >
              <div
                className={cn(
                  "relative h-5 w-10 rounded-full transition-colors",
                  formEnabled
                    ? "bg-green-600"
                    : "bg-zinc-700"
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
            </button>
          </div>
          <div>
            <FormFieldLabel label="Events" isDark={isDark} />
            <WebhookEventSelector
              events={webhookEvents}
              selectedEvents={formEvents}
              onToggle={toggleEvent}
              isDark={isDark}
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
        variant="danger"
      />
    </div>
  );
};

export default WebhooksPage;
