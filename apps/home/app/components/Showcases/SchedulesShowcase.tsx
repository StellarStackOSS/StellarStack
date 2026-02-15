"use client";

import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import FeatureShowcase from "./FeatureShowcase";
import { MOCK_SCHEDULES } from "./MockData";
import type { MockSchedule, MockScheduleTask } from "./MockData";
import TextureBadge from "@stellarUI/components/TextureBadge/TextureBadge";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import {
  ArrowRight,
  Clock,
  Play,
  Square,
  RotateCcw,
  Archive,
  Terminal,
  RefreshCw,
} from "lucide-react";

/**
 * Returns the label, TextureBadge variant, and lucide icon for a task action.
 *
 * @param action - The task action type
 * @returns Object with label, badge variant, and icon component
 */
const GetActionMeta = (
  action: MockScheduleTask["action"]
): {
  label: string;
  variant: "success" | "destructive" | "warning" | "accent" | "primary";
  icon: JSX.Element;
} => {
  switch (action) {
    case "power_start":
      return { label: "Start", variant: "success", icon: <Play size={12} /> };
    case "power_stop":
      return { label: "Stop", variant: "destructive", icon: <Square size={12} /> };
    case "power_restart":
      return { label: "Restart", variant: "warning", icon: <RotateCcw size={12} /> };
    case "backup":
      return { label: "Backup", variant: "accent", icon: <Archive size={12} /> };
    case "command":
      return { label: "Command", variant: "primary", icon: <Terminal size={12} /> };
  }
};

/**
 * Props for the TaskPill component.
 */
interface TaskPillProps {
  /** The task to display */
  task: MockScheduleTask;
  /** Whether this task is currently executing */
  isExecuting?: boolean;
}

/**
 * Styled pill showing a task action using TextureBadge.
 * Shows a blue glow and spinner when executing.
 *
 * @param props - Task pill configuration
 * @returns Task pill element
 */
const TaskPill = ({ task, isExecuting = false }: TaskPillProps): JSX.Element => {
  const meta = GetActionMeta(task.action);

  if (isExecuting) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-900/30 px-2 py-1 text-xs ring-1 ring-blue-500/50 transition-all">
        <Spinner className="h-3 w-3 text-blue-400" />
        {meta.icon}
        <span className="text-white/80">{meta.label}</span>
        {task.payload && (
          <span className="max-w-[60px] truncate text-white/40">{task.payload}</span>
        )}
      </span>
    );
  }

  return (
    <TextureBadge variant="ghost" size="sm">
      {meta.icon}
      {meta.label}
      {task.payload && <span className="max-w-[60px] truncate opacity-60">{task.payload}</span>}
    </TextureBadge>
  );
};

/**
 * Props for the ScheduleCard component.
 */
interface ScheduleCardProps {
  /** The schedule data to display */
  schedule: MockSchedule;
  /** Whether the toggle is on */
  active: boolean;
  /** Callback when toggle is clicked */
  onToggle: () => void;
}

/**
 * A schedule card showing name, task flow pills with arrows, cron expression,
 * and an interactive toggle switch. Supports in-progress state with a spinner
 * on the currently executing task.
 *
 * @param props - Schedule card configuration
 * @returns Schedule card element
 */
