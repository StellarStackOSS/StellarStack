"use client";

import { useEffect, useState } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { FadeIn } from "@workspace/ui/components/fade-in";
import {
  CpuIcon,
  MapPinIcon,
  PackageIcon,
  ServerIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import type { Blueprint, Location, Node, Server, User } from "@/lib/api";
import { account, blueprints, locations, nodes, servers } from "@/lib/api";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color?: string;
}

const StatCard = ({ title, value, icon: Icon, href, color = "zinc" }: StatCardProps) => {
  const colorClasses = {
    zinc: "border-zinc-700/50 text-zinc-400",
    green: "border-green-700/50 text-green-400",
    amber: "border-amber-700/50 text-amber-400",
    blue: "border-blue-700/50 text-blue-400",
  };

  return (
    <Link
      href={href}
      className={cn(
        "group relative border border-zinc-700/50 bg-zinc-900/50 p-6 transition-all hover:scale-[1.02] hover:border-zinc-500"
      )}
    >
      {/* Corner accents */}
      <div
        className={cn(
          "absolute top-0 left-0 h-2 w-2 border-t border-l",
          colorClasses[color as keyof typeof colorClasses] || colorClasses.zinc
        )}
      />
      <div
        className={cn(
          "absolute top-0 right-0 h-2 w-2 border-t border-r",
          colorClasses[color as keyof typeof colorClasses] || colorClasses.zinc
        )}
      />
      <div
        className={cn(
          "absolute bottom-0 left-0 h-2 w-2 border-b border-l",
          colorClasses[color as keyof typeof colorClasses] || colorClasses.zinc
        )}
      />
      <div
        className={cn(
          "absolute right-0 bottom-0 h-2 w-2 border-r border-b",
          colorClasses[color as keyof typeof colorClasses] || colorClasses.zinc
        )}
      />

      <div className="flex items-center justify-between">
        <div>
          <div className={cn("mb-1 text-xs tracking-wider text-zinc-500 uppercase")}>{title}</div>
          <div className={cn("text-3xl font-light text-zinc-100")}>{value}</div>
        </div>
        <Icon
          className={cn(
            "h-8 w-8 opacity-50 transition-opacity group-hover:opacity-100",
            colorClasses[color as keyof typeof colorClasses] || colorClasses.zinc
          )}
        />
      </div>
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
            servers.list().catch(() => [] as Server[]),
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
    <div className={cn("relative min-h-svh bg-[#0b0b0a] transition-colors")}>
      <div className="relative p-8">
        <div className="mx-auto">
          <FadeIn delay={0}>
            {/* Header */}
            <div className="mb-8">
              <h1 className={cn("text-2xl font-light tracking-wider text-zinc-100")}>
                ADMIN DASHBOARD
              </h1>
              <p className={cn("mt-1 text-sm text-zinc-500")}>System overview and quick stats</p>
            </div>
          </FadeIn>

          {/* Stats Grid */}
          <FadeIn delay={0.1}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <StatCard
                title="Nodes"
                value={isLoading ? "..." : `${stats.nodesOnline}/${stats.nodes}`}
                icon={CpuIcon}
                href="/admin/nodes"
                color={stats.nodesOnline > 0 ? "green" : "zinc"}
              />
              <StatCard
                title="Locations"
                value={isLoading ? "..." : stats.locations}
                icon={MapPinIcon}
                href="/admin/locations"
                color="blue"
              />
              <StatCard
                title="Servers"
                value={isLoading ? "..." : `${stats.serversRunning}/${stats.servers}`}
                icon={ServerIcon}
                href="/admin/servers"
                color={stats.serversRunning > 0 ? "green" : "zinc"}
              />
              <StatCard
                title="Blueprints"
                value={isLoading ? "..." : stats.blueprints}
                icon={PackageIcon}
                href="/admin/blueprints"
                color="amber"
              />
              <StatCard
                title="Users"
                value={isLoading ? "..." : stats.users}
                icon={UsersIcon}
                href="/admin/users"
              />
              <StatCard
                title="Settings"
                value="Configure"
                icon={SettingsIcon}
                href="/admin/settings"
              />
            </div>
          </FadeIn>

          {/* Quick Actions */}
          <FadeIn delay={0.2}>
            <div className="mt-8">
              <h2 className={cn("mb-4 text-sm font-medium tracking-wider text-zinc-400 uppercase")}>
                Quick Actions
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link
                  href="/admin/nodes"
                  className={cn(
                    "relative border border-zinc-700/50 bg-zinc-900/50 p-4 text-center text-zinc-300 transition-all hover:scale-[1.02] hover:border-green-500/50"
                  )}
                >
                  <CpuIcon className={cn("mx-auto mb-2 h-6 w-6 text-green-400")} />
                  <span className="text-xs tracking-wider uppercase">Add Node</span>
                </Link>
                <Link
                  href="/admin/locations"
                  className={cn(
                    "relative border border-zinc-700/50 bg-zinc-900/50 p-4 text-center text-zinc-300 transition-all hover:scale-[1.02] hover:border-blue-500/50"
                  )}
                >
                  <MapPinIcon className={cn("mx-auto mb-2 h-6 w-6 text-blue-400")} />
                  <span className="text-xs tracking-wider uppercase">Add Location</span>
                </Link>
                <Link
                  href="/admin/blueprints"
                  className={cn(
                    "relative border border-zinc-700/50 bg-zinc-900/50 p-4 text-center text-zinc-300 transition-all hover:scale-[1.02] hover:border-amber-500/50"
                  )}
                >
                  <PackageIcon className={cn("mx-auto mb-2 h-6 w-6 text-amber-400")} />
                  <span className="text-xs tracking-wider uppercase">Add Blueprint</span>
                </Link>
                <Link
                  href="/admin/servers"
                  className={cn(
                    "relative border border-zinc-700/50 bg-zinc-900/50 p-4 text-center text-zinc-300 transition-all hover:scale-[1.02] hover:border-purple-500/50"
                  )}
                >
                  <ServerIcon className={cn("mx-auto mb-2 h-6 w-6 text-purple-400")} />
                  <span className="text-xs tracking-wider uppercase">Create Server</span>
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
