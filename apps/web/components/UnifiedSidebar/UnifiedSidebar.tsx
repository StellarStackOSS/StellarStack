"use client";

import { useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar";
import {
  BellIcon,
  ChevronUpIcon,
  CpuIcon,
  HardDriveIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MapPinIcon,
  MemoryStickIcon,
  PackageIcon,
  ServerIcon,
  SettingsIcon,
  ShieldIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { useAuth } from "hooks/auth-provider";
import { TextureButton } from "@workspace/ui/components/texture-button";
import { BsArrowLeft } from "react-icons/bs";
import { motion } from "framer-motion";
import { WaveText } from "@/components/wave-text";
import { useServer } from "components/ServerStatusPages/server-provider";
import { useServerWebSocket } from "@/hooks/useServerWebSocket";

type SidebarVariant = "account" | "admin" | "app";

const accountNavItems = [
  { title: "Account Settings", icon: UserIcon, href: "/account" },
  { title: "Notifications", icon: BellIcon, href: "/account/notifications" },
];

const adminNavItems = [
  { title: "Overview", icon: LayoutDashboardIcon, href: "/admin" },
  { title: "Nodes", icon: CpuIcon, href: "/admin/nodes" },
  { title: "Locations", icon: MapPinIcon, href: "/admin/locations" },
  { title: "Servers", icon: ServerIcon, href: "/admin/servers" },
  { title: "Blueprints", icon: PackageIcon, href: "/admin/blueprints" },
  { title: "Users", icon: UsersIcon, href: "/admin/users" },
  { title: "Settings", icon: SettingsIcon, href: "/admin/settings" },
];

const appNavItems = [
  { title: "Overview", icon: <img alt="icon" src="/icons/24-grid-2.svg" />, href: "/overview" },
  { title: "Files", icon: <img alt="icon" src="/icons/24-folder.svg" />, href: "/files" },
  { title: "Backups", icon: <img alt="icon" src="/icons/24-folders.svg" />, href: "/backups" },
  { title: "Schedules", icon: <img alt="icon" src="/icons/24-calendar.svg" />, href: "/schedules" },
  { title: "Users", icon: <img alt="icon" src="/icons/24-users.svg" />, href: "/users" },
  { title: "Databases", icon: <img alt="icon" src="/icons/24-storage.svg" />, href: "/databases" },
  { title: "Network", icon: <img alt="icon" src="/icons/24-connect.svg" />, href: "/network" },
  { title: "Webhooks", icon: <img alt="icon" src="/icons/24-bell.svg" />, href: "/webhooks" },
  { title: "Split", icon: <img alt="icon" src="/icons/24-move-down-right.svg" />, href: "/split" },
  { title: "Activity", icon: <img alt="icon" src="/icons/24-bullet-list.svg" />, href: "/activity" },
  { title: "Startup", icon: <img alt="icon" src="/icons/24-circle-power-off.svg" />, href: "/startup" },
  { title: "Settings", icon: <img alt="icon" src="/icons/24-gear.svg" />, href: "/settings" },
];

interface UnifiedSidebarProps {
  isDark?: boolean;
}

const ServerStatsContent = ({ isDark }: { isDark: boolean }) => {
  const { server, consoleInfo } = useServer();
  const { stats: statsData } = useServerWebSocket({
    consoleInfo,
    enabled: !!consoleInfo,
  });

  const cpuPercent = statsData.current ? (statsData.current.cpu_absolute / 100) * 100 : 0;
  const memPercent = statsData.current
    ? (statsData.current.memory_bytes / 34359738368) * 100
    : 0;

  return (
    <>
      {statsData.current && (
        <div
          className={cn(
            "space-y-2 border-t px-3 py-2",
            isDark ? "border-zinc-800" : "border-zinc-200"
          )}
        >
          <div className="flex items-center justify-between text-xs">
            <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>CPU</span>
            <span className={isDark ? "text-zinc-300" : "text-zinc-600"}>{cpuPercent.toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>RAM</span>
            <span className={isDark ? "text-zinc-300" : "text-zinc-600"}>{memPercent.toFixed(1)}%</span>
          </div>
        </div>
      )}
    </>
  );
};

export const UnifiedSidebar = ({ isDark = true }: UnifiedSidebarProps) => {
  const pathname = usePathname();
  const params = useParams();
  const serverId = (params.id as string) || "";
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { user: authUser, signOut, isAdmin } = useAuth();

  const variant: SidebarVariant = pathname.startsWith("/account")
    ? "account"
    : pathname.startsWith("/admin")
      ? "admin"
      : "app";

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
        <Link
          href="/servers"
          className={cn(
            "group relative flex w-full items-center gap-2 border px-3 py-2 text-left transition-colors",
            isDark
              ? "border-zinc-700/50 bg-zinc-900/50 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
              : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-800"
          )}
        >
          <ServerIcon
            className={cn("h-4 w-4 shrink-0", isDark ? "text-zinc-500" : "text-zinc-400")}
          />
          <span className="text-xs font-medium tracking-wider uppercase">My Servers</span>
          <div
            className={cn(
              "pointer-events-none absolute top-0 left-0 h-1.5 w-1.5 border-t border-l",
              isDark ? "border-zinc-600" : "border-zinc-300"
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute top-0 right-0 h-1.5 w-1.5 border-t border-r",
              isDark ? "border-zinc-600" : "border-zinc-300"
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute bottom-0 left-0 h-1.5 w-1.5 border-b border-l",
              isDark ? "border-zinc-600" : "border-zinc-300"
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute right-0 bottom-0 h-1.5 w-1.5 border-r border-b",
              isDark ? "border-zinc-600" : "border-zinc-300"
            )}
          />
        </Link>
      );
    }

    if (variant === "admin") {
      return (
        <>
          <TextureButton>
            <Link href="/servers" className="flex flex-row gap-2">
              <BsArrowLeft className="h-4 w-4" />
              <span className="text-xs font-medium tracking-wider uppercase">Back to Panel</span>
            </Link>
          </TextureButton>
          <div
            className={cn(
              "mt-3 flex items-center gap-2 px-3 py-2",
              isDark ? "text-zinc-300" : "text-zinc-700"
            )}
          >
            <ShieldIcon
              className={cn("h-4 w-4 shrink-0", isDark ? "text-amber-500" : "text-amber-600")}
            />
            <span className="text-xs font-medium tracking-wider uppercase">Admin Panel</span>
          </div>
        </>
      );
    }

    return (
      <>
        <TextureButton variant="minimal">
          <Link href="/servers" className="flex flex-row gap-2">
            <BsArrowLeft className="h-4 w-4" />
            <span className="text-xs font-medium tracking-wider uppercase">All Servers</span>
          </Link>
        </TextureButton>
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
      </>
    );
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

    return (
      <SidebarGroup>
        <SidebarGroupLabel
          className={cn(
            "px-2 text-[10px] font-medium tracking-wider uppercase",
            isDark ? "text-zinc-600" : "text-zinc-400"
          )}
        >
          {groupLabel}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => {
              const fullHref = getFullHref(item.href);
              const isActive =
                variant === "admin"
                  ? pathname === fullHref || (fullHref !== "/admin" && pathname.startsWith(fullHref))
                  : pathname === fullHref || pathname.startsWith(fullHref + "/");

              return (
                <SidebarMenuItem
                  key={item.title}
                  className={variant === "app" ? "relative" : ""}
                >
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
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className={cn(
                      "rounded-none text-xs transition-colors",
                      variant === "app"
                        ? "relative z-10 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100 data-[active=true]:text-zinc-100"
                        : isDark
                          ? "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100 data-[active=true]:bg-zinc-800/80 data-[active=true]:text-zinc-100"
                          : "text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 data-[active=true]:bg-zinc-200/80 data-[active=true]:text-zinc-900"
                    )}
                  >
                    <Link href={fullHref}>
                      {variant === "app" ? (
                        <span className="w-5">{item.icon as any}</span>
                      ) :
                        (() => {
                          const Icon = item.icon as React.ComponentType<{ className: string }>;
                          return <Icon className="h-4 w-4" />;
                        })()
                      }
                      <span
                        className={cn(
                          variant === "app" ? "ml-2 tracking-wider uppercase" : "uppercase",
                          isActive ? "opacity-100" : "opacity-50 hover:opacity-100"
                        )}
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
    );
  };

  const renderUserMenuItems = () => {
    const baseItems = [];

    if (variant === "admin") {
      baseItems.push({
        title: "Account Settings",
        icon: UserIcon,
        href: "/account",
      });
    }

    if (variant === "app") {
      baseItems.push(
        { title: "Account Settings", icon: UserIcon, href: "/account" },
        { title: "Notifications", icon: BellIcon, href: "/account/notifications" }
      );
      if (isAdmin) {
        baseItems.push({ title: "Admin Panel", icon: ShieldIcon, href: "/admin" });
      }
    }

    return baseItems;
  };

  const renderVersion = () => {
    const version = `StellarStack v${process.env.NEXT_PUBLIC_GIT_COMMIT_HASH?.slice(0, 7) || "dev"}-alpha`;

    if (variant === "app") {
      return (
        <WaveText
          text={version}
          baseClassName={isDark ? "text-zinc-600" : "text-zinc-400"}
          highlightClassName={isDark ? "text-zinc-100" : "text-zinc-800"}
        />
      );
    }

    return version;
  };

  const userMenuItems = renderUserMenuItems();
  const isAdminVariant = variant === "admin";

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
        {renderHeader()}
      </SidebarHeader>

      <SidebarContent className="px-2">{renderNavItems()}</SidebarContent>

      <SidebarFooter
        className={cn("border-t p-4", isDark ? "border-zinc-200/10" : "border-zinc-300")}
      >
        {variant === "app" && <ServerStatsContent isDark={isDark} />}

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
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center text-xs font-medium uppercase",
                isAdminVariant
                  ? isDark
                    ? "border border-amber-700/50 bg-amber-900/50 text-amber-400"
                    : "border border-amber-300 bg-amber-100 text-amber-700"
                  : isDark
                    ? "border border-zinc-700 bg-zinc-800 text-zinc-300"
                    : "border border-zinc-300 bg-zinc-200 text-zinc-700"
              )}
            >
              {user.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  isAdminVariant ? "flex items-center gap-1.5 truncate text-xs font-medium" : "truncate text-xs font-medium",
                  isDark ? "text-zinc-200" : "text-zinc-800"
                )}
              >
                {user.name}
                {isAdminVariant && (
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-[9px] tracking-wider uppercase",
                      isDark ? "bg-amber-900/50 text-amber-400" : "bg-amber-100 text-amber-700"
                    )}
                  >
                    Admin
                  </span>
                )}
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
            <div
              className={cn(
                "pointer-events-none absolute top-0 left-0 h-1.5 w-1.5 border-t border-l",
                isDark ? "border-zinc-600" : "border-zinc-300"
              )}
            />
            <div
              className={cn(
                "pointer-events-none absolute top-0 right-0 h-1.5 w-1.5 border-t border-r",
                isDark ? "border-zinc-600" : "border-zinc-300"
              )}
            />
            <div
              className={cn(
                "pointer-events-none absolute bottom-0 left-0 h-1.5 w-1.5 border-b border-l",
                isDark ? "border-zinc-600" : "border-zinc-300"
              )}
            />
            <div
              className={cn(
                "pointer-events-none absolute right-0 bottom-0 h-1.5 w-1.5 border-r border-b",
                isDark ? "border-zinc-600" : "border-zinc-300"
              )}
            />
          </button>

          {isUserMenuOpen && (
            <div
              className={cn(
                "absolute right-0 bottom-full left-0 z-50 mb-1 border shadow-lg",
                isDark
                  ? "border-zinc-700/50 bg-[#0f0f0f] shadow-black/40"
                  : "border-zinc-200 bg-white shadow-zinc-200/40"
              )}
            >
              <div
                className={cn(
                  "pointer-events-none absolute top-0 left-0 h-1.5 w-1.5 border-t border-l",
                  isDark ? "border-zinc-500" : "border-zinc-400"
                )}
              />
              <div
                className={cn(
                  "pointer-events-none absolute top-0 right-0 h-1.5 w-1.5 border-t border-r",
                  isDark ? "border-zinc-500" : "border-zinc-400"
                )}
              />
              <div
                className={cn(
                  "pointer-events-none absolute bottom-0 left-0 h-1.5 w-1.5 border-b border-l",
                  isDark ? "border-zinc-500" : "border-zinc-400"
                )}
              />
              <div
                className={cn(
                  "pointer-events-none absolute right-0 bottom-0 h-1.5 w-1.5 border-r border-b",
                  isDark ? "border-zinc-500" : "border-zinc-400"
                )}
              />

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

              {userMenuItems.length > 0 && (
                <div
                  className={cn("my-1 border-t", isDark ? "border-zinc-700/50" : "border-zinc-200")}
                />
              )}

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

        <div
          className={cn(
            "mt-3 text-center text-[10px] tracking-wider uppercase",
            isDark ? "text-zinc-600" : "text-zinc-400"
          )}
        >
          {renderVersion()}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};
