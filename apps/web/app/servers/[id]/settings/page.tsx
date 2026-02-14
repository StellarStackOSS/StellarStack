"use client";

import { type JSX, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@stellarUI/lib/Utils";
import { TextureButton } from "@stellarUI/components/TextureButton";
import ConfirmationModal from "@stellarUI/components/ConfirmationModal/ConfirmationModal";
import Dialog, {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@stellarUI/components/Dialog/Dialog";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import Slider from "@stellarUI/components/Slider/Slider";
import Label from "@stellarUI/components/Label/Label";
import Input from "@stellarUI/components/Input/Input";
import Textarea from "@stellarUI/components/Textarea";
import Select, {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@stellarUI/components/Select";
import {
  BsCheck,
  BsCheckCircle,
  BsExclamationTriangle,
  BsGeoAlt,
  BsGlobe,
  BsLayers,
} from "react-icons/bs";
import type { Blueprint } from "@/lib/Api";
import { blueprints, servers } from "@/lib/Api";
import { useServer } from "components/ServerStatusPages/ServerProvider/ServerProvider";
import { ServerInstallingPlaceholder } from "components/ServerStatusPages/ServerInstallingPlaceholder/ServerInstallingPlaceholder";
import { ServerSuspendedPlaceholder } from "components/ServerStatusPages/ServerSuspendedPlaceholder/ServerSuspendedPlaceholder";
import { toast } from "sonner";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";

interface ServerSettings {
  name: string;
  description: string;
  blueprintId?: string;
  memoryLimit?: string;
  diskLimit?: string;
}

interface Location {
  id: string;
  name: string;
  city: string;
  country: string;
  region: string;
  flag: string;
}

interface LocationPing {
  locationId: string;
  ping: number | null;
  status: "pending" | "pinging" | "done" | "error";
}

const locations: Location[] = [
  // North America
  {
    id: "us-west-1",
    name: "US West 1",
    city: "Los Angeles",
    country: "USA",
    region: "North America",
    flag: "🇺🇸",
  },
  {
    id: "us-west-2",
    name: "US West 2",
    city: "Seattle",
    country: "USA",
    region: "North America",
    flag: "🇺🇸",
  },
  {
    id: "us-central-1",
    name: "US Central",
    city: "Dallas",
    country: "USA",
    region: "North America",
    flag: "🇺🇸",
  },
  {
    id: "us-east-1",
    name: "US East 1",
    city: "New York",
    country: "USA",
    region: "North America",
    flag: "🇺🇸",
  },
  {
    id: "us-east-2",
    name: "US East 2",
    city: "Miami",
    country: "USA",
    region: "North America",
    flag: "🇺🇸",
  },
  {
    id: "ca-central-1",
    name: "Canada Central",
    city: "Toronto",
    country: "Canada",
    region: "North America",
    flag: "🇨🇦",
  },
  // Europe
  {
    id: "eu-west-1",
    name: "EU West 1",
    city: "London",
    country: "UK",
    region: "Europe",
    flag: "🇬🇧",
  },
  {
    id: "eu-west-2",
    name: "EU West 2",
    city: "Paris",
    country: "France",
    region: "Europe",
    flag: "🇫🇷",
  },
  {
    id: "eu-west-3",
    name: "EU West 3",
    city: "Amsterdam",
    country: "Netherlands",
    region: "Europe",
    flag: "🇳🇱",
  },
  {
    id: "eu-central-1",
    name: "EU Central 1",
    city: "Frankfurt",
    country: "Germany",
    region: "Europe",
    flag: "🇩🇪",
  },
  {
    id: "eu-central-2",
    name: "EU Central 2",
    city: "Warsaw",
    country: "Poland",
    region: "Europe",
    flag: "🇵🇱",
  },
  {
    id: "eu-north-1",
    name: "EU North",
    city: "Stockholm",
    country: "Sweden",
    region: "Europe",
    flag: "🇸🇪",
  },
  {
    id: "eu-south-1",
    name: "EU South",
    city: "Milan",
    country: "Italy",
    region: "Europe",
    flag: "🇮🇹",
  },
  // Asia Pacific
  {
    id: "ap-east-1",
    name: "Asia Pacific East",
    city: "Hong Kong",
    country: "Hong Kong",
    region: "Asia Pacific",
    flag: "🇭🇰",
  },
  {
    id: "ap-southeast-1",
    name: "Asia Pacific SE 1",
    city: "Singapore",
    country: "Singapore",
    region: "Asia Pacific",
    flag: "🇸🇬",
  },
  {
    id: "ap-southeast-2",
    name: "Asia Pacific SE 2",
    city: "Sydney",
    country: "Australia",
    region: "Asia Pacific",
    flag: "🇦🇺",
  },
  {
    id: "ap-northeast-1",
    name: "Asia Pacific NE 1",
    city: "Tokyo",
    country: "Japan",
    region: "Asia Pacific",
    flag: "🇯🇵",
  },
  {
    id: "ap-northeast-2",
    name: "Asia Pacific NE 2",
    city: "Seoul",
    country: "South Korea",
    region: "Asia Pacific",
    flag: "🇰🇷",
  },
  {
    id: "ap-south-1",
    name: "Asia Pacific South",
    city: "Mumbai",
    country: "India",
    region: "Asia Pacific",
    flag: "🇮🇳",
  },
  // South America
  {
    id: "sa-east-1",
    name: "South America East",
    city: "São Paulo",
    country: "Brazil",
    region: "South America",
    flag: "🇧🇷",
  },
  {
    id: "sa-west-1",
    name: "South America West",
    city: "Santiago",
    country: "Chile",
    region: "South America",
    flag: "🇨🇱",
  },
  // Africa & Middle East
  {
    id: "me-south-1",
    name: "Middle East",
    city: "Dubai",
    country: "UAE",
    region: "Middle East",
    flag: "🇦🇪",
  },
  {
    id: "af-south-1",
    name: "Africa South",
    city: "Cape Town",
    country: "South Africa",
    region: "Africa",
    flag: "🇿🇦",
  },
];

const defaultSettings: ServerSettings = {
  name: "",
  description: "",
};

const SettingsPage = (): JSX.Element | null => {
  const params = useParams();
  const serverId = params.id as string;
  const { server, isInstalling, refetch } = useServer();
  const [settings, setSettings] = useState<ServerSettings>(defaultSettings);
  const [originalSettings, setOriginalSettings] = useState<ServerSettings>(defaultSettings);
  const [blueprintList, setBlueprintList] = useState<Blueprint[]>([]);
  const [isLoadingBlueprints, setIsLoadingBlueprints] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [reinstallModalOpen, setReinstallModalOpen] = useState(false);
  const [isReinstalling, setIsReinstalling] = useState(false);
  const [saved, setSaved] = useState(false);

  // Transfer modal state
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [locationPings, setLocationPings] = useState<LocationPing[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [currentLocation] = useState("us-west-1"); // Current server location
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingCooldown, setPingCooldown] = useState(0);

  // Server splitting state
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitResources, setSplitResources] = useState({
    cpu: 50,
    memory: 50,
    disk: 50,
  });

  // Simulate pinging locations one by one when modal opens
  const startPinging = useCallback(() => {
    if (isPinging || pingCooldown > 0) return;

    setIsPinging(true);

    // Initialize all locations as pending
    const initialPings: LocationPing[] = locations.map((loc) => ({
      locationId: loc.id,
      ping: null,
      status: "pending",
    }));
    setLocationPings(initialPings);
    setSelectedLocation(null);

    // Calculate total ping duration
    const totalDuration = locations.length * 150 + 500;

    // Ping each location with a staggered delay
    locations.forEach((location, index) => {
      // Mark as pinging
      setTimeout(() => {
        setLocationPings((prev) =>
          prev.map((p) => (p.locationId === location.id ? { ...p, status: "pinging" } : p))
        );
      }, index * 150);

      // Complete with random ping value
      setTimeout(
        () => {
          const basePing = Math.random() * 150 + 20; // 20-170ms base
          // Add regional variation
          let ping = basePing;
          if (location.region === "North America") ping = Math.random() * 60 + 15;
          else if (location.region === "Europe") ping = Math.random() * 80 + 40;
          else if (location.region === "Asia Pacific") ping = Math.random() * 100 + 80;
          else if (location.region === "South America") ping = Math.random() * 80 + 100;
          else ping = Math.random() * 100 + 120;

          // Small chance of error
          const hasError = Math.random() < 0.05;

          setLocationPings((prev) =>
            prev.map((p) =>
              p.locationId === location.id
                ? {
                    ...p,
                    ping: hasError ? null : Math.round(ping),
                    status: hasError ? "error" : "done",
                  }
                : p
            )
          );
        },
        index * 150 + 300 + Math.random() * 200
      );
    });

    // Set pinging to false and start cooldown after all pings complete
    setTimeout(() => {
      setIsPinging(false);
      setPingCooldown(10); // 10 second cooldown
    }, totalDuration);
  }, [isPinging, pingCooldown]);

  // Cooldown timer
  useEffect(() => {
    if (pingCooldown > 0) {
      const timer = setTimeout(() => {
        setPingCooldown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [pingCooldown]);

  // Load blueprints
  useEffect(() => {
    const loadBlueprints = async () => {
      setIsLoadingBlueprints(true);
      try {
        const list = await blueprints.list();
        setBlueprintList(list);
      } catch {
        toast.error("Failed to load cores");
      } finally {
        setIsLoadingBlueprints(false);
      }
    };
    loadBlueprints();
  }, []);

  // Initialize settings from server
  useEffect(() => {
    if (server) {
      setSettings({
        name: server.name,
        description: server.description || "",
        blueprintId: server.blueprintId || "",
      });
      setOriginalSettings({
        name: server.name,
        description: server.description || "",
        blueprintId: server.blueprintId || "",
      });
    }
  }, [server]);

  useEffect(() => {
    if (transferModalOpen) {
      startPinging();
    }
  }, [transferModalOpen, startPinging]);

  const handleTransfer = () => {
    if (!selectedLocation) return;
    setTransferConfirmOpen(true);
  };

  const confirmTransfer = () => {
    setIsTransferring(true);
    setTransferConfirmOpen(false);
    // Simulate transfer
    setTimeout(() => {
      setIsTransferring(false);
      setTransferModalOpen(false);
      // Would update server location here
    }, 3000);
  };

  const getPingColor = (ping: number | null) => {
    if (ping === null) return "text-red-400";
    if (ping < 50) return "text-green-400";
    if (ping < 100) return "text-amber-400";
    return "text-red-400";
  };

  // Group locations by region
  const locationsByRegion = locations.reduce<Record<string, Location[]>>((acc, location) => {
    const region = location.region;
    if (!acc[region]) {
      acc[region] = [];
    }
    acc[region]!.push(location);
    return acc;
  }, {});

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

  const handleSettingChange = <K extends keyof ServerSettings>(
    key: K,
    value: ServerSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const handleSave = async () => {
    try {
      // Check if name or description changed
      const nameChanged = settings.name !== originalSettings.name;
      const descriptionChanged = settings.description !== originalSettings.description;

      if (nameChanged || descriptionChanged) {
        await servers.update(serverId, {
          name: settings.name,
          description: settings.description || undefined,
        });
      }

      // Check if blueprint changed
      if (settings.blueprintId && settings.blueprintId !== originalSettings.blueprintId) {
        await servers.changeBlueprint(serverId, {
          blueprintId: settings.blueprintId,
          reinstall: false,
        });
        toast.success("Core changed successfully");
      }

      // Refetch server data to update sidebar and other components
      await refetch();

      setOriginalSettings({ ...settings });
      setSaveModalOpen(false);
      setSaved(true);
      toast.success("Settings saved successfully");
      setTimeout(() => setSaved(false), 2000);
    } catch (_err: unknown) {
      toast.error((_err as Error)?.message || "Failed to save settings");
    }
  };

  const handleReset = () => {
    setSettings({ ...originalSettings });
  };

  const handleReinstall = async () => {
    setIsReinstalling(true);
    try {
      await servers.reinstall(serverId);
      setReinstallModalOpen(false);
      toast.success("Server reinstalled successfully");
    } catch {
      toast.error("Failed to reinstall server");
    } finally {
      setIsReinstalling(false);
    }
  };

  // Server split handler
  const handleSplitServer = () => {
    // Would trigger server split here
    setSplitModalOpen(false);
  };

  return (
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-card px-4 pb-4">
          {/* Header */}
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-end">
              <div className="flex items-center gap-2">
                {hasChanges && (
                  <TextureButton variant="minimal" size="sm" onClick={handleReset}>
                    Reset
                  </TextureButton>
                )}
                <TextureButton
                  variant={saved ? "primary" : "minimal"}
                  size="sm"
                  onClick={() => setSaveModalOpen(true)}
                  disabled={!hasChanges}
                >
                  {saved ? (
                    <>
                      <BsCheckCircle className="h-4 w-4" />
                      Saved
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </TextureButton>
              </div>
            </div>
          </FadeIn>

          {/* Settings Grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* General Settings */}
            <FadeIn delay={0.05}>
              <div className="flex h-full flex-col rounded-lg border border-white/5 bg-muted p-1 pt-2">
                <div className="shrink-0 pb-2 pl-2 text-xs opacity-50">General</div>
                <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-card via-secondary to-background p-4 shadow-lg shadow-black/20">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-zinc-500">Server Name</Label>
                      <Input
                        type="text"
                        value={settings.name}
                        onChange={(e) => handleSettingChange("name", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-500">Description</Label>
                      <Textarea
                        value={settings.description}
                        onChange={(e) => handleSettingChange("description", e.target.value)}
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-500">Core</Label>
                      <Select
                        value={settings.blueprintId || ""}
                        onValueChange={(value) => handleSettingChange("blueprintId", value)}
                        disabled={isLoadingBlueprints}
                      >
                        <SelectTrigger className="mt-1 w-full">
                          <SelectValue placeholder="Select a core..." />
                        </SelectTrigger>
                        <SelectContent>
                          {blueprintList.map((blueprint) => (
                            <SelectItem key={blueprint.id} value={blueprint.id}>
                              {blueprint.name}
                              {blueprint.category && ` - ${blueprint.category}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Resource Limits */}
            <FadeIn delay={0.1}>
              <div className="flex h-full flex-col rounded-lg border border-white/5 bg-muted p-1 pt-2">
                <div className="shrink-0 pb-2 pl-2 text-xs opacity-50">Resource Limits</div>
                <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-card via-secondary to-background p-4 shadow-lg shadow-black/20">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs tracking-wider text-zinc-500 uppercase">CPU</div>
                      <div className="mt-2 text-2xl font-light text-zinc-100">
                        {server?.cpu || 0}%
                      </div>
                      <p className="mt-1 text-xs text-zinc-600">
                        {Math.floor((server?.cpu || 0) / 100)} core
                        {Math.floor((server?.cpu || 0) / 100) !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div>
                      <div className="text-xs tracking-wider text-zinc-500 uppercase">Memory</div>
                      <div className="mt-2 text-2xl font-light text-zinc-100">
                        {Math.floor((server?.memory || 0) / 1024)} GB
                      </div>
                      <p className="mt-1 text-xs text-zinc-600">{server?.memory || 0} MiB</p>
                    </div>
                    <div>
                      <div className="text-xs tracking-wider text-zinc-500 uppercase">Disk</div>
                      <div className="mt-2 text-2xl font-light text-zinc-100">
                        {Math.floor((server?.disk || 0) / 1024)} GB
                      </div>
                      <p className="mt-1 text-xs text-zinc-600">{server?.disk || 0} MiB</p>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Danger Zone - Full Width */}
            <FadeIn delay={0.15} className="lg:col-span-2">
              <div className="flex h-full flex-col rounded-lg border border-red-900/30 bg-muted p-1 pt-2">
                <div className="flex shrink-0 items-center gap-2 pb-2 pl-2 text-xs opacity-50">
                  <BsExclamationTriangle className="h-3 w-3 text-red-400" />
                  <span className="text-red-400">Danger Zone</span>
                </div>
                <div className="flex flex-1 flex-col rounded-lg border border-red-900/20 bg-gradient-to-b from-card via-secondary to-background p-4 shadow-lg shadow-black/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-zinc-200">Reinstall Server</h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        This will reinstall the server with its current configuration
                      </p>
                    </div>
                    <TextureButton
                      variant="secondary"
                      size="sm"
                      onClick={() => setReinstallModalOpen(true)}
                      className="border-red-900/60 text-red-400/80 transition-all hover:border-red-700 hover:text-red-300"
                    >
                      Reinstall
                    </TextureButton>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>

      {/* Save Confirmation Modal */}
      <ConfirmationModal
        open={saveModalOpen}
        onOpenChange={setSaveModalOpen}
        title="Save Settings"
        description="Are you sure you want to save these settings? Some changes may require a server restart to take effect."
        onConfirm={handleSave}
        confirmLabel="Save"
      />

      {/* Reinstall Confirmation Modal */}
      <ConfirmationModal
        open={reinstallModalOpen}
        onOpenChange={setReinstallModalOpen}
        title="Reinstall Server"
        description="Are you sure you want to reinstall this server? This will stop the server and run the installation script again with your current configuration. Existing server files will be preserved but may be overwritten by the installation."
        onConfirm={handleReinstall}
        confirmLabel="Reinstall"
        isLoading={isReinstalling}
      />

      {/* Transfer Server Modal */}
      <Dialog
        open={transferModalOpen}
        onOpenChange={(open) => !isTransferring && setTransferModalOpen(open)}
      >
        <DialogContent
          className={cn(
            "flex max-h-[85vh] flex-col overflow-hidden rounded-lg sm:max-w-5xl",
            "border-zinc-800 bg-zinc-900"
          )}
        >
          <DialogHeader>
            <DialogTitle
              className={cn(
                "flex items-center gap-2 text-lg font-light tracking-wider",
                "text-zinc-100"
              )}
            >
              <BsGlobe className="h-5 w-5" />
              TRANSFER SERVER
            </DialogTitle>
            <DialogDescription className={cn("text-sm", "text-zinc-500")}>
              Select a new location for your server. Latency is measured from your current position.
            </DialogDescription>
          </DialogHeader>

          {isTransferring ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12">
              <Spinner className={cn("h-8 w-8", "text-zinc-400")} />
              <p className={cn("text-sm", "text-zinc-400")}>
                Transferring server to {locations.find((l) => l.id === selectedLocation)?.city}...
              </p>
              <p className={cn("text-xs", "text-zinc-600")}>
                This may take several minutes. Do not close this window.
              </p>
            </div>
          ) : (
            <>
              {/* Current Location */}
              <div className={cn("mb-4 border px-4 py-3", "border-zinc-800 bg-zinc-900/50")}>
                <div className="flex items-center gap-3">
                  <BsGeoAlt className={cn("h-4 w-4", "text-zinc-400")} />
                  <div>
                    <span className={cn("text-[10px] tracking-wider uppercase", "text-zinc-500")}>
                      Current Location
                    </span>
                    <p className={cn("text-sm font-medium", "text-zinc-200")}>
                      {locations.find((l) => l.id === currentLocation)?.flag}{" "}
                      {locations.find((l) => l.id === currentLocation)?.city},{" "}
                      {locations.find((l) => l.id === currentLocation)?.country}
                    </p>
                  </div>
                </div>
              </div>

              {/* Location Grid */}
              <div className="flex-1 space-y-6 overflow-y-auto pr-2">
                {Object.entries(locationsByRegion).map(([region, regionLocations]) => (
                  <div key={region}>
                    <h3
                      className={cn(
                        "sticky top-0 mb-2 py-1 text-[10px] font-medium tracking-wider uppercase",
                        "bg-secondary text-zinc-500"
                      )}
                    >
                      {region}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {regionLocations.map((location) => {
                        const pingData = locationPings.find((p) => p.locationId === location.id);
                        const isCurrentLocation = location.id === currentLocation;
                        const isSelected = location.id === selectedLocation;
                        const hasError = pingData?.status === "error";
                        const isDisabled = isCurrentLocation || hasError;

                        return (
                          <motion.button
                            key={location.id}
                            onClick={() => !isDisabled && setSelectedLocation(location.id)}
                            disabled={isDisabled}
                            className={cn(
                              "relative flex items-center justify-between border px-3 py-2.5 text-left transition-all",
                              isDisabled
                                ? "cursor-not-allowed border-zinc-800 bg-zinc-900/30 opacity-50"
                                : isSelected
                                  ? "border-amber-600 bg-amber-950/30"
                                  : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-600 hover:bg-zinc-800/50"
                            )}
                            whileHover={!isDisabled ? { scale: 1.01 } : undefined}
                            whileTap={!isDisabled ? { scale: 0.99 } : undefined}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-base">{location.flag}</span>
                              <div>
                                <p className={cn("text-sm font-medium", "text-zinc-200")}>
                                  {location.city}
                                </p>
                                <p className={cn("text-[10px]", "text-zinc-500")}>
                                  {location.country}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {pingData?.status === "pending" && (
                                <span className={cn("text-xs", "text-zinc-600")}>--</span>
                              )}
                              {pingData?.status === "pinging" && (
                                <Spinner className={cn("h-3 w-3", "text-zinc-500")} />
                              )}
                              {pingData?.status === "done" && (
                                <span
                                  className={cn("font-mono text-xs", getPingColor(pingData.ping))}
                                >
                                  {pingData.ping}ms
                                </span>
                              )}
                              {pingData?.status === "error" && (
                                <span className={cn("text-xs", "text-red-400")}>Error</span>
                              )}
                              {isSelected && (
                                <BsCheck className={cn("h-4 w-4", "text-amber-400")} />
                              )}
                              {isCurrentLocation && (
                                <span
                                  className={cn(
                                    "text-[10px] tracking-wider uppercase",
                                    "text-zinc-600"
                                  )}
                                >
                                  Current
                                </span>
                              )}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div
                className={cn(
                  "mt-4 flex items-center justify-between border-t pt-4",
                  "border-zinc-800"
                )}
              >
                <TextureButton
                  variant="secondary"
                  size="sm"
                  onClick={startPinging}
                  disabled={isPinging || pingCooldown > 0}
                  className={cn(
                    "gap-2",
                    "border-zinc-700 text-zinc-400 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                  )}
                >
                  <span className="text-xs tracking-wider uppercase">
                    {isPinging
                      ? "Pinging..."
                      : pingCooldown > 0
                        ? `Wait ${pingCooldown}s`
                        : "Refresh Ping"}
                  </span>
                </TextureButton>
                <div className="flex gap-2">
                  <TextureButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setTransferModalOpen(false)}
                    className={cn("border-zinc-700 text-zinc-400 hover:text-zinc-100")}
                  >
                    <span className="text-xs tracking-wider uppercase">Cancel</span>
                  </TextureButton>
                  <TextureButton
                    variant="secondary"
                    size="sm"
                    onClick={handleTransfer}
                    disabled={!selectedLocation}
                    className={cn(
                      "gap-2",
                      "border-amber-700 text-amber-400 hover:border-amber-600 hover:text-amber-300 disabled:opacity-40"
                    )}
                  >
                    <BsGlobe className="h-3 w-3" />
                    <span className="text-xs tracking-wider uppercase">Transfer</span>
                  </TextureButton>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer Confirmation Modal */}
      <ConfirmationModal
        open={transferConfirmOpen}
        onOpenChange={setTransferConfirmOpen}
        title="Confirm Transfer"
        description={`Are you sure you want to transfer this server to ${locations.find((l) => l.id === selectedLocation)?.city}, ${locations.find((l) => l.id === selectedLocation)?.country}? The server will be stopped during the transfer process.`}
        onConfirm={confirmTransfer}
        confirmLabel="Transfer"
      />

      {/* Server Split Modal */}
      <Dialog open={splitModalOpen} onOpenChange={setSplitModalOpen}>
        <DialogContent className={cn("rounded-lg sm:max-w-lg", "border-zinc-800 bg-zinc-900")}>
          <DialogHeader>
            <DialogTitle
              className={cn(
                "flex items-center gap-2 text-lg font-light tracking-wider",
                "text-zinc-100"
              )}
            >
              <BsLayers className="h-5 w-5" />
              SPLIT SERVER
            </DialogTitle>
            <DialogDescription className={cn("text-sm", "text-zinc-500")}>
              Divide this server&apos;s resources into two separate instances.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div
              className={cn(
                "border p-3 text-xs",
                "border-amber-900/50 bg-amber-950/20 text-amber-400/80"
              )}
            >
              Splitting will create a new server with the allocated resources. The original server
              will retain the remaining resources.
            </div>

            {/* CPU Split */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <Label>CPU Allocation</Label>
                <span className={cn("font-mono text-xs", "text-zinc-400")}>
                  {splitResources.cpu}% / {100 - splitResources.cpu}%
                </span>
              </div>
              <Slider
                min={10}
                max={90}
                step={5}
                value={[splitResources.cpu]}
                onValueChange={(value) =>
                  setSplitResources((prev) => ({ ...prev, cpu: value[0] ?? prev.cpu }))
                }
              />
              <div className="mt-2 flex justify-between">
                <span className={cn("text-[10px]", "text-zinc-600")}>New Server</span>
                <span className={cn("text-[10px]", "text-zinc-600")}>This Server</span>
              </div>
            </div>

            {/* Memory Split */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <Label>Memory Allocation</Label>
                <span className={cn("font-mono text-xs", "text-zinc-400")}>
                  {/* @ts-expect-error Server settings type */}
                  {Math.round((settings.memoryLimit * splitResources.memory) / 100)} MB /{" "}
                  {/* @ts-expect-error Server settings type */}
                  {Math.round((settings.memoryLimit * (100 - splitResources.memory)) / 100)} MB
                </span>
              </div>
              <Slider
                min={10}
                max={90}
                step={5}
                value={[splitResources.memory]}
                onValueChange={(value) =>
                  setSplitResources((prev) => ({ ...prev, memory: value[0] ?? prev.memory }))
                }
              />
              <div className="mt-2 flex justify-between">
                <span className={cn("text-[10px]", "text-zinc-600")}>New Server</span>
                <span className={cn("text-[10px]", "text-zinc-600")}>This Server</span>
              </div>
            </div>

            {/* Disk Split */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <Label>Disk Allocation</Label>
                <span className={cn("font-mono text-xs", "text-zinc-400")}>
                  {/* @ts-expect-error Server settings type */}
                  {Math.round((settings.diskLimit ?? 0) / 100)} MB /{" "}
                  {/* @ts-expect-error Server settings type */}
                  {Math.round((settings.diskLimit ?? 0) / 100)} MB
                </span>
              </div>
              <Slider
                min={10}
                max={90}
                step={5}
                value={[splitResources.disk]}
                onValueChange={(value) =>
                  setSplitResources((prev) => ({ ...prev, disk: value[0] ?? prev.disk }))
                }
              />
              <div className="mt-2 flex justify-between">
                <span className={cn("text-[10px]", "text-zinc-600")}>New Server</span>
                <span className={cn("text-[10px]", "text-zinc-600")}>This Server</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <TextureButton
              variant="secondary"
              size="sm"
              onClick={() => setSplitModalOpen(false)}
              className={cn("border-zinc-700 text-zinc-400 hover:text-zinc-100")}
            >
              <span className="text-xs tracking-wider uppercase">Cancel</span>
            </TextureButton>
            <TextureButton
              variant="secondary"
              size="sm"
              onClick={handleSplitServer}
              className={cn("gap-2", "border-zinc-600 text-zinc-300 hover:text-zinc-100")}
            >
              <BsLayers className="h-3 w-3" />
              <span className="text-xs tracking-wider uppercase">Split Server</span>
            </TextureButton>
          </div>
        </DialogContent>
      </Dialog>
    </FadeIn>
  );
};

export default SettingsPage;
