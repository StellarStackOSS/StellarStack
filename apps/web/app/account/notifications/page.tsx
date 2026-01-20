"use client";

import { type JSX, useState } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { TextureButton } from "@workspace/ui/components/texture-button";
import { SidebarTrigger } from "@workspace/ui/components/sidebar";
import {
  BsBell,
  BsCheck,
  BsCheckAll,
  BsExclamationTriangle,
  BsInfoCircle,
  BsServer,
  BsShieldExclamation,
} from "react-icons/bs";

type NotificationType = "info" | "warning" | "error" | "success" | "server" | "security";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  serverId?: string;
  serverName?: string;
}

const mockNotifications: Notification[] = [
  {
    id: "notif-1",
    type: "server",
    title: "Server Restarted",
    message: "US-WEST-NODE-1 has been successfully restarted and is now online.",
    timestamp: "5 minutes ago",
    read: false,
    serverId: "srv-1",
    serverName: "US-WEST-NODE-1",
  },
  {
    id: "notif-2",
    type: "warning",
    title: "High CPU Usage",
    message:
      "EU-CENTRAL-NODE-1 is experiencing high CPU usage (95%). Consider upgrading resources.",
    timestamp: "1 hour ago",
    read: false,
    serverId: "srv-2",
    serverName: "EU-CENTRAL-NODE-1",
  },
  {
    id: "notif-3",
    type: "security",
    title: "New Login Detected",
    message: "A new login was detected from Chrome on Windows. Location: New York, US.",
    timestamp: "3 hours ago",
    read: true,
  },
  {
    id: "notif-4",
    type: "success",
    title: "Backup Completed",
    message: "Daily backup for US-WEST-NODE-1 completed successfully (2.4 GB).",
    timestamp: "6 hours ago",
    read: true,
    serverId: "srv-1",
    serverName: "US-WEST-NODE-1",
  },
  {
    id: "notif-5",
    type: "info",
    title: "Scheduled Maintenance",
    message: "Scheduled maintenance window tomorrow from 2:00 AM - 4:00 AM UTC.",
    timestamp: "1 day ago",
    read: true,
  },
  {
    id: "notif-6",
    type: "error",
    title: "Backup Failed",
    message: "Automatic backup for US-EAST-NODE-1 failed due to insufficient disk space.",
    timestamp: "1 day ago",
    read: true,
    serverId: "srv-3",
    serverName: "US-EAST-NODE-1",
  },
];

const NotificationsPage = (): JSX.Element | null => {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case "info":
        return <BsInfoCircle className="h-4 w-4 text-blue-500" />;
      case "warning":
        return <BsExclamationTriangle className="h-4 w-4 text-amber-500" />;
      case "error":
        return <BsExclamationTriangle className="h-4 w-4 text-red-500" />;
      case "success":
        return <BsCheck className="h-4 w-4 text-green-500" />;
      case "server":
        return <BsServer className="h-4 w-4 text-purple-500" />;
      case "security":
        return <BsShieldExclamation className="h-4 w-4 text-orange-500" />;
    }
  };

  return (
    <div className={cn("relative min-h-svh bg-[#0b0b0a] transition-colors")}>
      <div className="relative p-8">
        <div className="mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <SidebarTrigger
                className={cn(
                  "text-zinc-400 transition-all hover:scale-110 hover:text-zinc-100 active:scale-95"
                )}
              />
              <div>
                <div className="flex items-center gap-3">
                  <h1 className={cn("text-2xl font-light tracking-wider text-zinc-100")}>
                    NOTIFICATIONS
                  </h1>
                  {unreadCount > 0 && (
                    <span
                      className={cn(
                        "border border-blue-500/50 px-2 py-0.5 text-[10px] font-medium tracking-wider text-blue-400 uppercase"
                      )}
                    >
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <p className={cn("mt-1 text-sm text-zinc-500")}>
                  Stay updated on your servers and account
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <TextureButton variant="minimal" onClick={markAllAsRead}>
                  <BsCheckAll className="h-4 w-4" />
                  <span className="text-xs tracking-wider uppercase">Mark All Read</span>
                </TextureButton>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div
            className={cn(
              "relative border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a]"
            )}
          >
            {/* Corner decorations */}
            <div
              className={cn("absolute top-0 left-0 h-3 w-3 border-t border-l border-zinc-500")}
            />
            <div
              className={cn("absolute top-0 right-0 h-3 w-3 border-t border-r border-zinc-500")}
            />
            <div
              className={cn("absolute bottom-0 left-0 h-3 w-3 border-b border-l border-zinc-500")}
            />
            <div
              className={cn("absolute right-0 bottom-0 h-3 w-3 border-r border-b border-zinc-500")}
            />

            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <BsBell className={cn("mb-4 h-12 w-12 text-zinc-700")} />
                <p className={cn("text-sm text-zinc-500")}>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification, index) => (
                <TextureButton
                  variant="minimal"
                  key={notification.id}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center border border-zinc-700 bg-zinc-800/50"
                    )}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className={cn("text-sm font-medium text-zinc-200")}>
                        {notification.title}
                      </span>
                      {!notification.read && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                    </div>
                    <p className={cn("mt-1 text-xs text-zinc-400")}>{notification.message}</p>
                    {notification.serverName && (
                      <span
                        className={cn(
                          "mt-2 inline-block border border-zinc-700 px-2 py-0.5 text-[10px] font-medium tracking-wider text-zinc-500 uppercase"
                        )}
                      >
                        {notification.serverName}
                      </span>
                    )}
                  </div>
                  <span className={cn("shrink-0 text-xs text-zinc-600")}>
                    {notification.timestamp}
                  </span>
                </TextureButton>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
