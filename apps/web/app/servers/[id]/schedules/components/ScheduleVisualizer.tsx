"use client";

import "@xyflow/react/dist/style.css";
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  Node,
  Edge,
  useReactFlow,
  ConnectionLineType,
} from "@xyflow/react";
import React, { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet";
import { TextureButton } from "@workspace/ui/components/texture-button";
import { ZoomIn, LayoutGrid } from "lucide-react";

import {
  ScheduleStartNode,
  ScheduleTaskNode,
  ScheduleEndNode,
  ScheduleStartNodeData,
  ScheduleTaskNodeData,
  ScheduleEndNodeData,
} from "./ScheduleFlowNodes";
import { TimeDelayEdge, OnCompletionEdge } from "./ScheduleFlowEdges";

// Type definitions
export interface ScheduleVisualizerData {
  name: string;
  cronExpression: string;
  tasks: Array<{
    id?: string;
    action: string;
    payload?: string;
    sequence: number;
    timeOffset: number;
    triggerMode?: "TIME_DELAY" | "ON_COMPLETION";
  }>;
}

interface VisualizerNode extends Node<any> {
  type: string;
}

type VisualizerEdge = Edge<{ timeOffset?: number; edgeIndex?: number }>;

// Format cron expression to human-readable
function formatCronExpression(cronExpr: string): string {
  try {
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length < 5) return cronExpr;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    // Simple formatting for common patterns
    if (dayOfMonth === "*" && month === "*") {
      if (dayOfWeek === "*") {
        return `Daily at ${hour}:${minute?.padStart(2, "0")}`;
      }
    }

    return cronExpr;
  } catch {
    return cronExpr;
  }
}

// Data transformation: Convert schedule to nodes and edges with vertical layout
function scheduleToNodesAndEdges(schedule: ScheduleVisualizerData): {
  nodes: VisualizerNode[];
  edges: VisualizerEdge[];
} {
  const nodes: VisualizerNode[] = [];
  const edges: VisualizerEdge[] = [];

  const verticalSpacing = 250;
  const centerX = 0;

  // Start node
  const startNodeData: ScheduleStartNodeData = {
    scheduleName: schedule.name,
    cronExpression: schedule.cronExpression,
    formattedCron: formatCronExpression(schedule.cronExpression),
  };

  nodes.push({
    id: "start",
    type: "scheduleStart",
    data: startNodeData,
    position: { x: centerX, y: 50 },
  });

  // Task nodes and edges
  schedule.tasks.forEach((task, index) => {
    const taskNodeData: ScheduleTaskNodeData = {
      id: task.id || `task-${index}`,
      sequence: index + 1,
      action: task.action,
      payload: task.payload,
      triggerMode: task.triggerMode || "TIME_DELAY",
      timeOffset: task.timeOffset,
    };

    nodes.push({
      id: `task-${index}`,
      type: "scheduleTask",
      data: taskNodeData,
      position: { x: centerX, y: 50 + (index + 1) * verticalSpacing },
    });

    // Edge from previous node to this task
    const sourceId = index === 0 ? "start" : `task-${index - 1}`;
    const triggerMode = task.triggerMode || "TIME_DELAY";

    edges.push({
      id: `edge-${sourceId}-to-task-${index}`,
      source: sourceId,
      target: `task-${index}`,
      type: triggerMode === "TIME_DELAY" ? "timeDelay" : "onCompletion",
      data: { timeOffset: task.timeOffset, edgeIndex: index },
      animated: true,
    });
  });

  // End node
  const endNodeData: ScheduleEndNodeData = {
    taskCount: schedule.tasks.length,
  };

  nodes.push({
    id: "end",
    type: "scheduleEnd",
    data: endNodeData,
    position: { x: centerX, y: 50 + (schedule.tasks.length + 1) * verticalSpacing },
  });

  // Edge from last task to end node
  const lastNodeId = schedule.tasks.length > 0 ? `task-${schedule.tasks.length - 1}` : "start";
  edges.push({
    id: `edge-${lastNodeId}-to-end`,
    source: lastNodeId,
    target: "end",
    type: "default",
    data: { edgeIndex: schedule.tasks.length },
    animated: false,
  });

  return { nodes, edges };
}

// Flow control panel component - this is inside ReactFlow context
const FlowControls = () => {
  const { fitView } = useReactFlow();

  return (
    <Panel position="top-right" className="flex gap-2">
      <TextureButton
        variant="minimal"
        size="icon"
        onClick={() => fitView({ padding: 0.2, maxZoom: 1 })}
        title="Fit to view"
      >
        <ZoomIn className="h-4 w-4" />
      </TextureButton>
    </Panel>
  );
};

// Main Visualizer Component with ReactFlow provider
const VisualizerFlow = ({ schedule }: { schedule: ScheduleVisualizerData }) => {
  const nodeTypes = useMemo(
    () => ({
      scheduleStart: ScheduleStartNode,
      scheduleTask: ScheduleTaskNode,
      scheduleEnd: ScheduleEndNode,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      timeDelay: TimeDelayEdge,
      onCompletion: OnCompletionEdge,
    }),
    []
  );

  const { nodes, edges } = useMemo(() => scheduleToNodesAndEdges(schedule), [schedule]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      // @ts-expect-error React Flow v12 NodeProps typing incompatibility
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      connectionLineType={ConnectionLineType.Bezier}
      fitView
      maxZoom={2}
      minZoom={0.1}
      panOnScroll={true}
      panOnDrag={true}
      selectionOnDrag={false}
      selectNodesOnDrag={false}
    >
      <Background color="#2a2a2a" gap={16} />
      <Controls
        position="bottom-right"
        showInteractive={false}
        className="border border-zinc-700/50 bg-zinc-900/50"
      />
      <FlowControls />
    </ReactFlow>
  );
};

// Main Visualizer Component
export const ScheduleVisualizer = ({
  schedule,
  open,
  onOpenChange,
}: {
  schedule: ScheduleVisualizerData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:w-4/5 md:w-3/4 lg:w-2/3">
        <SheetHeader className="border-b border-zinc-800 px-6 py-4">
          <SheetTitle>Schedule Flow: {schedule.name}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          <VisualizerFlow schedule={schedule} />
        </div>
      </SheetContent>
    </Sheet>
  );
};
