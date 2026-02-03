"use client";

import { type JSX, useState } from "react";
import { cn } from "@stellarUI/lib/utils";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import { TextureButton } from "@stellarUI/components/TextureButton";
import { SidebarTrigger } from "@stellarUI/components/Sidebar/Sidebar";
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
        return <BsInfoCircle className="h-4 w-4 text-blue-400" />;
      case "warning":
        return <BsExclamationTriangle className="h-4 w-4 text-amber-400" />;
      case "error":
        return <BsExclamationTriangle className="h-4 w-4 text-red-400" />;
      case "success":
        return <BsCheck className="h-4 w-4 text-green-400" />;
      case "server":
        return <BsServer className="h-4 w-4 text-purple-400" />;
      case "security":
        return <BsShieldExclamation className="h-4 w-4 text-orange-400" />;
    }
  };

  return (
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-black px-4 pb-4">
          {/* Header */}
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-between">
              <SidebarTrigger className="text-zinc-400 transition-all hover:scale-110 hover:text-zinc-100 active:scale-95" />
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <TextureButton
                    variant="minimal"
                    size="sm"
                    className="w-fit"
                    onClick={markAllAsRead}
                  >
                    <BsCheckAll className="h-4 w-4" />
                    Mark All Read
                  </TextureButton>
                )}
              </div>
            </div>
          </FadeIn>

          {/* Notifications Content */}
          <FadeIn delay={0.05}>
            <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
              <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
                <div className="flex items-center gap-2 text-xs opacity-50">
                  <BsBell className="h-3 w-3" />
                  Notifications
                </div>
                {unreadCount > 0 && (
                  <span className="rounded bg-blue-900/50 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <BsBell className="mb-4 h-12 w-12 text-zinc-700" />
                    <h3 className="mb-2 text-sm font-medium text-zinc-300">No Notifications</h3>
                    <p className="text-xs text-zinc-500">You're all caught up!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/50">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => markAsRead(notification.id)}
                        className={cn(
                          "flex cursor-pointer items-start gap-4 p-4 transition-colors hover:bg-zinc-800/20",
                          !notification.read && "bg-zinc-800/10"
                        )}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-700/50 bg-zinc-800/50">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-zinc-200">
                              {notification.title}
                            </span>
                            {!notification.read && (
                              <span className="h-2 w-2 rounded-full bg-blue-500" />
                            )}
                          </div>
                          <p className="mt-1 text-xs text-zinc-400">{notification.message}</p>
                          {notification.serverName && (
                            <span className="mt-2 inline-block rounded border border-zinc-700 px-2 py-0.5 text-[10px] font-medium tracking-wider text-zinc-500 uppercase">
                              {notification.serverName}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 text-xs text-zinc-600">
                          {notification.timestamp}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </FadeIn>
  );
};

export default NotificationsPage;
