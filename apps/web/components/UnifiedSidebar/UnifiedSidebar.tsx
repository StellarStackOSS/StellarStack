"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar, {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@stellarUI/components/Sidebar/Sidebar";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@stellarUI/components/Command/Command";
import DropdownMenu, {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@stellarUI/components/DropdownMenu/DropdownMenu";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Cpu,
  LayoutDashboard,
  MapPin,
  Package,
  Puzzle,
  Plus,
  Server,
  Settings,
  Shield,
  User,
  Users,
} from "lucide-react";
import {
  GridIcon,
  Folder01Icon,
  FolderCloudIcon,
  Calendar01Icon,
  UserMultiple02Icon,
  DatabaseIcon,
  Wifi01Icon,
  Notification02Icon,
  ArrowMoveDownRightIcon,
  ListViewIcon,
  PowerServiceIcon,
  Settings01Icon,
  ArrowLeft01Icon,
  Logout01Icon,
  Search01Icon,
  PuzzleIcon,
} from "hugeicons-react";
import { cn } from "@stellarUI/lib/Utils";
import { useAuth } from "@/hooks/AuthProvider/AuthProvider";
import { TextureButton } from "@stellarUI/components/TextureButton";
import { AnimatePresence, motion } from "framer-motion";
import { useServer } from "components/ServerStatusPages/ServerProvider/ServerProvider";
import { useServerWebSocket } from "@/hooks/UseServerWebSocket";
import { WaveText } from "@stellarUI/components/WaveText/WaveText";
import { useServers } from "@/hooks/queries/UseServers";
import { useBackups } from "@/hooks/queries/UseBackups";
import { useSchedules } from "@/hooks/queries/UseSchedules";

type SidebarVariant = "account" | "admin" | "app";

const accountNavItems = [
  { title: "Account Settings", icon: User, href: "/account" },
  { title: "Notifications", icon: Bell, href: "/account/notifications" },
];

const adminNavItems = [
  { title: "Overview", icon: LayoutDashboard, href: "/admin" },
  { title: "Nodes", icon: Cpu, href: "/admin/nodes" },
  { title: "Locations", icon: MapPin, href: "/admin/locations" },
  { title: "Servers", icon: Server, href: "/admin/servers" },
  { title: "Blueprints", icon: Package, href: "/admin/blueprints" },
  { title: "Users", icon: Users, href: "/admin/users" },
  { title: "Extensions", icon: Puzzle, href: "/admin/plugins" },
  { title: "Settings", icon: Settings, href: "/admin/settings" },
];

export const appNavItems = [
  { title: "Overview", icon: GridIcon, href: "/overview" },
  { title: "Files", icon: Folder01Icon, href: "/files" },
  { title: "Backups", icon: FolderCloudIcon, href: "/backups" },
  { title: "Schedules", icon: Calendar01Icon, href: "/schedules" },
  { title: "Users", icon: UserMultiple02Icon, href: "/users" },
  { title: "Databases", icon: DatabaseIcon, href: "/databases" },
  { title: "Network", icon: Wifi01Icon, href: "/network" },
  { title: "Webhooks", icon: Notification02Icon, href: "/webhooks" },
  { title: "Split", icon: ArrowMoveDownRightIcon, href: "/split" },
  {
    title: "Activity",
    icon: ListViewIcon,
    href: "/activity",
  },
  {
    title: "Startup",
    icon: PowerServiceIcon,
    href: "/startup",
  },
  { title: "Extensions", icon: PuzzleIcon, href: "/plugins" },
  { title: "Settings", icon: Settings01Icon, href: "/settings" },
];

export const renderVersion = () => {
  const version = `StellarStack V${process.env.NEXT_PUBLIC_GIT_COMMIT_HASH?.slice(0, 7) || "dev"}-alpha`;

  return (
    <WaveText text={version} baseClassName={"text-zinc-600"} highlightClassName={"text-zinc-100"} />
  );
};

