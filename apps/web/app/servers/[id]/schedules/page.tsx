"use client";

import { type JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { cn } from "@stellarUI/lib/utils";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Input from "@stellarUI/components/Input/Input";
import { SidebarTrigger } from "@stellarUI/components/Sidebar/Sidebar";
import Switch from "@stellarUI/components/Switch/Switch";
import ConfirmationModal from "@stellarUI/components/ConfirmationModal/ConfirmationModal";
import FormModal from "@stellarUI/components/FormModal/FormModal";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import {
  BsArrowRepeat,
  BsCalendar,
  BsArrowRight,
  BsChevronDown,
  BsClock,
  BsCloudUpload,
  BsEye,
  BsPencil,
  BsPlayFill,
  BsPlus,
  BsStopFill,
  BsTerminal,
  BsTrash,
  BsX,
} from "react-icons/bs";
import type { CreateScheduleData, Schedule } from "@/lib/api";
import { servers } from "@/lib/api";
import { useServer } from "components/ServerStatusPages/server-provider/server-provider";
import { ServerInstallingPlaceholder } from "components/ServerStatusPages/server-installing-placeholder/server-installing-placeholder";
import { ServerSuspendedPlaceholder } from "components/ServerStatusPages/server-suspended-placeholder/server-suspended-placeholder";
import { useServerWebSocket } from "@/hooks/useWebSocket";
import { toast } from "sonner";
import Label from "@stellarUI/components/Label/Label";
import { ScheduleVisualizer } from "./components/ScheduleVisualizer";

type ActionType = "power_start" | "power_stop" | "power_restart" | "backup" | "command";

interface LocalTask {
  id: string;
  action: ActionType;
  payload?: string;
  sequence: number;
  timeOffset: number;
  triggerMode: "TIME_DELAY" | "ON_COMPLETION";
}

const actionOptions: { value: ActionType; label: string; icon: JSX.Element }[] = [
  {
    value: "power_start",
    label: "Start Server",
    icon: <BsPlayFill className="h-4 w-4 text-green-500" />,
  },
  {
    value: "power_stop",
    label: "Stop Server",
    icon: <BsStopFill className="h-4 w-4 text-red-500" />,
  },
  {
    value: "power_restart",
    label: "Restart Server",
    icon: <BsArrowRepeat className="h-4 w-4 text-amber-500" />,
  },
  {
    value: "backup",
    label: "Create Backup",
    icon: <BsCloudUpload className="h-4 w-4 text-blue-500" />,
  },
  {
    value: "command",
    label: "Run Command",
    icon: <BsTerminal className="h-4 w-4 text-purple-500" />,
  },
];

// Cron helper types and functions - MUST be defined before component
interface CronState {
  frequency: "daily" | "weekly" | "custom";
  daysOfWeek: number[]; // 0 = Sunday, 6 = Saturday
  hour: number;
  minute: number;
}

const parseCronToCronState = (cronExpr: string): CronState => {
  // Default safe state
  const defaultState: CronState = {
    frequency: "daily",
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    hour: 4,
    minute: 0,
  };

  try {
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length < 5) return defaultState;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    // Try to parse minute and hour
    const parsedMinute = parseInt(minute!);
    const parsedHour = parseInt(hour!);

    if (isNaN(parsedMinute) || isNaN(parsedHour)) return defaultState;

    // Check if it's a weekly schedule (specific days)
    if (dayOfWeek !== "*" && dayOfMonth === "*") {
      const days = dayOfWeek!
        .split(",")
        .map((d) => parseInt(d))
        .filter((d) => !isNaN(d));
      if (days.length > 0) {
        return {
          frequency: "weekly",
          daysOfWeek: days,
          hour: parsedHour,
          minute: parsedMinute,
        };
      }
    }

    // Default to daily
    return {
      frequency: "daily",
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      hour: parsedHour,
      minute: parsedMinute,
    };
  } catch {
    return defaultState;
  }
};

