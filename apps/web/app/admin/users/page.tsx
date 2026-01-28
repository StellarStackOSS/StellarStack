"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@workspace/ui/lib/utils";
import { TextureButton } from "@workspace/ui/components/texture-button";
import { FadeIn } from "@workspace/ui/components/fade-in";
import { FormModal } from "@workspace/ui/components/form-modal";
import { ConfirmationModal } from "@workspace/ui/components/confirmation-modal";
import { DataTable } from "@workspace/ui/components/data-table";
import { ArrowLeft, Edit, Plus, Search, Shield, Trash, User as UserIcon } from "lucide-react";
import { useUserMutations, useUsers } from "@/hooks/queries";
import { useAuth } from "hooks/auth-provider";
import type { User } from "@/lib/api";
import { toast } from "sonner";
import { ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";

export default function UsersPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();

  // React Query hooks
  const { data: usersList = [], isLoading } = useUsers();
  const { create, update, remove } = useUserMutations();

  // UI state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Define table columns
  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: "name",
        header: "User",
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center border border-zinc-700 bg-zinc-800 text-zinc-400"
                )}
              >
                {user.role === "admin" ? (
                  <Shield className="h-4 w-4" />
                ) : (
                  <UserIcon className="h-4 w-4" />
                )}
              </div>
              <div>
                <div className="font-medium">{user.name}</div>
                {user.id === currentUser?.id && (
                  <div className={cn("text-xs text-zinc-500")}>(You)</div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className={cn("text-sm text-zinc-400")}>
              {user.email}
              {user.emailVerified && (
                <span
                  className={cn("ml-2 border border-zinc-600 px-1 py-0.5 text-xs text-zinc-400")}
                >
                  Verified
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => {
          const user = row.original;
          return (
            <TextureButton
              variant="minimal"
              onClick={() => toggleRole(user)}
              disabled={user.id === currentUser?.id || update.isPending}
            >
              {user.role === "admin" ? (
                <Shield className="h-3 w-3" />
              ) : (
                <UserIcon className="h-3 w-3" />
              )}
              {user.role}
            </TextureButton>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <TextureButton variant="minimal" size="sm" onClick={() => handleEdit(user)}>
                <Edit className="h-3 w-3" />
              </TextureButton>
              <TextureButton
                variant="minimal"
                size="sm"
                onClick={() => {
                  if (user.id === currentUser?.id) {
                    toast.error("You cannot delete yourself");
                    return;
                  }
                  setDeleteConfirmUser(user);
                }}
                disabled={user.id === currentUser?.id}
              >
                <Trash className="h-3 w-3" />
              </TextureButton>
            </div>
          );
        },
      },
    ],
    [currentUser?.id, update.isPending]
  );

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "user" as "user" | "admin",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "user",
    });
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
    } catch {
      toast.error("Failed to update user");
    }
  };

  const handleCreate = () => {
    setIsCreateMode(true);
    setEditingUser(null);
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "user",
    });
    setIsModalOpen(true);
  };

  const handleEdit = (user: User) => {
    setIsCreateMode(false);
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirmUser) return;
    try {
      await remove.mutateAsync(deleteConfirmUser.id);
      toast.success("User deleted successfully");
      setDeleteConfirmUser(null);
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const toggleRole = async (user: User) => {
    if (user.id === currentUser?.id) {
      toast.error("You cannot change your own role");
      return;
    }
    try {
      const newRole = user.role === "admin" ? "user" : "admin";
      await update.mutateAsync({ id: user.id, data: { role: newRole } });
      toast.success(`User role changed to ${newRole}`);
    } catch {
      toast.error("Failed to update user role");
    }
  };

  // Filter users based on search query
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

  // Create table instance
  const table = useReactTable({
    data: filteredUsers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className={cn("relative min-h-svh bg-[#0b0b0a] transition-colors")}>
      <div className="relative p-8">
        <div className="mx-auto">
          <FadeIn delay={0}>
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <TextureButton variant="ghost" size="sm" onClick={() => router.push("/admin")}>
                  <ArrowLeft className="h-4 w-4" />
                </TextureButton>
                <div>
                  <h1 className={cn("text-2xl font-light tracking-wider text-zinc-100")}>USERS</h1>
                  <p className={cn("mt-1 text-sm text-zinc-500")}>
                    Manage user accounts and permissions
                  </p>
                </div>
              </div>
              <TextureButton variant="secondary" size="sm" onClick={handleCreate}>
                <Plus className="h-4 w-4" />
                Create User
              </TextureButton>
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
              <Search
                className={cn("absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500")}
              />
              <Input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </FadeIn>

          {/* Users Table */}
          <FadeIn delay={0.1}>
            <DataTable
              table={table}
              columns={columns}
              isLoading={isLoading}
              emptyMessage={searchQuery ? "No users match your search." : "No users found."}
            />
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
            {!isCreateMode && (
              <p className={cn("mt-1 text-xs text-zinc-600")}>Email cannot be changed</p>
            )}
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
                <p className={cn("mt-1 text-xs text-amber-500")}>
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
              <p className={cn("mt-1 text-xs text-zinc-500")}>You cannot change your own role</p>
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
    </div>
  );
}