const ServerStatsContent = () => {
  const { consoleInfo } = useServer();
  const { stats: statsData } = useServerWebSocket({
    consoleInfo,
    enabled: !!consoleInfo,
  });

  const cpuPercent = statsData.current ? (statsData.current.cpu_absolute / 100) * 100 : 0;
  const memPercent = statsData.current ? (statsData.current.memory_bytes / 34359738368) * 100 : 0;

  return (
    <>
      {statsData.current && (
        <div className={cn("space-y-2 px-3 py-2 font-mono text-xs")}>
          <div className="flex items-center justify-between text-xs">
            <span className={"text-zinc-500"}>CPU</span>
            <span className={"font-bold text-zinc-300"}>{cpuPercent.toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className={"text-zinc-500"}>RAM</span>
            <span className={"font-bold text-zinc-300"}>{memPercent.toFixed(1)}%</span>
          </div>
        </div>
      )}
    </>
  );
};

// Nav item component with hover highlight animation
interface NavItemProps {
  item: { title: string; icon: React.ComponentType<{ className: string }>; href: string };
  fullHref: string;
  isActive: boolean;
  variant: SidebarVariant;
  isHighlighted: boolean;
  onHover: (title: string | null) => void;
  badge?: string;
}

const NavItem = ({
  item,
  fullHref,
  isActive,
  variant,
  isHighlighted,
  onHover,
  badge,
}: NavItemProps) => {
  const Icon = item.icon;

  return (
    <SidebarMenuItem
      className={variant === "app" ? "relative" : ""}
      onMouseEnter={() => onHover(item.title)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Active item highlight - animates when navigating */}
      {variant === "app" && isActive && (
        <motion.div
          layoutId="sidebar-active-item"
          className="absolute inset-0 rounded-md bg-zinc-800/80"
          transition={{
            type: "spring",
            stiffness: 380,
            damping: 30,
          }}
        />
      )}
      {/* Hover highlight - fades in/out, only shows when not active */}
      <AnimatePresence>
        {variant === "app" && isHighlighted && !isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 rounded-md bg-zinc-800/60"
          />
        )}
      </AnimatePresence>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={item.title}
        className={cn(
          "text-xs transition-colors",
          variant === "app"
            ? "relative z-10 text-zinc-400 hover:bg-transparent hover:text-zinc-100 data-[active=true]:text-zinc-100"
            : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100 data-[active=true]:bg-zinc-800/80 data-[active=true]:text-zinc-100"
        )}
      >
        <Link href={fullHref}>
          <Icon className="h-4 w-4" />
          <span
            className={cn(
              variant === "app" ? "ml-2 tracking-wider uppercase" : "uppercase",
              isActive ? "opacity-100" : "opacity-50 hover:opacity-100"
            )}
          >
            {item.title}
          </span>
          {badge && (
            <span className="text-accent ml-auto font-mono text-[10px] opacity-70">{badge}</span>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

export const UnifiedSidebar = () => {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const serverId = (params.id as string) || "";
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const { user: authUser, signOut, isAdmin } = useAuth();

  // Command+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = useCallback((command: () => void) => {
    setCommandOpen(false);
    command();
  }, []);

  const variant: SidebarVariant = pathname.startsWith("/account")
    ? "account"
    : pathname.startsWith("/admin")
      ? "admin"
      : "app";

  // Fetch backup and schedule counts for badge display (app variant only)
  const { data: backups = [] } = useBackups(variant === "app" ? serverId : undefined);
  const { data: schedulesList = [] } = useSchedules(variant === "app" ? serverId : undefined);

  const user = authUser
    ? {
        name: authUser.name || "User",
        email: authUser.email,
        initials: (authUser.name || "U").slice(0, 2).toUpperCase(),
      }
    : {
        name: "Guest",
        email: "",
        initials: "G",
      };

  const handleSignOut = async () => {
    await signOut();
  };

  const renderHeader = () => {
    if (variant === "account") {
      return (
        <TextureButton variant="minimal" className="w-full">
          <Link href="/servers" className="flex flex-row gap-2">
            <Server className={cn("h-4 w-4 shrink-0 text-zinc-500")} />
            <span className="text-xs font-medium tracking-wider uppercase">My Servers</span>
          </Link>
        </TextureButton>
      );
    }

    if (variant === "admin") {
      return (
        <>
          <TextureButton variant="minimal" className="w-full">
            <Link href="/servers" className="flex flex-row gap-2">
              <ArrowLeft01Icon className="h-4 w-4" />
              <span className="text-xs font-medium tracking-wider uppercase">Back to Panel</span>
            </Link>
          </TextureButton>
          <div className={cn("mt-3 flex items-center gap-2 px-3 py-2 text-zinc-300")}>
            <Shield className={cn("h-4 w-4 shrink-0 text-amber-500")} />
            <span className="text-xs font-medium tracking-wider uppercase">Admin Panel</span>
          </div>
        </>
      );
    }

    return null;
  };

  const renderNavItems = () => {
    let items;
    let groupLabel;

    if (variant === "account") {
      items = accountNavItems;
      groupLabel = "Account";
    } else if (variant === "admin") {
      items = adminNavItems;
      groupLabel = "Management";
    } else {
      items = appNavItems;
      groupLabel = "Manage";
    }

    const getFullHref = (href: string) => {
      if (variant === "app") return `/servers/${serverId}${href}`;
      return href;
    };

    // Compute badges for app variant nav items
    const getBadge = (title: string): string | undefined => {
      if (variant !== "app") return undefined;
      if (title === "Backups") {
        const completedCount = backups.filter((b) => b.status === "COMPLETED").length;
        const limit = currentServer?.backupLimit ?? 0;
        return `${completedCount}/${limit}`;
      }
      if (title === "Schedules") {
        return `${schedulesList.length}`;
      }
      return undefined;
    };

    return (
      <SidebarGroup>
        <SidebarGroupLabel
          className={cn("px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase")}
        >
          {groupLabel}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => {
              const fullHref = getFullHref(item.href);
              const isActive =
                variant === "admin"
                  ? pathname === fullHref ||
                    (fullHref !== "/admin" && pathname.startsWith(fullHref))
                  : pathname === fullHref || pathname.startsWith(fullHref + "/");

              // Show highlight only on hovered item
              const isHighlighted = hoveredItem === item.title;

              return (
                <NavItem
                  key={item.title}
                  item={item}
                  fullHref={fullHref}
                  isActive={isActive}
                  variant={variant}
                  isHighlighted={isHighlighted}
                  onHover={setHoveredItem}
                  badge={getBadge(item.title)}
                />
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  const renderUserMenuItems = () => {
    const baseItems = [];

    if (variant === "admin") {
      baseItems.push({
        title: "Account Settings",
        icon: User,
        href: "/account",
      });
    }

    if (variant === "app") {
      baseItems.push(
        { title: "Account Settings", icon: User, href: "/account" },
        { title: "Notifications", icon: Bell, href: "/account/notifications" }
      );
      if (isAdmin) {
        baseItems.push({ title: "Admin Panel", icon: Shield, href: "/admin" });
      }
    }

    return baseItems;
  };

  const userMenuItems = renderUserMenuItems();

  // Fetch all servers for the dropdown
  const { data: serversList = [] } = useServers();
  const { server: currentServer } = variant === "app" ? useServer() : { server: null };

  return (
    <Sidebar className={cn("")}>
      {/* Logo / Server Switcher Area */}
      {variant === "app" ? (
        <div className="flex items-center justify-between border-b border-zinc-200/10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center justify-between gap-2 px-4 py-4 text-left transition-colors outline-none hover:bg-zinc-800/50 focus:outline-none focus-visible:outline-none">
                <div className="flex items-center gap-2 overflow-hidden">
                  <img src="/logo_small_white.png" alt="logo" className="h-5 w-5 min-w-5" />
                  <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm font-medium text-zinc-200">
                      {currentServer?.name || "Select Server"}
                    </span>
                    <span className="truncate text-[10px] text-zinc-500">
                      {currentServer?.status || ""}
                    </span>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 group-data-[collapsible=icon]:hidden" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="bottom"
              sideOffset={0}
              style={{ width: "var(--radix-dropdown-menu-trigger-width)" }}
              className="bg-secondary border-zinc-700/50 shadow-xl shadow-black/50"
            >
              <DropdownMenuLabel className="px-3 py-2 text-[10px] font-medium tracking-wider text-zinc-500 uppercase">
                Switch Server
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-800/50" />
              <div className="max-h-64 overflow-y-auto py-1">
                {serversList.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => router.push(`/servers/${s.id}/overview`)}
                    className={cn(
                      "mx-1 cursor-pointer rounded-md px-2 py-2 text-sm text-zinc-300 outline-none focus:bg-zinc-800 focus:text-zinc-100 focus:outline-none",
                      s.id === serverId && "bg-zinc-800/80 text-zinc-100"
                    )}
                  >
                    <Server className="mr-2 h-4 w-4 shrink-0 text-zinc-500" />
                    <span className="truncate">{s.name}</span>
                  </DropdownMenuItem>
                ))}
              </div>
              <DropdownMenuSeparator className="bg-zinc-800/50" />
              <DropdownMenuItem
                onClick={() => router.push("/servers")}
                className="mx-1 mb-1 cursor-pointer rounded-md px-2 py-2 text-sm text-zinc-400 outline-none focus:bg-zinc-800 focus:text-zinc-100 focus:outline-none"
              >
                <Plus className="mr-2 h-4 w-4 shrink-0" />
                <span>All Servers</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <SidebarTrigger className="mr-3 shrink-0 text-zinc-400 transition-all group-data-[collapsible=icon]:hidden hover:scale-110 hover:text-zinc-100 active:scale-95" />
        </div>
      ) : (
        <>
          <div className="flex w-full flex-row items-center justify-between gap-2 px-4 py-4">
            <div className="text-md flex flex-row items-center gap-2 text-zinc-200">
              <img src="/logo_small_white.png" alt="logo" className="h-5 w-5 min-w-5" />
              <span className="group-data-[collapsible=icon]:hidden">StellarStack</span>
            </div>
            <SidebarTrigger className="text-zinc-400 transition-all hover:scale-110 hover:text-zinc-100 active:scale-95" />
          </div>
          <SidebarHeader className={cn("border-b border-zinc-200/10 p-4")}>
            {renderHeader()}
          </SidebarHeader>
        </>
      )}

      {variant === "app" && (
        <div className="w-full px-4 py-3 group-data-[collapsible=icon]:hidden">
          <button
            onClick={() => setCommandOpen(true)}
            className={cn(
              "flex h-9 w-full items-center justify-between rounded-md border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-400"
            )}
          >
            <div className="flex items-center gap-2">
              <Search01Icon className="h-4 w-4" />
              <span>Search...</span>
            </div>
            <kbd className="pointer-events-none flex h-5 items-center gap-0.5 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium text-zinc-400 select-none">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>
      )}

      <SidebarContent>{renderNavItems()}</SidebarContent>

      <SidebarFooter
        className={cn(
          "border-t border-zinc-200/10 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:p-2"
        )}
      >
        {variant === "app" && (
          <div className="group-data-[collapsible=icon]:hidden">
            <ServerStatsContent />
          </div>
        )}

        <div className="relative">
          <TextureButton
            variant="ghost"
            className="flex w-full flex-row justify-between p-0 text-start group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:justify-center"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-xs font-medium text-zinc-300 uppercase"
              )}
            >
              {user.initials}
            </div>
            <div className="flex-1 group-data-[collapsible=icon]:hidden">
              <div className={cn("truncate text-xs font-medium text-zinc-200")}>{user.name}</div>
              <div className={cn("truncate text-[10px] text-zinc-500")}>{user.email}</div>
            </div>
            <ChevronUp
              className={cn(
                "h-4 w-4 shrink-0 text-zinc-500 transition-transform group-data-[collapsible=icon]:hidden",
                isUserMenuOpen && "rotate-180"
              )}
            />
          </TextureButton>

          <AnimatePresence>
            {isUserMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15, ease: "easeInOut" }}
                className={cn(
                  "bg-secondary absolute right-0 bottom-[120%] left-0 z-50 mb-1 rounded-lg border border-zinc-700/50 shadow-lg shadow-black/40"
                )}
              >
                <div>
                  {userMenuItems.map((item) => (
                    <Link
                      key={item.title}
                      href={item.href}
                      onClick={() => setIsUserMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
                      )}
                    >
                      <item.icon className={cn("h-4 w-4 text-zinc-500")} />
                      <span className="tracking-wider uppercase">{item.title}</span>
                    </Link>
                  ))}

                  {userMenuItems.length > 0 && (
                    <div className={cn("my-1 border-t border-zinc-700/50")} />
                  )}

                  <div className="p-2">
                    <TextureButton
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        handleSignOut();
                      }}
                    >
                      <Logout01Icon className="h-4 w-4" />
                      <span className="tracking-wider uppercase">Sign Out</span>
                    </TextureButton>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div
          className={cn(
            "mt-3 text-center text-[10px] tracking-wider text-zinc-600 uppercase group-data-[collapsible=icon]:hidden"
          )}
        >
          {renderVersion()}
        </div>
      </SidebarFooter>

      {/* Command Palette */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Type a command or search..." className="text-zinc-200" />
        <CommandList className="border-t border-zinc-800">
          <CommandEmpty className="text-zinc-500">No results found.</CommandEmpty>

          {variant === "app" && (
            <CommandGroup heading="Navigation" className="text-zinc-400">
              {appNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    onSelect={() =>
                      runCommand(() => router.push(`/servers/${serverId}${item.href}`))
                    }
                    className="text-zinc-300 aria-selected:bg-zinc-800 aria-selected:text-zinc-100"
                  >
                    <Icon className="h-4 w-4 text-zinc-500" />
                    <span>{item.title}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {variant === "admin" && (
            <CommandGroup heading="Admin" className="text-zinc-400">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    onSelect={() => runCommand(() => router.push(item.href))}
                    className="text-zinc-300 aria-selected:bg-zinc-800 aria-selected:text-zinc-100"
                  >
                    <Icon className="h-4 w-4 text-zinc-500" />
                    <span>{item.title}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          <CommandGroup heading="Quick Actions" className="text-zinc-400">
            <CommandItem
              onSelect={() => runCommand(() => router.push("/servers"))}
              className="text-zinc-300 aria-selected:bg-zinc-800 aria-selected:text-zinc-100"
            >
              <Server className="h-4 w-4 text-zinc-500" />
              <span>All Servers</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/account"))}
              className="text-zinc-300 aria-selected:bg-zinc-800 aria-selected:text-zinc-100"
            >
              <User className="h-4 w-4 text-zinc-500" />
              <span>Account Settings</span>
            </CommandItem>
            {isAdmin && (
              <CommandItem
                onSelect={() => runCommand(() => router.push("/admin"))}
                className="text-zinc-300 aria-selected:bg-zinc-800 aria-selected:text-zinc-100"
              >
                <Shield className="h-4 w-4 text-zinc-500" />
                <span>Admin Panel</span>
              </CommandItem>
            )}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </Sidebar>
  );
};