const cronStateToCron = (state: CronState): string => {
  const { minute, hour, daysOfWeek, frequency } = state;

  if (frequency === "weekly" && daysOfWeek.length > 0) {
    const days = daysOfWeek.sort().join(",");
    return `${minute} ${hour} * * ${days}`;
  }

  // Daily
  return `${minute} ${hour} * * *`;
};

const formatCronExpression = (cronExpr: string): string => {
  try {
    const state = parseCronToCronState(cronExpr);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Format time
    const ampm = state.hour >= 12 ? "PM" : "AM";
    const displayHour = state.hour % 12 || 12;
    const timeStr = `${displayHour}:${String(state.minute).padStart(2, "0")}${ampm}`;

    if (state.frequency === "weekly") {
      const days = state.daysOfWeek
        .sort()
        .map((d) => dayNames[d])
        .join(", ");
      return `${days} @ ${timeStr}`;
    }

    // Daily
    return `Every day @ ${timeStr}`;
  } catch {
    return "Custom schedule";
  }
};

const SchedulesPage = (): JSX.Element | null => {
  const params = useParams();
  const serverId = params.id as string;
  const { server, isInstalling } = useServer();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [visualizerOpen, setVisualizerOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formTasks, setFormTasks] = useState<LocalTask[]>([]);
  const [formCron, setFormCron] = useState("0 4 * * *");
  const [formEnabled, setFormEnabled] = useState(true);
  const [cronState, setCronState] = useState<CronState>(() => parseCronToCronState("0 4 * * *"));

  const fetchSchedules = useCallback(async () => {
    try {
      const data = await servers.schedules.list(serverId);
      setSchedules(data);
    } catch (error) {
      toast.error("Failed to fetch schedules");
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Listen for schedule execution updates via WebSocket
  const { lastMessage } = useServerWebSocket(serverId);
  useEffect(() => {
    if (lastMessage?.type === "schedule:executing" && lastMessage.data) {
      const data = lastMessage.data as { schedule_id: string; task_index: number | null };

      setSchedules((prev) => {
        const updated = prev.map((schedule) => {
          if (schedule.id === data.schedule_id) {
            return { ...schedule, executingTaskIndex: data.task_index ?? null };
          }
          return schedule;
        });
        return updated;
      });
    }
  }, [lastMessage]);

  const MAX_TASKS = 12;

  const addTask = useCallback((action: ActionType) => {
    setFormTasks((prev) => {
      if (prev.length >= MAX_TASKS) return prev;
      const newTask: LocalTask = {
        id: `task-${Date.now()}`,
        action,
        payload: action === "command" ? "" : undefined,
        sequence: prev.length,
        timeOffset: 0,
        triggerMode: "TIME_DELAY",
      };
      return [...prev, newTask];
    });
  }, []);

  const removeTask = useCallback((taskId: string) => {
    setFormTasks((prev) =>
      prev.filter((t) => t.id !== taskId).map((t, i) => ({ ...t, sequence: i }))
    );
  }, []);

  const updateTaskPayload = useCallback((taskId: string, payload: string) => {
    setFormTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, payload } : t)));
  }, []);

  const updateTaskOffset = useCallback((taskId: string, offset: number) => {
    setFormTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, timeOffset: offset } : t)));
  }, []);

  const updateTaskTriggerMode = useCallback(
    (taskId: string, mode: "TIME_DELAY" | "ON_COMPLETION") => {
      setFormTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, triggerMode: mode } : t)));
    },
    []
  );

  const moveTask = useCallback((fromIndex: number, toIndex: number) => {
    setFormTasks((prev) => {
      const newTasks = [...prev];
      const [movedTask] = newTasks.splice(fromIndex, 1);

      // If moving to first position and task is waiting for completion, force TIME_DELAY
      if (toIndex === 0 && movedTask?.triggerMode === "ON_COMPLETION") {
        movedTask!.triggerMode = "TIME_DELAY";
        movedTask!.timeOffset = 0;
      }

      if (movedTask) newTasks.splice(toIndex, 0, movedTask);
      return newTasks.map((t, i) => ({ ...t, sequence: i }));
    });
  }, []);

  const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([]);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const toggleTaskExpanded = useCallback((taskId: string) => {
    setExpandedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  }, []);

  const getActionIcon = useCallback((action: string) => {
    const option = actionOptions.find((o) => o.value === action);
    return option?.icon || null;
  }, []);

  const getActionLabel = useCallback((action: string) => {
    const option = actionOptions.find((o) => o.value === action);
    return option?.label || action;
  }, []);

  const updateCronState = useCallback((updates: Partial<CronState>) => {
    setCronState((prev) => {
      const newState = { ...prev, ...updates };
      setFormCron(cronStateToCron(newState));
      return newState;
    });
  }, []);

  const isFormValid =
    formName.trim() !== "" &&
    formCron.trim() !== "" &&
    formTasks.length > 0 &&
    formTasks.every((t) => {
      if (t.action === "command") {
        return t.payload && t.payload.trim() !== "";
      }
      return true;
    });

  const ScheduleForm = useMemo(
    () => (
      <div>
        {/* Schedule Info Section */}
        <div className="space-y-4 border-b border-zinc-700 pb-6">
          <div>
            <Label className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              Schedule Name
            </Label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Daily Maintenance"
              disabled={isSaving}
              autoFocus
              className={cn(
                "mt-2 transition-all",
                "border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600"
              )}
            />
          </div>

          <div>
            <Label className="mb-3 block text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              Schedule
            </Label>

            {/* Frequency Selector */}
            <div className="mb-4 space-y-3">
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    checked={cronState.frequency === "daily"}
                    onChange={() =>
                      updateCronState({ frequency: "daily", daysOfWeek: [0, 1, 2, 3, 4, 5, 6] })
                    }
                    disabled={isSaving}
                    className="cursor-pointer"
                  />
                  <span className="text-sm text-zinc-200">Daily</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    checked={cronState.frequency === "weekly"}
                    onChange={() => updateCronState({ frequency: "weekly" })}
                    disabled={isSaving}
                    className="cursor-pointer"
                  />
                  <span className="text-sm text-zinc-200">Weekly</span>
                </label>
              </div>
            </div>

            {/* Days of Week (Weekly Only) */}
            {cronState.frequency === "weekly" && (
              <div className="mb-4 rounded-lg border border-zinc-700 bg-zinc-800/30 p-3">
                <p className="mb-2 text-xs text-zinc-400">Select Days:</p>
                <div className="grid grid-cols-7 gap-1">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
                    <label
                      key={day}
                      className={cn(
                        "flex h-8 cursor-pointer items-center justify-center rounded text-xs font-medium transition-all",
                        cronState.daysOfWeek.includes(index)
                          ? "bg-blue-500 text-white"
                          : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={cronState.daysOfWeek.includes(index)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateCronState({
                              daysOfWeek: [...cronState.daysOfWeek, index],
                            });
                          } else {
                            updateCronState({
                              daysOfWeek: cronState.daysOfWeek.filter((d) => d !== index),
                            });
                          }
                        }}
                        disabled={isSaving}
                        className="hidden"
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Time (Hour & Minute) */}
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-2 block text-xs text-zinc-500">Hour (0-23)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={cronState.hour}
                  onChange={(e) =>
                    updateCronState({
                      hour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)),
                    })
                  }
                  disabled={isSaving}
                  className={cn(
                    "text-sm",
                    "border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600"
                  )}
                />
              </div>
              <div>
                <Label className="mb-2 block text-xs text-zinc-500">Minute (0-59)</Label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={cronState.minute}
                  onChange={(e) =>
                    updateCronState({
                      minute: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)),
                    })
                  }
                  disabled={isSaving}
                  className={cn(
                    "text-sm",
                    "border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600"
                  )}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Label className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              Enable Schedule
            </Label>
            <Switch checked={formEnabled} onCheckedChange={setFormEnabled} disabled={isSaving} />
          </div>
        </div>

        {/* Tasks Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              Task Sequence ({formTasks.length}/{MAX_TASKS})
            </Label>
            <div className="flex items-center gap-2">
              {formTasks.length >= MAX_TASKS && (
                <span className={cn("text-xs font-semibold", "text-amber-400")}>
                  Maximum Tasks Reached
                </span>
              )}
              {formTasks.length > 0 && (
                <TextureButton
                  variant="minimal"
                  size="sm"
                  onClick={() => setVisualizerOpen(true)}
                  title="Visualize schedule flow"
                >
                  <BsEye className="h-3.5 w-3.5" />
                  <span className="text-xs">Visualize</span>
                </TextureButton>
              )}
            </div>
          </div>

          {/* Task Cards */}
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-2">
            {formTasks.length === 0 ? (
              <div
                className={cn(
                  "rounded-lg border-2 border-dashed p-8 text-center",
                  "border-zinc-600 bg-zinc-900/50"
                )}
              >
                <p className={cn("text-sm", "text-zinc-500")}>
                  No tasks yet. Add one using the buttons below.
                </p>
              </div>
            ) : (
              formTasks.map((task, index) => (
                <div key={task.id}>
                  {/* Task Card */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverIndex(index);
                    }}
                    onDragLeave={() => setDragOverIndex(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverIndex(null);
                      if (!draggedTaskId || draggedTaskId === task.id) return;
                      const draggedIndex = formTasks.findIndex((t) => t.id === draggedTaskId);
                      moveTask(draggedIndex, index);
                    }}
                    className={cn(
                      "relative rounded-lg border-2 transition-all",
                      draggedTaskId === task.id
                        ? "border-blue-500 bg-blue-900/20 opacity-75"
                        : dragOverIndex === index
                          ? "border-blue-400 bg-blue-500/10 ring-2 ring-blue-400 ring-offset-2 ring-offset-zinc-900"
                          : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                    )}
                  >
                    <div
                      onClick={() => toggleTaskExpanded(task.id)}
                      className="flex cursor-pointer items-center gap-4 p-4"
                    >
                      {/* Drag Handle & Index */}
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          setDraggedTaskId(task.id);
                        }}
                        onDragEnd={() => setDraggedTaskId(null)}
                        className="flex shrink-0 cursor-grab items-center gap-2 active:cursor-grabbing"
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded font-semibold",
                            "bg-zinc-700 text-zinc-200"
                          )}
                        >
                          {index + 1}
                        </div>
                        <div className={cn("text-xs text-zinc-500 select-none")}>⋮⋮</div>
                      </div>

                      {/* Action Icon & Label */}
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="shrink-0">{getActionIcon(task.action)}</div>
                        <div className="min-w-0">
                          <p className={cn("font-medium", "text-zinc-100")}>
                            {getActionLabel(task.action)}
                          </p>
                          {task.action === "command" && task.payload && (
                            <p className={cn("truncate text-xs", "text-zinc-400")}>
                              {task.payload}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Trigger Badge */}
                      <div className="shrink-0">
                        <div
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium",
                            task.triggerMode === "TIME_DELAY"
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-purple-500/20 text-purple-300"
                          )}
                        >
                          {task.triggerMode === "TIME_DELAY" ? (
                            <>
                              <BsClock className="h-3 w-3" />
                              {task.timeOffset}s
                            </>
                          ) : (
                            <>
                              <BsArrowRepeat className="h-3 w-3" />
                              Wait
                            </>
                          )}
                        </div>
                      </div>

                      {/* Delete Button */}
                      <TextureButton
                        variant="minimal"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTask(task.id);
                        }}
                        disabled={isSaving}
                        className="shrink-0"
                      >
                        <BsX className="h-4 w-4 text-red-400" />
                      </TextureButton>

                      {/* Expand/Collapse Chevron */}
                      <div className="shrink-0 text-zinc-400">
                        <BsChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform duration-200",
                            expandedTaskIds.includes(task.id) ? "rotate-180" : ""
                          )}
                        />
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedTaskIds.includes(task.id) && (
                      <div className={cn("space-y-4 border-t border-zinc-700 bg-zinc-900/50 p-4")}>
                        {/* Command Payload */}
                        {task.action === "command" && (
                          <div>
                            <Label className="text-xs font-semibold text-zinc-400">Command</Label>
                            <Input
                              value={task.payload || ""}
                              onChange={(e) => updateTaskPayload(task.id, e.target.value)}
                              placeholder="Enter command to execute..."
                              disabled={isSaving}
                              className={cn(
                                "mt-2 font-mono text-sm",
                                "border-zinc-600 bg-zinc-800 text-zinc-100"
                              )}
                            />
                          </div>
                        )}

                        {/* Trigger Mode Selection */}
                        <div>
                          <Label className="mb-3 block text-xs font-semibold text-zinc-400">
                            Execution Trigger
                          </Label>
                          <div className="space-y-3">
                            {/* Time Delay Option */}
                            <div
                              className={cn(
                                "cursor-pointer rounded-lg border-2 p-3 transition-all",
                                task.triggerMode === "TIME_DELAY"
                                  ? "border-primary/50 bg-primary/10"
                                  : "border-zinc-700 bg-zinc-800/30 hover:border-zinc-600"
                              )}
                              onClick={() => updateTaskTriggerMode(task.id, "TIME_DELAY")}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="radio"
                                  checked={task.triggerMode === "TIME_DELAY"}
                                  onChange={() => {}}
                                  className="mt-1 cursor-pointer"
                                  disabled={isSaving}
                                />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-zinc-100">Time Delay</p>
                                  <p className="mt-1 text-xs text-zinc-400">
                                    Wait a fixed number of seconds before executing this task
                                  </p>
                                  {task.triggerMode === "TIME_DELAY" && (
                                    <div className="mt-3 flex items-center gap-2">
                                      <BsClock className="h-3 w-3 text-blue-400" />
                                      <Input
                                        type="number"
                                        value={task.timeOffset}
                                        onChange={(e) =>
                                          updateTaskOffset(task.id, parseInt(e.target.value) || 0)
                                        }
                                        min={0}
                                        disabled={isSaving}
                                        className={cn(
                                          "w-20 text-sm",
                                          "border-zinc-600 bg-zinc-800 text-zinc-100"
                                        )}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <span className="text-xs text-zinc-500">seconds</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Completion Wait Option */}
                            <div
                              className={cn(
                                "cursor-pointer rounded-lg border-2 p-3 transition-all",
                                task.triggerMode === "ON_COMPLETION"
                                  ? "border-primary/50 bg-primary/10"
                                  : index === 0
                                    ? "cursor-not-allowed border-zinc-700 bg-zinc-800/30 opacity-50"
                                    : "border-zinc-700 bg-zinc-800/30 hover:border-zinc-600"
                              )}
                              onClick={() => {
                                if (index > 0) updateTaskTriggerMode(task.id, "ON_COMPLETION");
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="radio"
                                  checked={task.triggerMode === "ON_COMPLETION"}
                                  onChange={() => {}}
                                  className="mt-1 cursor-pointer"
                                  disabled={isSaving || index === 0}
                                />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-zinc-100">
                                    Wait for Completion
                                  </p>
                                  <p className="mt-1 text-xs text-zinc-400">
                                    {index === 0
                                      ? "Not available for the first task"
                                      : "Wait for the previous task to complete before starting"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Flow Arrow (between tasks) */}
                  {index < formTasks.length - 1 && (
                    <div className="flex justify-center py-2">
                      <div
                        className={cn(
                          "h-6 w-0.5",
                          task.triggerMode === "TIME_DELAY"
                            ? "bg-gradient-to-b from-blue-500 to-blue-400"
                            : "bg-gradient-to-b from-purple-500 to-purple-400"
                        )}
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add Task Buttons */}
          <div className="border-t border-zinc-700 pt-4">
            <p className="mb-3 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              Add Task
            </p>
            <div className="flex flex-row flex-wrap gap-2">
              {actionOptions.map((opt) => (
                <TextureButton
                  key={opt.value}
                  variant="minimal"
                  onClick={() => addTask(opt.value)}
                  disabled={formTasks.length >= MAX_TASKS || isSaving}
                >
                  {opt.icon}
                  <span className="truncate text-xs">{opt.label}</span>
                </TextureButton>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    [
      formName,
      formTasks,
      formCron,
      formEnabled,
      isSaving,
      cronState,
      expandedTaskIds,
      draggedTaskId,
      dragOverIndex,
      updateTaskPayload,
      updateTaskOffset,
      updateTaskTriggerMode,
      updateCronState,
      removeTask,
      addTask,
      moveTask,
      toggleTaskExpanded,
      getActionIcon,
      getActionLabel,
      setVisualizerOpen,
    ]
  );

  if (isInstalling) {
    return (
      <div className="min-h-svh">
        {/* Background is now rendered in the layout for persistence */}
        <ServerInstallingPlaceholder serverName={server?.name} />
      </div>
    );
  }

  if (server?.status === "SUSPENDED") {
    return (
      <div className="min-h-svh">
        <ServerSuspendedPlaceholder serverName={server?.name} />
      </div>
    );
  }

  const resetForm = () => {
    setFormName("");
    setFormTasks([]);
    setFormCron("0 4 * * *");
    setFormEnabled(true);
    setCronState(parseCronToCronState("0 4 * * *"));
    setExpandedTaskIds([]);
    setDraggedTaskId(null);
    setDragOverIndex(null);
  };

  const openCreateModal = () => {
    resetForm();
    setCreateModalOpen(true);
  };

  const openEditModal = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setFormName(schedule.name);
    setFormTasks(
      schedule.tasks.map((t, i) => ({
        id: t.id || `task-${i}-${Date.now()}`,
        action: t.action as ActionType,
        payload: t.payload,
        sequence: t.sequence,
        timeOffset: t.timeOffset,
        triggerMode: (t.triggerMode as "TIME_DELAY" | "ON_COMPLETION") || "TIME_DELAY",
      }))
    );
    setFormCron(schedule.cronExpression);
    setCronState(parseCronToCronState(schedule.cronExpression));
    setFormEnabled(schedule.isActive);
    setExpandedTaskIds([]);
    setDraggedTaskId(null);
    setDragOverIndex(null);
    setEditModalOpen(true);
  };

  const openDeleteModal = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setDeleteModalOpen(true);
  };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const data: CreateScheduleData = {
        name: formName,
        cronExpression: formCron,
        isActive: formEnabled,
        tasks: formTasks.map((t, i) => ({
          action: t.action,
          payload: t.payload,
          sequence: i,
          timeOffset: t.timeOffset,
          triggerMode: t.triggerMode,
        })),
      };
      await servers.schedules.create(serverId, data);
      toast.success("Schedule created");
      setCreateModalOpen(false);
      resetForm();
      fetchSchedules();
    } catch (error) {
      toast.error("Failed to create schedule");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedSchedule) return;
    setIsSaving(true);
    try {
      const data: CreateScheduleData = {
        name: formName,
        cronExpression: formCron,
        isActive: formEnabled,
        tasks: formTasks.map((t, i) => ({
          action: t.action,
          payload: t.payload,
          sequence: i,
          timeOffset: t.timeOffset,
          triggerMode: t.triggerMode,
        })),
      };
      await servers.schedules.update(serverId, selectedSchedule.id, data);
      toast.success("Schedule updated");
      setEditModalOpen(false);
      setSelectedSchedule(null);
      fetchSchedules();
    } catch (error) {
      toast.error("Failed to update schedule");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSchedule) return;
    try {
      await servers.schedules.delete(serverId, selectedSchedule.id);
      toast.success("Schedule deleted");
      setDeleteModalOpen(false);
      setSelectedSchedule(null);
      fetchSchedules();
    } catch (error) {
      toast.error("Failed to delete schedule");
    }
  };

  const toggleSchedule = async (schedule: Schedule) => {
    try {
      await servers.schedules.update(serverId, schedule.id, {
        name: schedule.name,
        cronExpression: schedule.cronExpression,
        isActive: !schedule.isActive,
        tasks: schedule.tasks.map((t) => ({
          action: t.action,
          payload: t.payload,
          sequence: t.sequence,
          timeOffset: t.timeOffset,
          triggerMode: t.triggerMode || "TIME_DELAY",
        })),
      });
      fetchSchedules();
    } catch (error) {
      toast.error("Failed to update schedule");
    }
  };

  const formatNextRun = (schedule: Schedule): string => {
    if (schedule.nextRunAt) {
      return new Date(schedule.nextRunAt).toLocaleString();
    }
    return "Not scheduled";
  };

  const formatLastRun = (schedule: Schedule): string => {
    if (schedule.lastRunAt) {
      return new Date(schedule.lastRunAt).toLocaleString();
    }
    return "Never";
  };

  const runScheduleNow = async (schedule: Schedule) => {
    try {
      setIsSaving(true);
      await servers.schedules.run(serverId, schedule.id);
      toast.success(`Running schedule: ${schedule.name}`);
      // Refresh schedules to get updated lastRunAt
      setTimeout(fetchSchedules, 1000);
    } catch (error) {
      toast.error("Failed to execute schedule");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-black px-4 pb-4">
          {/* Header */}
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger
                  className={cn(
                    "text-zinc-400 transition-all hover:scale-110 hover:text-zinc-100 active:scale-95"
                  )}
                />
              </div>
              <div className="flex items-center gap-2">
                <TextureButton
                  variant="primary"
                  size="sm"
                  className="w-fit"
                  onClick={openCreateModal}
                >
                  <BsPlus className="h-4 w-4" />
                  New Schedule
                </TextureButton>
              </div>
            </div>
          </FadeIn>

          {/* Schedules Card */}
          <FadeIn delay={0.05}>
            <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
              <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
                <div className="flex items-center gap-2 text-xs opacity-50">
                  <BsCalendar className="h-3 w-3" />
                  Schedules
                </div>
                <span className="text-xs text-zinc-500">
                  {schedules.length} schedule{schedules.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner />
                  </div>
                ) : schedules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <BsCalendar className="mb-4 h-12 w-12 text-zinc-600" />
                    <h3 className="mb-2 text-sm font-medium text-zinc-300">No Schedules</h3>
                    <p className="mb-4 text-xs text-zinc-500">
                      Create your first schedule to automate tasks.
                    </p>
                    <TextureButton
                      variant="minimal"
                      size="sm"
                      className="w-fit"
                      onClick={openCreateModal}
                    >
                      <BsPlus className="h-4 w-4" />
                      New Schedule
                    </TextureButton>
                  </div>
                ) : (
                  schedules.map((schedule, index) => (
                    <div
                      key={schedule.id}
                      className={cn(
                        "p-4 transition-colors hover:bg-zinc-800/20",
                        index !== schedules.length - 1 && "border-b border-zinc-800/50",
                        !schedule.isActive && "opacity-50"
                      )}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1">
                          <div className="mb-3 flex items-center gap-3">
                            <h3 className="text-sm font-medium text-zinc-100">{schedule.name}</h3>
                            <span className="rounded border border-zinc-600 bg-white/10 px-2 py-0.5 text-[10px] font-medium tracking-wider text-zinc-400 uppercase">
                              {schedule.tasks.length} task{schedule.tasks.length !== 1 ? "s" : ""}
                            </span>
                          </div>

                          {/* Task list preview */}
                          <div className="mb-3 flex h-full flex-wrap items-center gap-2">
                            {schedule.tasks.map((task, taskIndex) => {
                              const isExecuting = schedule.executingTaskIndex === taskIndex;
                              return (
                                <div
                                  className="flex h-full flex-row items-center justify-center gap-2"
                                  key={`task-wrapper-${task.id}`}
                                >
                                  <div
                                    key={task.id}
                                    className={cn(
                                      "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-all",
                                      isExecuting
                                        ? "border-blue-500 bg-blue-900/30 ring-1 ring-blue-500/50"
                                        : "border-zinc-700 bg-zinc-800/50"
                                    )}
                                  >
                                    {isExecuting && <Spinner className="h-3 w-3 text-blue-400" />}
                                    <span className="text-[10px] text-zinc-500">
                                      {taskIndex + 1}.
                                    </span>
                                    <span className="text-zinc-300">
                                      {getActionLabel(task.action)}
                                    </span>
                                    {task.timeOffset > 0 && (
                                      <span className="text-[10px] text-zinc-500">
                                        +{task.timeOffset}s
                                      </span>
                                    )}
                                  </div>
                                  {taskIndex < schedule.tasks.length - 1 && (
                                    <div className="flex h-6 w-3 items-center">
                                      <BsArrowRight
                                        key={`arrow-${task.id}`}
                                        className="text-zinc-500"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                            <span>{formatCronExpression(schedule.cronExpression)}</span>
                            <span>•</span>
                            <span>Next: {formatNextRun(schedule)}</span>
                            <span>•</span>
                            <span>Last: {formatLastRun(schedule)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 md:ml-4">
                          <Switch
                            checked={schedule.isActive}
                            onCheckedChange={() => toggleSchedule(schedule)}
                          />
                          <TextureButton
                            variant="minimal"
                            size="sm"
                            className="w-fit"
                            onClick={() => runScheduleNow(schedule)}
                            disabled={isSaving}
                            title="Run this schedule now"
                          >
                            <BsPlayFill className="h-4 w-4" />
                          </TextureButton>
                          <TextureButton
                            variant="minimal"
                            size="sm"
                            className="w-fit"
                            onClick={() => openEditModal(schedule)}
                          >
                            <BsPencil className="h-4 w-4" />
                          </TextureButton>
                          <TextureButton
                            variant="destructive"
                            size="sm"
                            className="w-fit"
                            onClick={() => openDeleteModal(schedule)}
                          >
                            <BsTrash className="h-4 w-4" />
                          </TextureButton>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Create Schedule Modal */}
      <FormModal
        open={createModalOpen}
        onOpenChange={(open) => !isSaving && setCreateModalOpen(open)}
        title="Create Schedule"
        description="Set up a new scheduled task sequence for your server."
        onSubmit={handleCreate}
        submitLabel={isSaving ? "Creating..." : "Create"}
        isValid={isFormValid && !isSaving}
        size="lg"
      >
        {ScheduleForm}
      </FormModal>

      {/* Edit Schedule Modal */}
      <FormModal
        open={editModalOpen}
        onOpenChange={(open) => !isSaving && setEditModalOpen(open)}
        title="Edit Schedule"
        description={`Modify "${selectedSchedule?.name}" schedule.`}
        onSubmit={handleEdit}
        submitLabel={isSaving ? "Saving..." : "Save Changes"}
        isValid={isFormValid && !isSaving}
        size="lg"
      >
        {ScheduleForm}
      </FormModal>

      {/* Delete Schedule Modal */}
      <ConfirmationModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Delete Schedule"
        description={`Are you sure you want to delete "${selectedSchedule?.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
      />

      {/* Schedule Visualizer */}
      {formTasks.length > 0 && (
        <ScheduleVisualizer
          schedule={{
            name: formName || "Untitled Schedule",
            cronExpression: formCron,
            tasks: formTasks,
          }}
          open={visualizerOpen}
          onOpenChange={setVisualizerOpen}
        />
      )}
    </FadeIn>
  );
};

export default SchedulesPage;
