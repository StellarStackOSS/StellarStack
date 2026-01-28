"use client";

import { useMemo, useState } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { TextureButton } from "@workspace/ui/components/texture-button";
import { Spinner } from "@workspace/ui/components/spinner";
import { FadeIn } from "@workspace/ui/components/fade-in";
import { FormModal } from "@workspace/ui/components/form-modal";
import { ConfirmationModal } from "@workspace/ui/components/confirmation-modal";
import { Edit, MapPin, Plus, Trash } from "lucide-react";
import {
  AdminCard,
  AdminEmptyState,
  AdminPageHeader,
  AdminSearchBar,
} from "components/AdminPageComponents";
import { useLocationMutations, useLocations } from "@/hooks/queries";
import type { CreateLocationData, Location } from "@/lib/api";
import { toast } from "sonner";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";

export default function LocationsPage() {
  // React Query hooks
  const { data: locationsList = [], isLoading } = useLocations();
  const { create, update, remove } = useLocationMutations();

  // UI state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [deleteConfirmLocation, setDeleteConfirmLocation] = useState<Location | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [formData, setFormData] = useState<CreateLocationData>({
    name: "",
    description: "",
    country: "",
    city: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      country: "",
      city: "",
    });
    setEditingLocation(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingLocation) {
        await update.mutateAsync({ id: editingLocation.id, data: formData });
        toast.success("Location updated successfully");
      } else {
        await create.mutateAsync(formData);
        toast.success("Location created successfully");
      }
      setIsModalOpen(false);
      resetForm();
    } catch {
      toast.error(editingLocation ? "Failed to update location" : "Failed to create location");
    }
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      description: location.description || "",
      country: location.country || "",
      city: location.city || "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirmLocation) return;
    try {
      await remove.mutateAsync(deleteConfirmLocation.id);
      toast.success("Location deleted successfully");
      setDeleteConfirmLocation(null);
    } catch {
      toast.error("Failed to delete location");
    }
  };

  // Filter locations based on search query
  const filteredLocations = useMemo(() => {
    if (!searchQuery) return locationsList;
    const query = searchQuery.toLowerCase();
    return locationsList.filter(
      (location) =>
        location.name.toLowerCase().includes(query) ||
        location.country?.toLowerCase().includes(query) ||
        location.city?.toLowerCase().includes(query) ||
        location.description?.toLowerCase().includes(query)
    );
  }, [locationsList, searchQuery]);

  return (
    <div className={cn("relative min-h-svh bg-[#0b0b0a] transition-colors")}>
      <div className="relative p-8">
        <div className="mx-auto">
          <FadeIn delay={0}>
            <AdminPageHeader
              title="LOCATIONS"
              description="Manage geographic locations for nodes"
              action={{
                label: "Add Location",
                icon: <Plus className="h-4 w-4" />,
                onClick: () => {
                  resetForm();
                  setIsModalOpen(true);
                },
              }}
            />

            <AdminSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search locations..."
            />
          </FadeIn>

          {/* Locations Grid */}
          <FadeIn delay={0.1}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {isLoading ? (
                <div className="col-span-full flex justify-center py-12">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : filteredLocations.length === 0 ? (
                <AdminEmptyState
                  message={
                    searchQuery
                      ? "No locations match your search."
                      : "No locations configured. Add your first location."
                  }
                />
              ) : (
                filteredLocations.map((location) => (
                  <AdminCard
                    key={location.id}
                    icon={<MapPin className={cn("h-6 w-6", "text-zinc-400")} />}
                    title={location.name}
                    actions={
                      <div className="flex items-center gap-1">
                        <TextureButton
                          variant="secondary"
                          size="sm"
                          onClick={() => handleEdit(location)}
                        >
                          <Edit className="h-3 w-3" />
                        </TextureButton>
                        <TextureButton
                          variant="secondary"
                          size="sm"
                          onClick={() => setDeleteConfirmLocation(location)}
                        >
                          <Trash className="h-3 w-3" />
                        </TextureButton>
                      </div>
                    }
                  >
                    {(location.city || location.country) && (
                      <div className={cn("mt-1 text-xs", "text-zinc-500")}>
                        {[location.city, location.country].filter(Boolean).join(", ")}
                      </div>
                    )}
                    {location.description && (
                      <div className={cn("mt-2 text-xs", "text-zinc-600")}>
                        {location.description}
                      </div>
                    )}
                    {location.nodes && location.nodes.length > 0 && (
                      <div className={cn("mt-2 text-xs", "text-zinc-500")}>
                        {location.nodes.length} node{location.nodes.length !== 1 ? "s" : ""}
                      </div>
                    )}
                  </AdminCard>
                ))
              )}
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
        title={editingLocation ? "Edit Location" : "Create Location"}
        submitLabel={editingLocation ? "Update" : "Create"}
        onSubmit={handleSubmit}
        isLoading={create.isPending || update.isPending}
        isValid={formData.name.length > 0}
      >
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="US West"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Country</Label>
              <Input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder="US"
              />
            </div>
            <div>
              <Label>City</Label>
              <Input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Los Angeles"
              />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description..."
              rows={3}
            />
          </div>
        </div>
      </FormModal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        open={!!deleteConfirmLocation}
        onOpenChange={(open) => !open && setDeleteConfirmLocation(null)}
        title="Delete Location"
        description={`Are you sure you want to delete "${deleteConfirmLocation?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isLoading={remove.isPending}
      />
    </div>
  );
}
