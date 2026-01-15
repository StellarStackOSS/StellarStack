"use client";

import { useState } from "react";
import { usePathname, useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@workspace/ui/components/sidebar";
import {
  ServerIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  UsersIcon,
  FolderIcon,
  DatabaseIcon,
  ActivityIcon,
  NetworkIcon,
  ArchiveIcon,
  CalendarIcon,
  PlayIcon,
  ArrowLeftIcon,
  UserIcon,
  LogOutIcon,
  BellIcon,
  ChevronUpIcon,
  ShieldIcon,
  WebhookIcon,
  SplitIcon,
} from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { WaveText } from "@/components/wave-text";
import { useServer } from "@/components/server-provider";
import { useServerWebSocket } from "@/hooks/useServerWebSocket";
import { CpuIcon, HardDriveIcon, MemoryStickIcon } from "lucide-react";
import { TextureButton } from "@workspace/ui/components/texture-button";
import { BsArrowLeft } from "react-icons/bs";

// Navigation items - href will be prefixed with /servers/[id]
const navItems = [
  { title: "Overview", icon: <img src={"/icons/24-rect-layout-grid.svg"} />, href: "/overview" },
  { title: "Files", icon: <img src={"/icons/24-folder.svg"} />, href: "/files" },
  { title: "Backups", icon: <img src={"/icons/24-folders.svg"} />, href: "/backups" },
  { title: "Schedules", icon: <img src={"/icons/24-calendar.svg"} />, href: "/schedules" },
  { title: "Users", icon: <img src={"/icons/24-users.svg"} />, href: "/users" },
  { title: "Databases", icon: <img src={"/icons/24-storage.svg"} />, href: "/databases" },
  { title: "Network", icon: <img src={"/icons/24-connect.svg"} />, href: "/network" },
  { title: "Webhooks", icon: <img src={"/icons/24-circle-power-off.svg"} />, href: "/webhooks" },
  { title: "Split", icon: <img src={"/icons/24-circle-power-off.svg"} />, href: "/split" },
  { title: "Activity", icon: <img src={"/icons/24-circle-power-off.svg"} />, href: "/activity" },
  { title: "Startup", icon: <img src={"/icons/24-circle-power-off.svg"} />, href: "/startup" },
  { title: "Settings", icon: <img src={"/icons/24-circle-power-off.svg"} />, href: "/settings" },
];

interface AppSidebarProps {
  isDark?: boolean;
}

export const AppSidebar = ({ isDark = true }: AppSidebarProps) => {
  const pathname = usePathname();
  const params = useParams();
  const serverId = params.id as string;
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { user: authUser, signOut, isAdmin } = useAuth();
  const { server, consoleInfo } = useServer();

  const { stats: statsData } = useServerWebSocket({
    consoleInfo,
    enabled: !!consoleInfo,
  });

  /*TODO: This can be extracted into it's own function */
  const stats = statsData.current;
  const cpuPercent = stats?.cpu_absolute ?? 0;
  const cpuLimit = server?.cpu ?? 100;

  const memUsed = stats?.memory_bytes ? stats.memory_bytes / (1024 * 1024 * 1024) : 0;
  const memLimit = server?.memory ? server.memory / 1024 : 1;
  const memPercent = memLimit > 0 ? (memUsed / memLimit) * 100 : 0;

  const diskUsed = stats?.disk_bytes ? stats.disk_bytes / (1024 * 1024 * 1024) : 0;
  const diskLimit = server?.disk ? server.disk / 1024 : 10;
  const diskPercent = diskLimit > 0 ? (diskUsed / diskLimit) * 100 : 0;

  const getUsageColor = (percent: number) => {
    if (percent >= 85) return isDark ? "text-red-400" : "text-red-600";
    if (percent >= 70) return isDark ? "text-amber-400" : "text-amber-600";
    return isDark ? "text-emerald-400" : "text-emerald-600";
  };

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

  const userMenuItems = [
    { title: "Account Settings", icon: UserIcon, href: "/account" },
    { title: "Notifications", icon: BellIcon, href: "/account/notifications" },
    ...(isAdmin ? [{ title: "Admin Panel", icon: ShieldIcon, href: "/admin" }] : []),
  ];

  const getFullHref = (href: string) => `/servers/${serverId}${href}`;

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Sidebar
      className={cn(
        "border-r shadow-lg",
        isDark
          ? "border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-black/20"
          : "border-zinc-300 bg-gradient-to-b from-white via-zinc-50 to-zinc-100 shadow-zinc-400/20"
      )}
    >
      <SidebarHeader
        className={cn("border-b p-4", isDark ? "border-zinc-200/10" : "border-zinc-300")}
      >
        <TextureButton variant="minimal">
          <Link href="/servers" className="flex flex-row gap-2">
            <BsArrowLeft className="h-4 w-4" />
            <span className="text-xs font-medium tracking-wider uppercase">All Servers</span>
          </Link>
        </TextureButton>

        {/* Current Server Display */}
        <div
          className={cn(
            "mt-3 flex items-center gap-2 px-3 py-2",
            isDark ? "text-zinc-300" : "text-zinc-700"
          )}
        >
          <ServerIcon
            className={cn("h-4 w-4 shrink-0", isDark ? "text-zinc-500" : "text-zinc-400")}
          />
          <span className="truncate text-xs font-medium tracking-wider uppercase">
            Server {serverId}
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel
            className={cn(
              "px-2 text-[10px] font-medium tracking-wider uppercase",
              isDark ? "text-zinc-600" : "text-zinc-400"
            )}
          >
            Manage
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const fullHref = getFullHref(item.href);
                const isActive = pathname === fullHref || pathname.startsWith(fullHref + "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "text-xs transition-colors",
                        isDark
                          ? "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100 data-[active=true]:bg-zinc-800/80 data-[active=true]:text-zinc-100"
                          : "text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 data-[active=true]:bg-zinc-200/80 data-[active=true]:text-zinc-900"
                      )}
                    >
                      <Link href={fullHref}>
                        {item.icon}
                        <span
                          className={
                            isActive
                              ? "ml-2 uppercase opacity-100 hover:opacity-100"
                              : "ml-2 uppercase opacity-50 hover:opacity-100"
                          }
                        >
                          {item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter
        className={cn("border-t p-4", isDark ? "border-zinc-200/10" : "border-zinc-300")}
      >
        {/* Server Stats */}
        <div
          className={cn(
            "mb-3 space-y-2 border px-3 py-2",
            isDark ? "border-zinc-700/50 bg-zinc-900/50" : "border-zinc-200 bg-white"
          )}
        >
          {/* CPU */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CpuIcon
                className={cn("h-3.5 w-3.5 shrink-0", isDark ? "text-zinc-500" : "text-zinc-400")}
              />
              <span
                className={cn(
                  "text-[10px] font-medium tracking-wider uppercase",
                  isDark ? "text-zinc-400" : "text-zinc-600"
                )}
              >
                CPU
              </span>
            </div>
            <span className={cn("text-[10px] font-medium tabular-nums", getUsageColor(cpuPercent))}>
              {cpuPercent.toFixed(0)}%
            </span>
          </div>

          {/* Memory */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MemoryStickIcon
                className={cn("h-3.5 w-3.5 shrink-0", isDark ? "text-zinc-500" : "text-zinc-400")}
              />
              <span
                className={cn(
                  "text-[10px] font-medium tracking-wider uppercase",
                  isDark ? "text-zinc-400" : "text-zinc-600"
                )}
              >
                RAM
              </span>
            </div>
            <span className={cn("text-[10px] font-medium tabular-nums", getUsageColor(memPercent))}>
              {memUsed.toFixed(1)} / {memLimit.toFixed(0)} GB
            </span>
          </div>

          {/* Disk */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <HardDriveIcon
                className={cn("h-3.5 w-3.5 shrink-0", isDark ? "text-zinc-500" : "text-zinc-400")}
              />
              <span
                className={cn(
                  "text-[10px] font-medium tracking-wider uppercase",
                  isDark ? "text-zinc-400" : "text-zinc-600"
                )}
              >
                Disk
              </span>
            </div>
            <span
              className={cn("text-[10px] font-medium tabular-nums", getUsageColor(diskPercent))}
            >
              {diskUsed.toFixed(1)} / {diskLimit.toFixed(0)} GB
            </span>
          </div>
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className={cn(
              "group relative flex w-full items-center gap-3 border px-3 py-2 text-left transition-colors",
              isDark
                ? "border-zinc-700/50 bg-zinc-900/50 hover:border-zinc-500"
                : "border-zinc-200 bg-white hover:border-zinc-400"
            )}
          >
            {/* Avatar */}
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center text-xs font-medium uppercase",
                isDark
                  ? "border border-zinc-700 bg-zinc-800 text-zinc-300"
                  : "border border-zinc-300 bg-zinc-200 text-zinc-700"
              )}
            >
              {user.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "truncate text-xs font-medium",
                  isDark ? "text-zinc-200" : "text-zinc-800"
                )}
              >
                {user.name}
              </div>
              <div
                className={cn("truncate text-[10px]", isDark ? "text-zinc-500" : "text-zinc-500")}
              >
                {user.email}
              </div>
            </div>
            <ChevronUpIcon
              className={cn(
                "h-4 w-4 shrink-0 transition-transform",
                isDark ? "text-zinc-500" : "text-zinc-400",
                isUserMenuOpen && "rotate-180"
              )}
            />
          </button>

          {/* User Dropdown Menu */}
          {isUserMenuOpen && (
            <div
              className={cn(
                "absolute right-0 bottom-full left-0 z-50 mb-1 border shadow-lg",
                isDark
                  ? "border-zinc-700/50 bg-[#0f0f0f] shadow-black/40"
                  : "border-zinc-200 bg-white shadow-zinc-200/40"
              )}
            >
              {userMenuItems.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  onClick={() => setIsUserMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-xs transition-colors",
                    isDark ? "text-zinc-300 hover:bg-zinc-800" : "text-zinc-700 hover:bg-zinc-100"
                  )}
                >
                  <item.icon
                    className={cn("h-4 w-4", isDark ? "text-zinc-500" : "text-zinc-400")}
                  />
                  <span className="tracking-wider uppercase">{item.title}</span>
                </Link>
              ))}

              {/* Divider */}
              <div
                className={cn("my-1 border-t", isDark ? "border-zinc-700/50" : "border-zinc-200")}
              />

              {/* Sign Out */}
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  handleSignOut();
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                  isDark ? "text-red-400/80 hover:bg-zinc-800" : "text-red-600 hover:bg-zinc-100"
                )}
              >
                <LogOutIcon className="h-4 w-4" />
                <span className="tracking-wider uppercase">Sign Out</span>
              </button>
            </div>
          )}
        </div>

        {/* Version */}
        <div
          className={cn(
            "mt-3 text-center text-[10px] tracking-wider uppercase",
            isDark ? "text-zinc-600" : "text-zinc-400"
          )}
        >
          <WaveText
            text={`StellarStack v${process.env.NEXT_PUBLIC_GIT_COMMIT_HASH?.slice(0, 7) || "dev"}-alpha`}
            baseClassName={isDark ? "text-zinc-600" : "text-zinc-400"}
            highlightClassName={isDark ? "text-zinc-100" : "text-zinc-800"}
          />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};
