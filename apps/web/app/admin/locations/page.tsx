"use client";

import { useMemo, useState } from "react";
import { cn } from "@stellarUI/lib/Utils";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import FormModal from "@stellarUI/components/FormModal/FormModal";
import ConfirmationModal from "@stellarUI/components/ConfirmationModal/ConfirmationModal";
import Input from "@stellarUI/components/Input/Input";
import Label from "@stellarUI/components/Label/Label";
import Textarea from "@stellarUI/components/Textarea";
import { BsGeoAlt, BsPlus, BsPencil, BsTrash } from "react-icons/bs";
import { useLocationMutations } from "@/hooks/queries/UseLocations";
import { useLocations } from "@/hooks/queries/UseLocations";
import type { CreateLocationData, Location } from "@/lib/Api";
import { toast } from "sonner";

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
    setFormData({ name: "", description: "", country: "", city: "" });
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
    } catch (error) {
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
    } catch (error) {
      toast.error("Failed to delete location");
    }
  };

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
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-black px-4 pb-4">
          {/* Header */}
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-end">
              <div className="flex items-center gap-2">
                <TextureButton
                  variant="primary"
                  size="sm"
                  className="w-fit"
                  onClick={() => {
                    resetForm();
                    setIsModalOpen(true);
                  }}
                >
                  <BsPlus className="h-4 w-4" />
                  Add Location
                </TextureButton>
              </div>
            </div>
          </FadeIn>

          {/* Search */}
          <FadeIn delay={0.05}>
            <div className="mb-4">
              <Input
                type="text"
                placeholder="Search locations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9"
              />
            </div>
          </FadeIn>

          {/* Locations List */}
          <FadeIn delay={0.1}>
            <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
              <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
                <div className="flex items-center gap-2 text-xs opacity-50">
                  <BsGeoAlt className="h-3 w-3" />
                  Locations
                </div>
                <span className="text-xs text-zinc-500">
                  {filteredLocations.length} location{filteredLocations.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner />
                  </div>
                ) : filteredLocations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <BsGeoAlt className="mb-4 h-12 w-12 text-zinc-600" />
                    <h3 className="mb-2 text-sm font-medium text-zinc-300">No Locations</h3>
                    <p className="mb-4 text-xs text-zinc-500">
                      {searchQuery
                        ? "No locations match your search."
                        : "Add your first location to get started."}
                    </p>
                    {!searchQuery && (
                      <TextureButton
                        variant="minimal"
                        size="sm"
                        className="w-fit"
                        onClick={() => {
                          resetForm();
                          setIsModalOpen(true);
                        }}
                      >
                        <BsPlus className="h-4 w-4" />
                        Add Location
                      </TextureButton>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredLocations.map((location) => (
                      <div
                        key={location.id}
                        className="flex flex-col rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-4 transition-colors hover:border-zinc-600"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-700/50 bg-blue-900/30">
                              <BsGeoAlt className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                              <h3 className="text-sm font-medium text-zinc-100">{location.name}</h3>
                              {(location.city || location.country) && (
                                <p className="text-xs text-zinc-500">
                                  {[location.city, location.country].filter(Boolean).join(", ")}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <TextureButton
                              variant="minimal"
                              size="sm"
                              className="w-fit"
                              onClick={() => handleEdit(location)}
                            >
                              <BsPencil className="h-3.5 w-3.5" />
                            </TextureButton>
                            <TextureButton
                              variant="secondary"
                              size="sm"
                              className="w-fit text-red-400 hover:text-red-300"
                              onClick={() => setDeleteConfirmLocation(location)}
                            >
                              <BsTrash className="h-3.5 w-3.5" />
                            </TextureButton>
                          </div>
                        </div>
                        {location.description && (
                          <p className="mt-3 text-xs text-zinc-500">{location.description}</p>
                        )}
                        {location.nodes && location.nodes.length > 0 && (
                          <p className="mt-2 text-xs text-zinc-600">
                            {location.nodes.length} node{location.nodes.length !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
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
    </FadeIn>
  );
}
