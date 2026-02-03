"use client";

import { type JSX, useState } from "react";
import { useParams } from "next/navigation";
import { cn } from "@stellarUI/lib/utils";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Input from "@stellarUI/components/Input/Input";
import { SidebarTrigger } from "@stellarUI/components/Sidebar/Sidebar";
import ConfirmationModal from "@stellarUI/components/ConfirmationModal/ConfirmationModal";
import FormModal from "@stellarUI/components/FormModal/FormModal";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import {
  BsClipboard,
  BsDatabase,
  BsExclamationTriangle,
  BsEye,
  BsEyeSlash,
  BsPlus,
  BsTrash,
} from "react-icons/bs";
import { useServer } from "components/ServerStatusPages/server-provider";
import { ServerInstallingPlaceholder } from "components/ServerStatusPages/server-installing-placeholder";
import { ServerSuspendedPlaceholder } from "components/ServerStatusPages/server-suspended-placeholder";
import Label from "@stellarUI/components/Label/Label";

interface Database {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  size: string;
  connections: number;
  maxConnections: number;
}

const mockDatabases: Database[] = [
  {
    id: "db-1",
    name: "minecraft_data",
    host: "localhost",
    port: 3306,
    username: "mc_user",
    password: "••••••••",
    size: "256 MB",
    connections: 5,
    maxConnections: 50,
  },
  {
    id: "db-2",
    name: "player_stats",
    host: "localhost",
    port: 3306,
    username: "stats_user",
    password: "••••••••",
    size: "128 MB",
    connections: 2,
    maxConnections: 25,
  },
];

const generatePassword = () => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

