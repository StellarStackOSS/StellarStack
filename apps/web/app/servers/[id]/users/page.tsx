"use client";

import { type JSX, useCallback, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { cn } from "@stellarUI/lib/Utils";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Input from "@stellarUI/components/Input/Input";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import ConfirmationModal from "@stellarUI/components/ConfirmationModal/ConfirmationModal";
import FormModal from "@stellarUI/components/FormModal/FormModal";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import {
  BsClock,
  BsEnvelope,
  BsPencil,
  BsPeopleFill,
  BsPersonFill,
  BsPlus,
  BsShieldFill,
  BsTrash,
} from "react-icons/bs";
import { toast } from "sonner";
import { useServer } from "components/ServerStatusPages/ServerProvider/ServerProvider";
import { useAuth } from "@/hooks/AuthProvider/AuthProvider";
import { ServerInstallingPlaceholder } from "components/ServerStatusPages/ServerInstallingPlaceholder/ServerInstallingPlaceholder";
import { ServerSuspendedPlaceholder } from "components/ServerStatusPages/ServerSuspendedPlaceholder/ServerSuspendedPlaceholder";
import {
  usePermissionDefinitions,
  useServerInvitations,
  useServerMemberMutations,
  useServerMembers,
} from "@/hooks/queries/UseServerMembers";
import type { PermissionCategory, ServerInvitation, ServerMember } from "@/lib/Api";
import Label from "@stellarUI/components/Label/Label";
import Checkbox from "@stellarUI/components/Checkbox/Checkbox";

const UsersPage = (): JSX.Element | null => {
  const params = useParams();
  const serverId = params.id as string;
  const { server, isInstalling } = useServer();
  const { user: currentUser } = useAuth();

  // Data fetching
  const { data: members = [], isLoading: membersLoading } = useServerMembers(serverId);
  const { data: invitations = [], isLoading: invitationsLoading } = useServerInvitations(serverId);
  const { data: permissionDefs } = usePermissionDefinitions();
  const { updateMember, removeMember, createInvitation, cancelInvitation } =
    useServerMemberMutations(serverId);

  // Modal states
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [cancelInviteModalOpen, setCancelInviteModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<ServerMember | null>(null);
  const [selectedInvitation, setSelectedInvitation] = useState<ServerInvitation | null>(null);

  // Form states
  const [formEmail, setFormEmail] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Data fetching
  const isOwner = server?.ownerId === currentUser?.id;
  const isLoading = membersLoading || invitationsLoading;

  // Get all available permissions from definitions - use ref to stabilize after first load
  const permissionDefsRef = useRef(permissionDefs);
  if (permissionDefs && !permissionDefsRef.current) {
    permissionDefsRef.current = permissionDefs;
  }
  const stablePermissionDefs = permissionDefsRef.current || permissionDefs;

  const allPermissions = useMemo(() => {
    if (!stablePermissionDefs?.categories) return [];
    return stablePermissionDefs.categories.flatMap((cat) => cat.permissions);
  }, [stablePermissionDefs]);

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

  const resetForm = () => {
    setFormEmail("");
    setSelectedPermissions([]);
  };

  const openInviteModal = () => {
    resetForm();
    setInviteModalOpen(true);
  };

  const openEditModal = (member: ServerMember) => {
    setSelectedMember(member);
    setSelectedPermissions([...member.permissions]);
    setEditModalOpen(true);
  };

  const openDeleteModal = (member: ServerMember) => {
    setSelectedMember(member);
    setDeleteModalOpen(true);
  };

  const openCancelInviteModal = (invitation: ServerInvitation) => {
    setSelectedInvitation(invitation);
    setCancelInviteModalOpen(true);
  };

  const handleInvite = async () => {
    try {
      await createInvitation.mutateAsync({
        email: formEmail,
        permissions: selectedPermissions,
      });
      toast.success("Invitation sent successfully");
      setInviteModalOpen(false);
      resetForm();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send invitation";
      toast.error(errorMessage);
    }
  };

  const handleEditPermissions = async () => {
    if (!selectedMember) return;
    try {
      await updateMember.mutateAsync({
        memberId: selectedMember.id,
        permissions: selectedPermissions,
      });
      toast.success("Permissions updated successfully");
      setEditModalOpen(false);
      setSelectedMember(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update permissions";
      toast.error(errorMessage);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) return;
    try {
      await removeMember.mutateAsync(selectedMember.id);
      toast.success("Member removed successfully");
      setDeleteModalOpen(false);
      setSelectedMember(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to remove member";
      toast.error(errorMessage);
    }
  };

  const handleCancelInvitation = async () => {
    if (!selectedInvitation) return;
    try {
      await cancelInvitation.mutateAsync(selectedInvitation.id);
      toast.success("Invitation cancelled");
      setCancelInviteModalOpen(false);
      setSelectedInvitation(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to cancel invitation";
      toast.error(errorMessage);
    }
  };

  const togglePermission = useCallback((permissionKey: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionKey)
        ? prev.filter((p) => p !== permissionKey)
        : [...prev, permissionKey]
    );
  }, []);

  const isEmailValid = formEmail.includes("@") && formEmail.includes(".");

  const getPermissionCount = (permissions: string[]) => {
    return `${permissions.length} permission${permissions.length !== 1 ? "s" : ""}`;
  };

  // Helper to check if all permissions in a category are selected
  const isCategoryFullySelected = (category: PermissionCategory) =>
    category.permissions.every((p) => selectedPermissions.includes(p.key));

  // Helper to check if some permissions in a category are selected
  const isCategoryPartiallySelected = (category: PermissionCategory) =>
    category.permissions.some((p) => selectedPermissions.includes(p.key)) &&
    !isCategoryFullySelected(category);

  // Toggle all permissions in a category
  const toggleCategory = useCallback(
    (category: PermissionCategory) => {
      const categoryKeys = category.permissions.map((p) => p.key);
      if (isCategoryFullySelected(category)) {
        // Deselect all in category
        setSelectedPermissions((prev) => prev.filter((p) => !categoryKeys.includes(p)));
      } else {
        // Select all in category
        setSelectedPermissions((prev) => [...new Set([...prev, ...categoryKeys])]);
      }
    },
    [isCategoryFullySelected]
  );

  // Toggle all permissions
  const toggleAllPermissions = useCallback(() => {
    if (selectedPermissions.length === allPermissions.length) {
      setSelectedPermissions([]);
    } else {
      setSelectedPermissions(allPermissions.map((p) => p.key));
    }
  }, [selectedPermissions.length, allPermissions]);

  const PermissionSelector = useMemo(() => {
    return ({ categories }: { categories: PermissionCategory[] }) => (
      <div className="space-y-4">
        {/* Global Select All */}
        <div className="flex items-center justify-between border-b pb-3">
          <span className={cn("text-xs font-medium tracking-wider uppercase", "text-zinc-400")}>
            {selectedPermissions.length} of {allPermissions.length} selected
          </span>
          <TextureButton variant="minimal" type="button" onClick={toggleAllPermissions}>
            {selectedPermissions.length === allPermissions.length ? "Deselect All" : "Select All"}
          </TextureButton>
        </div>

        {/* Scrollable categories */}
        <div className="max-h-80 space-y-4 overflow-y-auto pr-4">
          {categories.map((category) => (
            <div
              key={category.id}
              className={cn("rounded-lg border p-3", "border-zinc-800 bg-zinc-900/30")}
            >
              {/* Category header with select all */}
              <div className="mb-3 flex items-center justify-between">
                <TextureButton
                  variant="ghost"
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className="flex-1"
                >
                  <Checkbox
                    checked={
                      isCategoryFullySelected(category)
                        ? true
                        : isCategoryPartiallySelected(category)
                          ? "indeterminate"
                          : false
                    }
                    className="mr-2"
                  />
                  <span
                    className={cn("text-xs font-medium tracking-wider uppercase", "text-zinc-300")}
                  >
                    {category.name}
                  </span>
                </TextureButton>
                <span className={cn("text-[10px] tracking-wider", "text-zinc-600")}>
                  {category.permissions.filter((p) => selectedPermissions.includes(p.key)).length}/
                  {category.permissions.length}
                </span>
              </div>

              {/* Category permissions - 2 column grid */}
              <div className="grid grid-cols-2 gap-2 px-2">
                {category.permissions.map((perm) => (
                  <label key={perm.key} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={selectedPermissions.includes(perm.key)}
                      onCheckedChange={() => togglePermission(perm.key)}
                    />
                    <span className="truncate text-xs font-medium">{perm.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }, [
    selectedPermissions,
    allPermissions,
    isCategoryFullySelected,
    isCategoryPartiallySelected,
    toggleCategory,
    togglePermission,
    toggleAllPermissions,
  ]);

  return (
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-card px-4 pb-4">
          {/* Header */}
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOwner && (
                  <TextureButton
                    variant="primary"
                    size="sm"
                    className="w-fit"
                    onClick={openInviteModal}
                  >
                    <BsPlus className="h-4 w-4" />
                    Invite User
                  </TextureButton>
                )}
              </div>
            </div>
          </FadeIn>

          {/* Pending Invitations Card */}
          {invitations.length > 0 && (
            <FadeIn delay={0.05}>
              <div className="mb-4 flex h-full flex-col rounded-lg border border-white/5 bg-muted p-1 pt-2">
                <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
                  <div className="flex items-center gap-2 text-xs opacity-50">
                    <BsEnvelope className="h-3 w-3" />
                    Pending Invitations
                  </div>
                  <span className="text-xs text-zinc-500">
                    {invitations.length} invitation{invitations.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-card via-secondary to-background shadow-lg shadow-black/20">
                  {invitations.map((invitation, index) => (
                    <div
                      key={invitation.id}
                      className={cn(
                        "flex items-center justify-between p-4 transition-colors hover:bg-zinc-800/20",
                        index !== invitations.length - 1 && "border-b border-zinc-800/50"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-700/50 bg-amber-900/30">
                          <BsEnvelope className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-amber-200">
                            {invitation.email}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-amber-200/60">
                            <span>{getPermissionCount(invitation.permissions)}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <BsClock className="h-3 w-3" />
                              Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      {isOwner && (
                        <TextureButton
                          variant="secondary"
                          size="sm"
                          className="w-fit"
                          onClick={() => openCancelInviteModal(invitation)}
                        >
                          <BsTrash className="h-4 w-4" />
                        </TextureButton>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          )}

          {/* Members Card */}
          <FadeIn delay={invitations.length > 0 ? 0.1 : 0.05}>
            <div className="flex h-full flex-col rounded-lg border border-white/5 bg-muted p-1 pt-2">
              <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
                <div className="flex items-center gap-2 text-xs opacity-50">
                  <BsPeopleFill className="h-3 w-3" />
                  Members
                </div>
                <span className="text-xs text-zinc-500">
                  {members.length + 1} member{members.length !== 0 ? "s" : ""}
                </span>
              </div>
              <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-card via-secondary to-background shadow-lg shadow-black/20">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner />
                  </div>
                ) : (
                  <>
                    {/* Server Owner (always shown first) */}
                    {server?.owner && (
                      <div
                        className={cn(
                          "flex items-center justify-between p-4 transition-colors hover:bg-zinc-800/20",
                          members.length > 0 && "border-b border-zinc-800/50"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-700/50 bg-amber-900/30">
                            <BsShieldFill className="h-5 w-5 text-amber-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-zinc-100">
                                {server.owner.name}
                              </span>
                              <span className="rounded border border-amber-500/50 px-2 py-0.5 text-[10px] font-medium text-amber-400 uppercase">
                                Owner
                              </span>
                              {server.owner.id === currentUser?.id && (
                                <span className="text-[10px] text-zinc-500">(You)</span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">{server.owner.email}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Server Members */}
                    {members.map((member, index) => (
                      <div
                        key={member.id}
                        className={cn(
                          "flex items-center justify-between p-4 transition-colors hover:bg-zinc-800/20",
                          index !== members.length - 1 && "border-b border-zinc-800/50"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/50">
                            <BsPersonFill className="h-5 w-5 text-zinc-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-zinc-100">
                                {member.user.name}
                              </span>
                              <span className="rounded border border-zinc-600 px-2 py-0.5 text-[10px] font-medium text-zinc-400 uppercase">
                                {getPermissionCount(member.permissions)}
                              </span>
                              {member.user.id === currentUser?.id && (
                                <span className="text-[10px] text-zinc-500">(You)</span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-4 text-xs text-zinc-500">
                              <span>{member.user.email}</span>
                              <span>•</span>
                              <span>Added: {new Date(member.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        {isOwner && (
                          <div className="flex items-center gap-2">
                            <TextureButton
                              variant="secondary"
                              size="sm"
                              className="w-fit"
                              onClick={() => openEditModal(member)}
                            >
                              <BsPencil className="h-4 w-4" />
                            </TextureButton>
                            <TextureButton
                              variant="secondary"
                              size="sm"
                              className="w-fit"
                              onClick={() => openDeleteModal(member)}
                            >
                              <BsTrash className="h-4 w-4" />
                            </TextureButton>
                          </div>
                        )}
                      </div>
                    ))}

                    {members.length === 0 && !server?.owner && (
                      <div className="flex flex-col items-center justify-center py-12">
                        <BsPeopleFill className="mb-4 h-12 w-12 text-zinc-600" />
                        <h3 className="mb-2 text-sm font-medium text-zinc-300">No Members</h3>
                        <p className="mb-4 text-xs text-zinc-500">
                          Invite users to collaborate on this server.
                        </p>
                        {isOwner && (
                          <TextureButton
                            variant="minimal"
                            size="sm"
                            className="w-fit"
                            onClick={openInviteModal}
                          >
                            <BsPlus className="h-4 w-4" />
                            Invite User
                          </TextureButton>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Invite User Modal */}
      <FormModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        title="Invite User"
        description="Send an invitation to collaborate on this server."
        onSubmit={handleInvite}
        submitLabel="Send Invitation"
        isValid={isEmailValid && selectedPermissions.length > 0}
        isLoading={createInvitation.isPending}
        size="2xl"
      >
        <div className="space-y-4">
          <div>
            <Label>Email Address</Label>
            <Input
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="user@example.com"
              className={cn(
                "transition-all",
                "border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600"
              )}
            />
          </div>
          <div>
            <Label>Permissions</Label>
            {stablePermissionDefs?.categories ? (
              <PermissionSelector categories={stablePermissionDefs.categories} />
            ) : (
              <div className="flex items-center justify-center py-8">
                <Spinner className="h-6 w-6" />
              </div>
            )}
          </div>
        </div>
      </FormModal>

      {/* Edit Permissions Modal */}
      <FormModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        title="Edit Permissions"
        description={`Update permissions for ${selectedMember?.user.name}.`}
        onSubmit={handleEditPermissions}
        submitLabel="Save Changes"
        isValid={selectedPermissions.length > 0}
        isLoading={updateMember.isPending}
        size="2xl"
      >
        <div className="space-y-4">
          {stablePermissionDefs?.categories ? (
            <PermissionSelector categories={stablePermissionDefs.categories} />
          ) : (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-6 w-6" />
            </div>
          )}
        </div>
      </FormModal>

      {/* Remove Member Modal */}
      <ConfirmationModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Remove Member"
        description={`Are you sure you want to remove ${selectedMember?.user.name} from this server? They will lose all access.`}
        onConfirm={handleRemoveMember}
        confirmLabel="Remove"
        isLoading={removeMember.isPending}
      />

      {/* Cancel Invitation Modal */}
      <ConfirmationModal
        open={cancelInviteModalOpen}
        onOpenChange={setCancelInviteModalOpen}
        title="Cancel Invitation"
        description={`Are you sure you want to cancel the invitation for ${selectedInvitation?.email}?`}
        onConfirm={handleCancelInvitation}
        confirmLabel="Cancel Invitation"
        isLoading={cancelInvitation.isPending}
      />
    </FadeIn>
  );
};

export default UsersPage;
