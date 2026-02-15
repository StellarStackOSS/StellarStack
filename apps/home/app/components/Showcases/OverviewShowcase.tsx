"use client";

import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import FeatureShowcase from "./FeatureShowcase";
import DragDropGridMockProvider from "@stellarUI/components/DragDropGrid/DragDropGridMockProvider";
import CpuCard from "@stellarUI/components/CpuCard/CpuCard";
import UsageMetricCard from "@stellarUI/components/UsageMetricCard/UsageMetricCard";
import NetworkUsageCard from "@stellarUI/components/NetworkUsageCard/NetworkUsageCard";
import Console from "@stellarUI/components/Console/Console";
import {
  CPU_HISTORY,
  RAM_HISTORY,
  NETWORK_DOWNLOAD_HISTORY,
  NETWORK_UPLOAD_HISTORY,
  CONSOLE_LINES,
} from "./MockData";

/**
 * Generates a jittered value around a base, clamped to [0, 100].
 *
 * @param base - The center value
 * @param range - Maximum deviation
 * @returns Jittered number
 */
const Jitter = (base: number, range: number): number => {
  return Math.max(0, Math.min(100, base + (Math.random() - 0.5) * range));
};

/**
 * Shifts an array left by one, appending a new value at the end.
 *
 * @param arr - Source array
 * @param newVal - Value to append
 * @returns New array with shifted data
 */
const ShiftHistory = (arr: number[], newVal: number): number[] => {
  return [...arr.slice(1), newVal];
};

/**
 * Overview showcase section displaying real @stellarUI dashboard cards
 * with animated sparkline data. Demonstrates the server monitoring dashboard.
 *
 * @component
 * @returns Overview showcase section
 */
const OverviewShowcase = (): JSX.Element => {
  const [cpuHistory, setCpuHistory] = useState<number[]>(CPU_HISTORY);
  const [cpuPct, setCpuPct] = useState<number>(45);
  const [ramHistory, setRamHistory] = useState<number[]>(RAM_HISTORY);
  const [ramPct, setRamPct] = useState<number>(68);
  const [dlHistory, setDlHistory] = useState<number[]>(NETWORK_DOWNLOAD_HISTORY);
  const [ulHistory, setUlHistory] = useState<number[]>(NETWORK_UPLOAD_HISTORY);
  const [dlSpeed, setDlSpeed] = useState<number>(11.5);
  const [ulSpeed, setUlSpeed] = useState<number>(3.8);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const newCpu = Jitter(45, 20);
      setCpuPct(newCpu);
      setCpuHistory((prev) => ShiftHistory(prev, newCpu));

      const newRam = Jitter(68, 10);
      setRamPct(newRam);
      setRamHistory((prev) => ShiftHistory(prev, newRam));

      const newDl = Math.max(0, 11.5 + (Math.random() - 0.5) * 6);
      const newUl = Math.max(0, 3.8 + (Math.random() - 0.5) * 3);
      setDlSpeed(newDl);
      setUlSpeed(newUl);
      setDlHistory((prev) => ShiftHistory(prev, newDl));
      setUlHistory((prev) => ShiftHistory(prev, newUl));
    }, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <FeatureShowcase
      label="SERVER OVERVIEW"
      title="Complete visibility, at a glance"
      description="Monitor your server's health in real time with a fully customizable dashboard. Drag, drop, and resize cards to build the perfect overview for your workflow."
      features={[
        { text: "Drag-and-drop dashboard layout" },
        { text: "Real-time CPU, RAM, and network monitoring" },
        { text: "Integrated server console" },
        { text: "One-click power controls" },
      ]}
      backgroundImage="/bg-orange.png"
    >
      <DragDropGridMockProvider defaultSize="sm">
        <div className="flex flex-col gap-3">
          {/* Top row: metric cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="h-[200px]">
              <CpuCard
                itemId="demo-cpu"
                percentage={cpuPct}
                history={cpuHistory}
                isOffline={false}
                labels={{ title: "CPU", coreUsage: "Core Usage", cores: "Cores" }}
              />
            </div>
            <div className="h-[200px]">
              <UsageMetricCard
                itemId="demo-ram"
                percentage={ramPct}
                history={ramHistory}
                color="#10b981"
                isOffline={false}
                labels={{ title: "Memory" }}
                primaryValue={`${(ramPct * 0.08).toFixed(1)} GB`}
              />
            </div>
            <div className="h-[200px]">
              <NetworkUsageCard
                itemId="demo-net"
                download={dlSpeed}
                upload={ulSpeed}
                downloadHistory={dlHistory}
                uploadHistory={ulHistory}
                isOffline={false}
                labels={{
                  title: "Network",
                  download: "Download",
                  upload: "Upload",
                }}
              />
            </div>
          </div>

          {/* Bottom: console */}
          <div className="h-[250px]">
            <Console lines={CONSOLE_LINES} isOffline={false} showSendButton />
          </div>
        </div>
      </DragDropGridMockProvider>
    </FeatureShowcase>
  );
};

export default OverviewShowcase;
