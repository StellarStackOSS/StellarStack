"use client";

import { useState } from "react";
import { useParams, usePathname } from "next/navigation";
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
  Bell,
  ChevronUp,
  Cpu,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Server,
  Settings,
  Shield,
  User,
  Users,
} from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { useAuth } from "hooks/auth-provider";
import { TextureButton } from "@workspace/ui/components/texture-button";
import { BsArrowLeft } from "react-icons/bs";
import { AnimatePresence, motion } from "framer-motion";
import { useServer } from "components/ServerStatusPages/server-provider";
import { useServerWebSocket } from "@/hooks/useServerWebSocket";
import { WaveText } from "@/components/WaveText/WaveText";

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
  { title: "Settings", icon: Settings, href: "/admin/settings" },
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
  {
    title: "Activity",
    icon: <img alt="icon" src="/icons/24-bullet-list.svg" />,
    href: "/activity",
  },
  {
    title: "Startup",
    icon: <img alt="icon" src="/icons/24-circle-power-off.svg" />,
    href: "/startup",
  },
  { title: "Settings", icon: <img alt="icon" src="/icons/24-gear.svg" />, href: "/settings" },
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

export const UnifiedSidebar = () => {
  const pathname = usePathname();
  const params = useParams();
  const serverId = (params.id as string) || "";
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
          <TextureButton variant="minimal" className="w-full">
            <Link
                href="/servers"
                className="flex flex-row gap-2"
            >
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
              <BsArrowLeft className="h-4 w-4" />
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

    return (
      <>
        <TextureButton variant="minimal" className="w-full">
          <Link href="/servers" className="flex flex-row gap-2">
            <BsArrowLeft className="h-4 w-4" />
            <span className="text-xs font-medium tracking-wider uppercase">All Servers</span>
          </Link>
        </TextureButton>
        <div className={cn("mt-3 flex items-center gap-2 px-3 py-2 text-zinc-300")}>
          <Server className={cn("h-4 w-4 shrink-0 text-zinc-500")} />
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

              return (
                <SidebarMenuItem key={item.title} className={variant === "app" ? "relative" : ""}>
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
                      "text-xs transition-colors",
                      variant === "app"
                        ? "relative z-10 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100 data-[active=true]:text-zinc-100"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100 data-[active=true]:bg-zinc-800/80 data-[active=true]:text-zinc-100"
                    )}
                  >
                    <Link href={fullHref}>
                      {variant === "app" ? (
                        <span className="w-5">{item.icon as any}</span>
                      ) : (
                        (() => {
                          const Icon = item.icon as React.ComponentType<{ className: string }>;
                          return <Icon className="h-4 w-4" />;
                        })()
                      )}
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

  return (
    <Sidebar
      className={cn(
        "border-r border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20"
      )}
    >
      <SidebarHeader className={cn("border-b border-zinc-200/10 p-4")}>
        {renderHeader()}
      </SidebarHeader>

      <SidebarContent className="px-2">{renderNavItems()}</SidebarContent>

      <SidebarFooter className={cn("border-t border-zinc-200/10 p-4")}>
        {variant === "app" && <ServerStatsContent />}

        <div className="relative">
          <TextureButton
            variant="ghost"
            className="flex w-full flex-row justify-between text-start"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center border border-zinc-700 bg-zinc-800 text-xs font-medium text-zinc-300 uppercase"
              )}
            >
              {user.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className={cn("truncate text-xs font-medium text-zinc-200")}>{user.name}</div>
              <div className={cn("truncate text-[10px] text-zinc-500")}>{user.email}</div>
            </div>
            <ChevronUp
              className={cn(
                "h-4 w-4 shrink-0 text-zinc-500 transition-transform",
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
                  "absolute right-0 bottom-[120%] left-0 z-50 mb-1 rounded-lg border border-zinc-700/50 bg-[#0f0f0f] shadow-lg shadow-black/40"
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
                      <LogOut className="h-4 w-4" />
                      <span className="tracking-wider uppercase">Sign Out</span>
                    </TextureButton>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className={cn("mt-3 text-center text-[10px] tracking-wider text-zinc-600 uppercase")}>
          {renderVersion()}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};
