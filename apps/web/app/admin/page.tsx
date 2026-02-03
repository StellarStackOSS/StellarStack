"use client";

import { useEffect, useState } from "react";
import { cn } from "@stellarUI/lib/utils";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import { SidebarTrigger } from "@stellarUI/components/Sidebar/Sidebar";
import { Cpu, MapPin, Package, Server, Settings, Users } from "lucide-react";
import Link from "next/link";
import type { Blueprint, Location, Node, User } from "@/lib/api";
import type { Server as ServerType } from "@/lib/api";
import { account, blueprints, locations, nodes, servers } from "@/lib/api";
import { BsCpu, BsGeoAlt, BsServer, BsBox, BsPeople, BsGear, BsPlus } from "react-icons/bs";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color?: string;
}

const StatCard = ({ title, value, icon: Icon, href, color = "zinc" }: StatCardProps) => {
  const colorClasses = {
    zinc: "text-zinc-400",
    green: "text-green-400",
    amber: "text-amber-400",
    blue: "text-blue-400",
    purple: "text-purple-400",
  };

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center justify-between rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/20"
      )}
    >
      <div>
        <div className="text-[10px] tracking-wider text-zinc-500 uppercase">{title}</div>
        <div className="mt-1 text-2xl font-light text-zinc-100">{value}</div>
      </div>
      <Icon
        className={cn(
          "h-8 w-8 opacity-30 transition-opacity group-hover:opacity-60",
          colorClasses[color as keyof typeof colorClasses] || colorClasses.zinc
        )}
      />
    </Link>
  );
};

interface QuickActionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color?: string;
}

const QuickAction = ({ title, icon: Icon, href, color = "zinc" }: QuickActionProps) => {
  const colorClasses = {
    zinc: "text-zinc-400 hover:text-zinc-300",
    green: "text-green-400 hover:text-green-300",
    amber: "text-amber-400 hover:text-amber-300",
    blue: "text-blue-400 hover:text-blue-300",
    purple: "text-purple-400 hover:text-purple-300",
  };

  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/20"
      )}
    >
      <Icon className={cn("mb-2 h-6 w-6", colorClasses[color as keyof typeof colorClasses])} />
      <span className="text-xs tracking-wider text-zinc-400 uppercase">{title}</span>
    </Link>
  );
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState({
    nodes: 0,
    nodesOnline: 0,
    locations: 0,
    servers: 0,
    serversRunning: 0,
    blueprints: 0,
    users: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [nodesList, locationsList, serversList, blueprintsList, usersList] =
          await Promise.all([
            nodes.list().catch(() => [] as Node[]),
            locations.list().catch(() => [] as Location[]),
            servers.list().catch(() => [] as ServerType[]),
            blueprints.list().catch(() => [] as Blueprint[]),
            account.listUsers().catch(() => [] as User[]),
          ]);

        setStats({
          nodes: nodesList.length,
          nodesOnline: nodesList.filter((n) => n.isOnline).length,
          locations: locationsList.length,
          servers: serversList.length,
          serversRunning: serversList.filter((s) => s.status === "RUNNING").length,
          blueprints: blueprintsList.length,
          users: usersList.length,
        });
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-black px-4 pb-4">
          {/* Header */}
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-between">
              <SidebarTrigger className="text-zinc-400 transition-all hover:scale-110 hover:text-zinc-100 active:scale-95" />
            </div>
          </FadeIn>

          {/* Stats Grid */}
          <FadeIn delay={0.05}>
            <div className="mb-4 flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
              <div className="shrink-0 pb-2 pl-2 text-xs opacity-50">Overview</div>
              <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-4 shadow-lg shadow-black/20">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <StatCard
                    title="Nodes"
                    value={isLoading ? "..." : `${stats.nodesOnline}/${stats.nodes}`}
                    icon={BsCpu}
                    href="/admin/nodes"
                    color={stats.nodesOnline > 0 ? "green" : "zinc"}
                  />
                  <StatCard
                    title="Locations"
                    value={isLoading ? "..." : stats.locations}
                    icon={BsGeoAlt}
                    href="/admin/locations"
                    color="blue"
                  />
                  <StatCard
                    title="Servers"
                    value={isLoading ? "..." : `${stats.serversRunning}/${stats.servers}`}
                    icon={BsServer}
                    href="/admin/servers"
                    color={stats.serversRunning > 0 ? "green" : "zinc"}
                  />
                  <StatCard
                    title="Blueprints"
                    value={isLoading ? "..." : stats.blueprints}
                    icon={BsBox}
                    href="/admin/blueprints"
                    color="amber"
                  />
                  <StatCard
                    title="Users"
                    value={isLoading ? "..." : stats.users}
                    icon={BsPeople}
                    href="/admin/users"
                    color="purple"
                  />
                  <StatCard
                    title="Settings"
                    value="Configure"
                    icon={BsGear}
                    href="/admin/settings"
                  />
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Quick Actions */}
          <FadeIn delay={0.1}>
            <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
              <div className="shrink-0 pb-2 pl-2 text-xs opacity-50">Quick Actions</div>
              <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-4 shadow-lg shadow-black/20">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <QuickAction title="Add Node" icon={BsCpu} href="/admin/nodes" color="green" />
                  <QuickAction
                    title="Add Location"
                    icon={BsGeoAlt}
                    href="/admin/locations"
                    color="blue"
                  />
                  <QuickAction
                    title="Add Blueprint"
                    icon={BsBox}
                    href="/admin/blueprints"
                    color="amber"
                  />
                  <QuickAction
                    title="Create Server"
                    icon={BsServer}
                    href="/admin/servers/new"
                    color="purple"
                  />
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </FadeIn>
  );
}
