"use client";

import { useMemo, useState } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { TextureButton } from "@workspace/ui/components/texture-button";
import { Spinner } from "@workspace/ui/components/spinner";
import { FadeIn } from "@workspace/ui/components/fade-in";
import { FormModal } from "@workspace/ui/components/form-modal";
import { ConfirmationModal } from "@workspace/ui/components/confirmation-modal";
import { SidebarTrigger } from "@workspace/ui/components/sidebar";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { BsPerson, BsShield, BsPlus, BsPencil, BsTrash } from "react-icons/bs";
import { useUserMutations, useUsers } from "@/hooks/queries";
import { useAuth } from "hooks/auth-provider";
import type { User as UserType } from "@/lib/api";
import { toast } from "sonner";

export default function UsersPage() {
  const { user: currentUser } = useAuth();

  // React Query hooks
  const { data: usersList = [], isLoading } = useUsers();
  const { create, update, remove } = useUserMutations();

  // UI state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "user" as "user" | "admin",
  });

  const resetForm = () => {
    setFormData({ name: "", email: "", password: "", role: "user" });
    setEditingUser(null);
    setIsCreateMode(false);
  };

  const handleSubmit = async () => {
    if (isCreateMode) {
      try {
        await create.mutateAsync({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        });
        toast.success("User created successfully");
        setIsModalOpen(false);
        resetForm();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to create user";
        toast.error(errorMessage);
      }
      return;
    }

    if (!editingUser) return;

    try {
      await update.mutateAsync({
        id: editingUser.id,
        data: { name: formData.name, role: formData.role },
      });
      toast.success("User updated successfully");
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to update user");
    }
  };

  const handleCreate = () => {
    setIsCreateMode(true);
    setEditingUser(null);
    setFormData({ name: "", email: "", password: "", role: "user" });
    setIsModalOpen(true);
  };

  const handleEdit = (user: UserType) => {
    setIsCreateMode(false);
    setEditingUser(user);
    setFormData({ name: user.name, email: user.email, password: "", role: user.role });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirmUser) return;
    try {
      await remove.mutateAsync(deleteConfirmUser.id);
      toast.success("User deleted successfully");
      setDeleteConfirmUser(null);
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

  const toggleRole = async (user: UserType) => {
    if (user.id === currentUser?.id) {
      toast.error("You cannot change your own role");
      return;
    }
    try {
      const newRole = user.role === "admin" ? "user" : "admin";
      await update.mutateAsync({ id: user.id, data: { role: newRole } });
      toast.success(`User role changed to ${newRole}`);
    } catch (error) {
      toast.error("Failed to update user role");
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return usersList;
    const query = searchQuery.toLowerCase();
    return usersList.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
    );
  }, [usersList, searchQuery]);

  return (
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-black px-4 pb-4">
          {/* Header */}
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-between">
              <SidebarTrigger className="text-zinc-400 transition-all hover:scale-110 hover:text-zinc-100 active:scale-95" />
              <div className="flex items-center gap-2">
                <TextureButton variant="primary" size="sm" className="w-fit" onClick={handleCreate}>
                  <BsPlus className="h-4 w-4" />
                  Create User
                </TextureButton>
              </div>
            </div>
          </FadeIn>

          {/* Search */}
          <FadeIn delay={0.05}>
            <div className="mb-4">
              <Input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9"
              />
            </div>
          </FadeIn>

          {/* Users List */}
          <FadeIn delay={0.1}>
            <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
              <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
                <div className="flex items-center gap-2 text-xs opacity-50">
                  <BsPerson className="h-3 w-3" />
                  Users
                </div>
                <span className="text-xs text-zinc-500">
                  {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <BsPerson className="mb-4 h-12 w-12 text-zinc-600" />
                    <h3 className="mb-2 text-sm font-medium text-zinc-300">No Users</h3>
                    <p className="mb-4 text-xs text-zinc-500">
                      {searchQuery ? "No users match your search." : "No users found."}
                    </p>
                  </div>
                ) : (
                  filteredUsers.map((user, index) => (
                    <div
                      key={user.id}
                      className={cn(
                        "flex items-center justify-between p-4 transition-colors hover:bg-zinc-800/20",
                        index !== filteredUsers.length - 1 && "border-b border-zinc-800/50"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-lg border",
                            user.role === "admin"
                              ? "border-amber-700/50 bg-amber-900/30"
                              : "border-zinc-700 bg-zinc-800/50"
                          )}
                        >
                          {user.role === "admin" ? (
                            <BsShield className="h-5 w-5 text-amber-400" />
                          ) : (
                            <BsPerson className="h-5 w-5 text-zinc-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-100">{user.name}</span>
                            {user.id === currentUser?.id && (
                              <span className="text-xs text-zinc-500">(You)</span>
                            )}
                            <button
                              onClick={() => toggleRole(user)}
                              disabled={user.id === currentUser?.id || update.isPending}
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase transition-colors",
                                user.role === "admin"
                                  ? "bg-amber-900/30 text-amber-400 hover:bg-amber-900/50"
                                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700",
                                (user.id === currentUser?.id || update.isPending) &&
                                  "cursor-not-allowed opacity-50"
                              )}
                            >
                              {user.role}
                            </button>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                            <span>{user.email}</span>
                            {user.emailVerified && (
                              <span className="rounded bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-400">
                                Verified
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-zinc-600">
                            Created: {new Date(user.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TextureButton
                          variant="minimal"
                          size="sm"
                          className="w-fit"
                          onClick={() => handleEdit(user)}
                        >
                          <BsPencil className="h-4 w-4" />
                        </TextureButton>
                        <TextureButton
                          variant="secondary"
                          size="sm"
                          className="w-fit text-red-400 hover:text-red-300"
                          onClick={() => {
                            if (user.id === currentUser?.id) {
                              toast.error("You cannot delete yourself");
                              return;
                            }
                            setDeleteConfirmUser(user);
                          }}
                          disabled={user.id === currentUser?.id}
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

      {/* Create/Edit Modal */}
      <FormModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) resetForm();
        }}
        title={isCreateMode ? "Create User" : "Edit User"}
        submitLabel={isCreateMode ? "Create" : "Update"}
        onSubmit={handleSubmit}
        isLoading={isCreateMode ? create.isPending : update.isPending}
        isValid={
          isCreateMode
            ? formData.name.length > 0 && formData.email.length > 0 && formData.password.length >= 8
            : formData.name.length > 0
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="User name"
              required
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="user@example.com"
              disabled={!isCreateMode}
              required
            />
            {!isCreateMode && <p className="mt-1 text-xs text-zinc-600">Email cannot be changed</p>}
          </div>
          {isCreateMode && (
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Minimum 8 characters"
                required
                minLength={8}
              />
              {formData.password.length > 0 && formData.password.length < 8 && (
                <p className="mt-1 text-xs text-amber-500">
                  Password must be at least 8 characters
                </p>
              )}
            </div>
          )}
          <div>
            <Label>Role</Label>
            <Select
              value={formData.role}
              onValueChange={(value) =>
                setFormData({ ...formData, role: value as "user" | "admin" })
              }
              disabled={!isCreateMode && editingUser?.id === currentUser?.id}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            {!isCreateMode && editingUser?.id === currentUser?.id && (
              <p className="mt-1 text-xs text-zinc-500">You cannot change your own role</p>
            )}
          </div>
        </div>
      </FormModal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        open={!!deleteConfirmUser}
        onOpenChange={(open) => !open && setDeleteConfirmUser(null)}
        title="Delete User"
        description={`Are you sure you want to delete "${deleteConfirmUser?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isLoading={remove.isPending}
      />
    </FadeIn>
  );
}
