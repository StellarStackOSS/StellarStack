"use client";

import {useEffect, useState} from "react";
import {cn} from "@workspace/ui/lib/utils";
import {AnimatedBackground} from "@workspace/ui/components/animated-background";
import {FadeIn} from "@workspace/ui/components/fade-in";
import {CpuIcon, MapPinIcon, PackageIcon, ServerIcon, SettingsIcon, UsersIcon} from "lucide-react";
import Link from "next/link";
import type {Blueprint, Location, Node, Server, User} from "@/lib/api";
import {account, blueprints, locations, nodes, servers} from "@/lib/api";

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
        "relative p-6 border transition-all group hover:scale-[1.02] bg-zinc-900/50 border-zinc-700/50 hover:border-zinc-500",
      )}
    >
      {/* Corner accents */}
      <div className={cn("absolute top-0 left-0 w-2 h-2 border-t border-l", colorClasses[color as keyof typeof colorClasses] || colorClasses.zinc)} />
      <div className={cn("absolute top-0 right-0 w-2 h-2 border-t border-r", colorClasses[color as keyof typeof colorClasses] || colorClasses.zinc)} />
      <div className={cn("absolute bottom-0 left-0 w-2 h-2 border-b border-l", colorClasses[color as keyof typeof colorClasses] || colorClasses.zinc)} />
      <div className={cn("absolute bottom-0 right-0 w-2 h-2 border-b border-r", colorClasses[color as keyof typeof colorClasses] || colorClasses.zinc)} />

      <div className="flex items-center justify-between">
        <div>
          <div className={cn(
            "text-xs uppercase tracking-wider mb-1 text-zinc-500",
          )}>
            {title}
          </div>
          <div className={cn(
            "text-3xl font-light text-zinc-100",
          )}>
            {value}
          </div>
        </div>
        <Icon className={cn(
          "w-8 h-8 opacity-50 group-hover:opacity-100 transition-opacity",
          colorClasses[color as keyof typeof colorClasses] || colorClasses.zinc
        )} />
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
        const [nodesList, locationsList, serversList, blueprintsList, usersList] = await Promise.all([
          nodes.list().catch(() => [] as Node[]),
          locations.list().catch(() => [] as Location[]),
          servers.list().catch(() => [] as Server[]),
          blueprints.list().catch(() => [] as Blueprint[]),
          account.listUsers().catch(() => [] as User[]),
        ]);

        setStats({
          nodes: nodesList.length,
          nodesOnline: nodesList.filter(n => n.isOnline).length,
          locations: locationsList.length,
          servers: serversList.length,
          serversRunning: serversList.filter(s => s.status === "RUNNING").length,
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
    <div className={cn("min-h-svh transition-colors relative bg-[#0b0b0a]")}>
      <AnimatedBackground />

      <div className="relative p-8">
        <div className="max-w-6xl mx-auto">
          <FadeIn delay={0}>
            {/* Header */}
            <div className="mb-8">
              <h1 className={cn(
                "text-2xl font-light tracking-wider text-zinc-100",
              )}>
                ADMIN DASHBOARD
              </h1>
              <p className={cn(
                "text-sm mt-1 text-zinc-500",
              )}>
                System overview and quick stats
              </p>
            </div>
          </FadeIn>

          {/* Stats Grid */}
          <FadeIn delay={0.1}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
              <h2 className={cn(
                "text-sm font-medium uppercase tracking-wider mb-4 text-zinc-400",
              )}>
                Quick Actions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/admin/nodes"
            className={cn(
              "relative p-4 border text-center transition-all hover:scale-[1.02] bg-zinc-900/50 border-zinc-700/50 hover:border-green-500/50 text-zinc-300",
            )}
          >
            <CpuIcon className={cn("w-6 h-6 mx-auto mb-2 text-green-400")} />
            <span className="text-xs uppercase tracking-wider">Add Node</span>
          </Link>
          <Link
            href="/admin/locations"
            className={cn(
              "relative p-4 border text-center transition-all hover:scale-[1.02] bg-zinc-900/50 border-zinc-700/50 hover:border-blue-500/50 text-zinc-300",
            )}
          >
            <MapPinIcon className={cn("w-6 h-6 mx-auto mb-2 text-blue-400")} />
            <span className="text-xs uppercase tracking-wider">Add Location</span>
          </Link>
          <Link
            href="/admin/blueprints"
            className={cn(
              "relative p-4 border text-center transition-all hover:scale-[1.02] bg-zinc-900/50 border-zinc-700/50 hover:border-amber-500/50 text-zinc-300",
            )}
          >
            <PackageIcon className={cn("w-6 h-6 mx-auto mb-2 text-amber-400")} />
            <span className="text-xs uppercase tracking-wider">Add Blueprint</span>
          </Link>
          <Link
            href="/admin/servers"
            className={cn(
              "relative p-4 border text-center transition-all hover:scale-[1.02] bg-zinc-900/50 border-zinc-700/50 hover:border-purple-500/50 text-zinc-300",
            )}
          >
            <ServerIcon className={cn("w-6 h-6 mx-auto mb-2 text-purple-400")} />
                <span className="text-xs uppercase tracking-wider">Create Server</span>
              </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
