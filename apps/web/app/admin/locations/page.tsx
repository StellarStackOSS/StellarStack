"use client";

import {useMemo, useState} from "react";
import {cn} from "@workspace/ui/lib/utils";
import {Button} from "@workspace/ui/components/button";
import {Spinner} from "@workspace/ui/components/spinner";
import {AnimatedBackground} from "@workspace/ui/components/animated-background";
import {FadeIn} from "@workspace/ui/components/fade-in";
import {FloatingDots} from "@workspace/ui/components/floating-particles";
import {FormModal} from "@workspace/ui/components/form-modal";
import {ConfirmationModal} from "@workspace/ui/components/confirmation-modal";
import {EditIcon, MapPinIcon, PlusIcon, TrashIcon} from "lucide-react";
import {AdminPageHeader, AdminSearchBar, AdminCard, AdminEmptyState} from "components/AdminPageComponents";
import {useLocationMutations, useLocations} from "@/hooks/queries";
import {useAdminTheme} from "@/hooks/use-admin-theme";
import type {CreateLocationData, Location} from "@/lib/api";
import {toast} from "sonner";

export default function LocationsPage() {
  const { mounted, isDark, inputClasses, labelClasses } = useAdminTheme();

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

  // Filter locations based on search query
  const filteredLocations = useMemo(() => {
    if (!searchQuery) return locationsList;
    const query = searchQuery.toLowerCase();
    return locationsList.filter((location) =>
      location.name.toLowerCase().includes(query) ||
      location.country?.toLowerCase().includes(query) ||
      location.city?.toLowerCase().includes(query) ||
      location.description?.toLowerCase().includes(query)
    );
  }, [locationsList, searchQuery]);

  if (!mounted) return null;

  return (
    <div className={cn("min-h-svh transition-colors relative", isDark ? "bg-[#0b0b0a]" : "bg-[#f5f5f4]")}>
      <AnimatedBackground isDark={isDark} />
      <FloatingDots isDark={isDark} count={15} />

      <div className="relative p-8">
        <div className="max-w-6xl mx-auto">
          <FadeIn delay={0}>
            <AdminPageHeader
              title="LOCATIONS"
              description="Manage geographic locations for nodes"
              isDark={isDark}
              action={{
                label: "Add Location",
                icon: <PlusIcon className="w-4 h-4" />,
                onClick: () => { resetForm(); setIsModalOpen(true); },
              }}
            />

            <AdminSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search locations..."
              isDark={isDark}
            />
          </FadeIn>

          {/* Locations Grid */}
          <FadeIn delay={0.1}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {isLoading ? (
                <div className="col-span-full flex justify-center py-12">
                  <Spinner className="w-6 h-6" />
                </div>
              ) : filteredLocations.length === 0 ? (
                <AdminEmptyState
                  message={searchQuery ? "No locations match your search." : "No locations configured. Add your first location."}
                  isDark={isDark}
                />
              ) : (
                filteredLocations.map((location) => (
                  <AdminCard
                    key={location.id}
                    icon={<MapPinIcon className={cn("w-6 h-6", isDark ? "text-zinc-400" : "text-zinc-600")} />}
                    title={location.name}
                    isDark={isDark}
                    actions={
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(location)}
                          className={cn(
                            "text-xs p-1.5",
                            isDark ? "border-zinc-700 text-zinc-400 hover:text-zinc-100" : "border-zinc-300 text-zinc-600 hover:text-zinc-900"
                          )}
                        >
                          <EditIcon className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteConfirmLocation(location)}
                          className={cn(
                            "text-xs p-1.5",
                            isDark ? "border-red-900/50 text-red-400 hover:bg-red-900/20" : "border-red-200 text-red-600 hover:bg-red-50"
                          )}
                        >
                          <TrashIcon className="w-3 h-3" />
                        </Button>
                      </div>
                    }
                  >
                    {(location.city || location.country) && (
                      <div className={cn("text-xs mt-1", isDark ? "text-zinc-500" : "text-zinc-400")}>
                        {[location.city, location.country].filter(Boolean).join(", ")}
                      </div>
                    )}
                    {location.description && (
                      <div className={cn("text-xs mt-2", isDark ? "text-zinc-600" : "text-zinc-400")}>
                        {location.description}
                      </div>
                    )}
                    {location.nodes && location.nodes.length > 0 && (
                      <div className={cn("text-xs mt-2", isDark ? "text-zinc-500" : "text-zinc-400")}>
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
            <label className={labelClasses}>Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="US West"
              className={inputClasses}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>Country</label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder="US"
                className={inputClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Los Angeles"
                className={inputClasses}
              />
            </div>
          </div>

          <div>
            <label className={labelClasses}>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description..."
              rows={3}
              className={cn(inputClasses, "resize-none")}
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
        variant="danger"
        isLoading={remove.isPending}
      />
    </div>
  );
}