const DatabasesPage = (): JSX.Element | null => {
  const params = useParams();
  const serverId = params.id as string;
  const { server, isInstalling } = useServer();
  const [databases, setDatabases] = useState<Database[]>(mockDatabases);
  const [visiblePasswords, setVisiblePasswords] = useState<string[]>([]);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedDb, setSelectedDb] = useState<Database | null>(null);

  // Form states
  const [formName, setFormName] = useState("");

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

  const openCreateModal = () => {
    setFormName("");
    setCreateModalOpen(true);
  };

  const openDeleteModal = (db: Database) => {
    setSelectedDb(db);
    setDeleteModalOpen(true);
  };

  const handleCreate = () => {
    const newDb: Database = {
      id: `db-${Date.now()}`,
      name: formName.toLowerCase().replace(/\s+/g, "_"),
      host: "localhost",
      port: 3306,
      username: `${formName.toLowerCase().replace(/\s+/g, "_")}_user`,
      password: generatePassword(),
      size: "0 MB",
      connections: 0,
      maxConnections: 25,
    };
    setDatabases((prev) => [...prev, newDb]);
    setCreateModalOpen(false);
    setFormName("");
  };

  const handleDelete = () => {
    if (!selectedDb) return;
    setDatabases((prev) => prev.filter((d) => d.id !== selectedDb.id));
    setDeleteModalOpen(false);
    setSelectedDb(null);
  };

  const togglePassword = (id: string) => {
    setVisiblePasswords((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const isNameValid = formName.trim().length >= 3;

  return (
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-black px-4 pb-4">
          {/* Header */}
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-between">
              <SidebarTrigger className="text-zinc-400 transition-all hover:scale-110 hover:text-zinc-100 active:scale-95" />
              <div className="flex items-center gap-2">
                <TextureButton
                  variant="primary"
                  size="sm"
                  className="w-fit"
                  onClick={openCreateModal}
                >
                  <BsPlus className="h-4 w-4" />
                  New Database
                </TextureButton>
              </div>
            </div>
          </FadeIn>

          {/* Development Notice */}
          <FadeIn delay={0.05}>
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-700/30 bg-amber-950/20 p-4 text-amber-200/80">
              <BsExclamationTriangle className="h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Under Development</p>
                <p className="mt-0.5 text-xs text-amber-200/60">
                  Database management is not yet connected to the API. The data shown below is for
                  demonstration purposes only.
                </p>
              </div>
            </div>
          </FadeIn>

          {/* Databases Card */}
          <FadeIn delay={0.1}>
            <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
              <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
                <div className="flex items-center gap-2 text-xs opacity-50">
                  <BsDatabase className="h-3 w-3" />
                  Databases
                </div>
                <span className="text-xs text-zinc-500">
                  {databases.length} database{databases.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20">
                {databases.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <BsDatabase className="mb-4 h-12 w-12 text-zinc-600" />
                    <h3 className="mb-2 text-sm font-medium text-zinc-300">No Databases</h3>
                    <p className="mb-4 text-xs text-zinc-500">
                      Create your first database to get started.
                    </p>
                    <TextureButton
                      variant="minimal"
                      size="sm"
                      className="w-fit"
                      onClick={openCreateModal}
                    >
                      <BsPlus className="h-4 w-4" />
                      New Database
                    </TextureButton>
                  </div>
                ) : (
                  databases.map((db, index) => (
                    <div
                      key={db.id}
                      className={cn(
                        "p-4 transition-colors hover:bg-zinc-800/20",
                        index !== databases.length - 1 && "border-b border-zinc-800/50"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-3 flex items-center gap-3">
                            <span className="text-sm font-medium text-zinc-100">{db.name}</span>
                            <span className="rounded border border-green-500/50 px-2 py-0.5 text-[10px] font-medium text-green-400 uppercase">
                              {db.connections}/{db.maxConnections} connections
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <div>
                              <Label className="text-[10px] text-zinc-500 uppercase">Host</Label>
                              <div className="mt-1 font-mono text-sm text-zinc-300">
                                {db.host}:{db.port}
                              </div>
                            </div>
                            <div>
                              <Label className="text-[10px] text-zinc-500 uppercase">Size</Label>
                              <div className="mt-1 text-sm text-zinc-300">{db.size}</div>
                            </div>
                            <div>
                              <Label className="text-[10px] text-zinc-500 uppercase">
                                Username
                              </Label>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="font-mono text-sm text-zinc-300">
                                  {db.username}
                                </span>
                                <TextureButton
                                  variant="minimal"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => copyToClipboard(db.username)}
                                >
                                  <BsClipboard className="h-3 w-3" />
                                </TextureButton>
                              </div>
                            </div>
                            <div>
                              <Label className="text-[10px] text-zinc-500 uppercase">
                                Password
                              </Label>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="font-mono text-sm text-zinc-300">
                                  {visiblePasswords.includes(db.id) ? db.password : "••••••••"}
                                </span>
                                <TextureButton
                                  variant="minimal"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => togglePassword(db.id)}
                                >
                                  {visiblePasswords.includes(db.id) ? (
                                    <BsEyeSlash className="h-3 w-3" />
                                  ) : (
                                    <BsEye className="h-3 w-3" />
                                  )}
                                </TextureButton>
                                <TextureButton
                                  variant="minimal"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => copyToClipboard(db.password)}
                                >
                                  <BsClipboard className="h-3 w-3" />
                                </TextureButton>
                              </div>
                            </div>
                          </div>
                        </div>
                        <TextureButton
                          variant="secondary"
                          size="sm"
                          className="w-fit"
                          onClick={() => openDeleteModal(db)}
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

      {/* Create Database Modal */}
      <FormModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        title="Create Database"
        description="Create a new MySQL database for your server."
        onSubmit={handleCreate}
        submitLabel="Create Database"
        isValid={isNameValid}
      >
        <div className="space-y-4">
          <div>
            <Label className={cn("mb-2 block text-xs tracking-wider uppercase", "text-zinc-400")}>
              Database Name
            </Label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., player_data"
              className={cn(
                "transition-all",
                "border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600"
              )}
            />
            <p className={cn("mt-1 text-xs", "text-zinc-500")}>
              Minimum 3 characters. Username and password will be auto-generated.
            </p>
          </div>
        </div>
      </FormModal>

      {/* Delete Database Modal */}
      <ConfirmationModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Delete Database"
        description={`Are you sure you want to delete "${selectedDb?.name}"? All data in this database will be permanently lost.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
      />
    </FadeIn>
  );
};

export default DatabasesPage;