const ScheduleCard = ({ schedule, active, onToggle }: ScheduleCardProps): JSX.Element => {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-medium text-white/90">{schedule.name}</span>
          <TextureBadge variant="secondary" size="sm">
            {schedule.tasks.length} {schedule.tasks.length === 1 ? "task" : "tasks"}
          </TextureBadge>
        </div>
        {/* Toggle switch */}
        <button
          onClick={onToggle}
          className={`relative h-5 w-10 rounded-full transition-colors duration-200 ${
            active ? "bg-emerald-500" : "bg-zinc-700"
          }`}
          aria-label={`${active ? "Disable" : "Enable"} ${schedule.name}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-200 ${
              active ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Task flow pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {schedule.tasks.map((task, i) => (
          <div key={task.id} className="flex items-center gap-1.5">
            <TaskPill task={task} isExecuting={schedule.executingTaskIndex === i} />
            {i < schedule.tasks.length - 1 && (
              <ArrowRight className="shrink-0 text-white/30" size={12} />
            )}
          </div>
        ))}
      </div>

      {/* Cron expression */}
      <div className="flex items-center gap-2 text-xs text-white/40">
        <Clock size={12} />
        <span>{schedule.cronDescription}</span>
      </div>
    </div>
  );
};

/**
 * Props for the TaskFlowNode component.
 */
interface TaskFlowNodeProps {
  /** The task to display */
  task: MockScheduleTask;
  /** Animation delay index */
  index: number;
}

/**
 * A styled node in the vertical task flow visualization.
 * Pulses in sequence with staggered animation.
 *
 * @param props - Task flow node configuration
 * @returns Animated task flow node
 */
const TaskFlowNode = ({ task, index }: TaskFlowNodeProps): JSX.Element => {
  const meta = GetActionMeta(task.action);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.4 + index * 0.15, duration: 0.4 }}
      className="flex items-center gap-3"
    >
      {/* Sequence circle */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-xs text-white/60">
        {task.sequence}
      </div>

      {/* Task info */}
      <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
        <TextureBadge variant="ghost" size="sm">
          {meta.icon}
          {meta.label}
        </TextureBadge>
        {task.payload && <span className="font-mono text-xs text-white/40">{task.payload}</span>}
      </div>

      {/* Trigger badge */}
      <div className="shrink-0">
        {task.triggerMode === "TIME_DELAY" && task.timeOffset > 0 ? (
          <TextureBadge variant="accent" size="sm">
            <Clock size={10} />
            {task.timeOffset}s
          </TextureBadge>
        ) : task.triggerMode === "ON_COMPLETION" ? (
          <TextureBadge variant="secondary" size="sm">
            <RefreshCw size={10} />
            Wait
          </TextureBadge>
        ) : null}
      </div>
    </motion.div>
  );
};

/**
 * Schedules showcase section displaying schedule cards with task pills,
 * an interactive toggle, and a vertical task flow visualization.
 *
 * @component
 * @returns Schedules showcase section
 */
const SchedulesShowcase = (): JSX.Element => {
  const [toggleState, setToggleState] = useState<Record<string, boolean>>({
    "sched-1": true,
    "sched-2": false,
  });

  // Cycle executing task: 0 → 1 → 2 → null (idle) → 0 → ...
  const taskCount = MOCK_SCHEDULES[0]!.tasks.length;
  const [executingIndex, setExecutingIndex] = useState<number | null>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setExecutingIndex((prev) => {
        if (prev === null) return 0;
        if (prev >= taskCount - 1) return null;
        return prev + 1;
      });
    }, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [taskCount]);

  const HandleToggle = (scheduleId: string): void => {
    setToggleState((prev) => ({
      ...prev,
      [scheduleId]: !prev[scheduleId],
    }));
  };

  const primarySchedule = MOCK_SCHEDULES[0]!;

  // Override the first schedule's executingTaskIndex with the animated value
  const animatedSchedules = MOCK_SCHEDULES.map((schedule) =>
    schedule.id === "sched-1" ? { ...schedule, executingTaskIndex: executingIndex } : schedule
  );

  return (
    <FeatureShowcase
      label="TASK SCHEDULING"
      title="Automate your server maintenance"
      description="Set up automated task chains that run on schedule. From daily backups to restart routines, keep your server healthy without lifting a finger."
      features={[
        { text: "Visual task flow editor" },
        { text: "Chain up to 12 tasks per schedule" },
        { text: "Daily, weekly, or custom cron scheduling" },
        { text: "Manual execution with one click" },
        { text: "Real-time progress tracking" },
      ]}
      backgroundImage="/bg-green.png"
    >
      <div className="flex flex-col gap-4">
        {/* Schedule cards */}
        {animatedSchedules.map((schedule) => (
          <ScheduleCard
            key={schedule.id}
            schedule={schedule}
            active={toggleState[schedule.id] ?? false}
            onToggle={() => HandleToggle(schedule.id)}
          />
        ))}

        {/* Task flow visualization */}
        <div className="rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-4">
          <div className="mb-3 text-xs tracking-wider text-white/40 uppercase">
            Task Flow — {primarySchedule.name}
          </div>

          <div className="relative flex flex-col gap-2">
            {/* Connecting line */}
            <div className="absolute top-[28px] bottom-[28px] left-[13px] w-px bg-white/10" />

            {primarySchedule.tasks.map((task, i) => (
              <TaskFlowNode key={task.id} task={task} index={i} />
            ))}
          </div>
        </div>
      </div>
    </FeatureShowcase>
  );
};

export default SchedulesShowcase;
