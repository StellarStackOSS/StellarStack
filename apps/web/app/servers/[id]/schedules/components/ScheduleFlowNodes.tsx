"use client";

import { Handle, Position, Node, NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import {
  BsPlayFill,
  BsStopFill,
  BsArrowRepeat,
  BsCloudUpload,
  BsTerminal,
  BsCheckCircle,
  BsClock,
} from "react-icons/bs";
import Label from "@stellarUI/components/Label/Label";
import { JSX } from "react";

const nodeBaseClasses =
  "relative flex flex-col rounded-lg border p-4 transition-colors border-zinc-200/10 bg-gradient-to-b from-card via-secondary to-background shadow-lg shadow-black/20";

// Node data interfaces
export interface ScheduleStartNodeData extends Record<string, unknown> {
  scheduleName: string;
  cronExpression: string;
  formattedCron: string;
}

export interface ScheduleTaskNodeData extends Record<string, unknown> {
  id: string;
  sequence: number;
  action: string;
  payload?: string;
  triggerMode: "TIME_DELAY" | "ON_COMPLETION";
  timeOffset: number;
}

export interface ScheduleEndNodeData extends Record<string, unknown> {
  taskCount: number;
}

/** Node type wrappers for NodeProps generics. */
type ScheduleStartNode = Node<ScheduleStartNodeData, "scheduleStart">;
type ScheduleTaskNode = Node<ScheduleTaskNodeData, "scheduleTask">;
type ScheduleEndNode = Node<ScheduleEndNodeData, "scheduleEnd">;

// Action metadata
const actionConfig: Record<string, { icon: JSX.Element; label: string }> = {
  power_start: {
    icon: <BsPlayFill className="h-4 w-4" />,
    label: "Start Server",
  },
  power_stop: {
    icon: <BsStopFill className="h-4 w-4" />,
    label: "Stop Server",
  },
  power_restart: {
    icon: <BsArrowRepeat className="h-4 w-4" />,
    label: "Restart Server",
  },
  backup: {
    icon: <BsCloudUpload className="h-4 w-4" />,
    label: "Create Backup",
  },
  command: {
    icon: <BsTerminal className="h-4 w-4" />,
    label: "Run Command",
  },
};

// Schedule Start Node
export const ScheduleStartNode = ({ data }: NodeProps<ScheduleStartNode>) => {
  return (
    <motion.div
      data-id="start-node"
      className={`${nodeBaseClasses} w-80`}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{
        duration: 1.5,
        ease: "easeInOut",
        repeat: Infinity,
        delay: 0,
        repeatDelay: 10.5,
      }}
    >
      <div className="flex items-center gap-2">
        <BsClock className="h-4 w-4" />
        <Label className="text-sm font-semibold text-zinc-100">Schedule Start</Label>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <Label className="text-xs text-zinc-500">Name</Label>
          <div className="truncate text-sm text-zinc-100">{data.scheduleName}</div>
        </div>

        <div>
          <Label className="text-xs text-zinc-500">Schedule</Label>
          <div className="mt-1 rounded bg-zinc-900/50 px-2 py-1.5 font-mono text-xs text-zinc-300">
            {data.cronExpression}
          </div>
          <div className="mt-1 text-xs text-zinc-400">{data.formattedCron}</div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} />
    </motion.div>
  );
};

// Schedule Task Node
export const ScheduleTaskNode = ({ data }: NodeProps<ScheduleTaskNode>) => {
  const config = actionConfig[data.action] || actionConfig.command;
  const truncatedPayload = data.payload
    ? data.payload.length > 30
      ? data.payload.substring(0, 30) + "..."
      : data.payload
    : null;

  // Calculate pulse delay: task at sequence S (1-indexed) pulses at 3*S seconds
  const pulseDelay = 3 * data.sequence;

  return (
    <motion.div
      data-id={`task-node-${data.id}`}
      className={`${nodeBaseClasses} w-80`}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{
        duration: 1.5,
        ease: "easeInOut",
        repeat: Infinity,
        delay: pulseDelay,
        repeatDelay: 10.5,
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {config?.icon}
          <Label className="text-sm font-semibold text-zinc-100">{config?.label}</Label>
        </div>
        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-600/50 bg-zinc-700/50">
          <span className="text-xs font-medium text-zinc-300">{data.sequence}</span>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <div className="text-xs text-zinc-500">
            {data.triggerMode === "TIME_DELAY" ? `${data.timeOffset}s delay` : "On completion"}
          </div>
        </div>

        {truncatedPayload && (
          <div>
            <Label className="text-xs text-zinc-500">Command</Label>
            <div className="mt-1 rounded bg-zinc-900/50 px-2 py-1.5 font-mono text-xs text-zinc-300">
              {truncatedPayload}
            </div>
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </motion.div>
  );
};

// Schedule End Node
export const ScheduleEndNode = ({ data }: NodeProps<ScheduleEndNode>) => {
  // End node pulses after all tasks: delay = 3 + 3*taskCount
  const pulseDelay = 3 + 3 * data.taskCount;

  return (
    <motion.div
      data-id="end-node"
      className={`${nodeBaseClasses} w-80`}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{
        duration: 1.5,
        ease: "easeInOut",
        repeat: Infinity,
        delay: pulseDelay,
        repeatDelay: 10.5,
      }}
    >
      <div className="flex items-center gap-2">
        <BsCheckCircle className="h-4 w-4" />
        <Label className="text-sm font-semibold text-zinc-100">Complete</Label>
      </div>

      <div className="mt-3 text-xs text-zinc-400">
        {data.taskCount} {data.taskCount === 1 ? "task" : "tasks"} executed
      </div>

      <Handle type="target" position={Position.Top} />
    </motion.div>
  );
};
