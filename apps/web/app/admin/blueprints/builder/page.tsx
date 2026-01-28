"use client";
import "@xyflow/react/dist/style.css";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Connection,
  ConnectionLineType,
  Controls,
  Edge,
  EdgeProps,
  getBezierPath,
  Handle,
  MiniMap,
  Node,
  Panel,
  Position,
  ReactFlow,
  useNodeId,
  useReactFlow,
  useNodes,
} from "@xyflow/react";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  Input,
  Switch,
} from "@workspace/ui/components";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { Download, Layout, Upload, X, FileCode } from "lucide-react";
import { motion } from "framer-motion";
import type { Blueprint, BlueprintVariable, PterodactylEgg } from "@/lib/api.types";

// ============================================================================
// Types
// ============================================================================

interface OutputNodeData extends Record<string, unknown> {
  name?: string;
  description?: string;
  author?: string;
  category?: string;
  updateUrl?: string;
  isPublic?: boolean;
}

interface DockerImageNodeData extends Record<string, unknown> {
  label?: string;
  image?: string;
}

interface VariableNodeData extends Record<string, unknown> {
  name?: string;
  description?: string;
  envVariable?: string;
  defaultValue?: string;
  rules?: string;
  fieldType?: string;
  userViewable?: boolean;
  userEditable?: boolean;
}

interface InstallScriptNodeData extends Record<string, unknown> {
  script?: string;
  container?: string;
  entrypoint?: string;
}

interface StartupCommandNodeData extends Record<string, unknown> {
  command?: string;
}

interface FeatureNodeData extends Record<string, unknown> {
  feature?: string;
}

interface ConfigNodeData extends Record<string, unknown> {
  files?: string;
  startup?: string;
  logs?: string;
  stop?: string;
}

type NodeData =
  | OutputNodeData
  | DockerImageNodeData
  | VariableNodeData
  | InstallScriptNodeData
  | StartupCommandNodeData
  | FeatureNodeData
  | ConfigNodeData;

type BlueprintNode = Node<NodeData>;

// ============================================================================
// Animated Edge Component
// ============================================================================

const AnimatedBezierEdge = (props: EdgeProps) => {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd } = props;

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <g>
      <path d={edgePath} stroke="#6b7280" strokeWidth={1.75} fill="none" markerEnd={markerEnd} />
      <motion.path
        d={edgePath}
        stroke="#FF5800"
        strokeWidth={3}
        fill="none"
        strokeDasharray="50, 9999"
        strokeLinecap="round"
        initial={{ strokeDashoffset: 0 }}
        animate={{ strokeDashoffset: -9999 }}
        transition={{
          duration: 4,
          ease: "easeInOut",
          repeat: Infinity,
          repeatDelay: 0.8,
        }}
        style={{ opacity: 0.9 }}
      />
    </g>
  );
};

// ============================================================================
// Auto Layout Hook
// ============================================================================

const useAutoLayout = () => {
  const { getNodes, setNodes, fitView } = useReactFlow<BlueprintNode>();
  const isDirtyRef = useRef(false);

  const layout = useCallback(async () => {
    if (isDirtyRef.current) return;
    isDirtyRef.current = true;

    const nodes = getNodes();

    const hiddenNodes = nodes.map((node) => ({ ...node, hidden: true }));
    setNodes(hiddenNodes);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const nodeData: Record<string, { width: number; height: number }> = {};
    const dockerImages: BlueprintNode[] = [];
    const variables: BlueprintNode[] = [];
    const features: BlueprintNode[] = [];
    let installScript: BlueprintNode | null = null;
    let startupCommand: BlueprintNode | null = null;
    let configNode: BlueprintNode | null = null;
    let outputNode: BlueprintNode | null = null;

    nodes.forEach((node) => {
      const element = document.querySelector(`[data-id="${node.id}"]`);
      const width = element?.clientWidth || 320;
      const height = element?.clientHeight || 150;
      nodeData[node.id] = { width, height };

      switch (node.type) {
        case "blueprintDockerImage":
          dockerImages.push(node);
          break;
        case "blueprintVariable":
          variables.push(node);
          break;
        case "blueprintFeature":
          features.push(node);
          break;
        case "bluePrintInstallScript":
          installScript = node;
          break;
        case "blueprintStartupCommand":
          startupCommand = node;
          break;
        case "blueprintConfig":
          configNode = node;
          break;
        case "blueprintOutput":
          outputNode = node;
          break;
      }
    });

    try {
      const layoutedNodes: BlueprintNode[] = [];
      const centerX = 400;
      let currentY = 50;

      // Helper to create positioned node
      const positionNode = (node: BlueprintNode, x: number, y: number): BlueprintNode => ({
        id: node.id,
        type: node.type,
        data: node.data,
        position: { x, y },
        hidden: false,
      });

      // Row 1: Docker Images (top, spread horizontally)
      const dockerStartX = centerX - (dockerImages.length * 340) / 2;
      dockerImages.forEach((node, index) => {
        layoutedNodes.push(positionNode(node, dockerStartX + index * 340, currentY));
      });
      if (dockerImages.length > 0) currentY += 200;

      // Row 2: Install Script (center)
      if (installScript) {
        layoutedNodes.push(positionNode(installScript, centerX - 192, currentY));
        currentY += 280;
      }

      // Row 3: Startup Command and Config side by side
      if (startupCommand || configNode) {
        if (startupCommand && configNode) {
          layoutedNodes.push(positionNode(startupCommand, centerX - 400, currentY));
          layoutedNodes.push(positionNode(configNode, centerX + 20, currentY));
        } else if (startupCommand) {
          layoutedNodes.push(positionNode(startupCommand, centerX - 192, currentY));
        } else if (configNode) {
          layoutedNodes.push(positionNode(configNode, centerX - 192, currentY));
        }
        currentY += 350;
      }

      // Row 4: Output (center)
      if (outputNode) {
        layoutedNodes.push(positionNode(outputNode, centerX - 160, currentY));
      }

      // Right side: Variables (vertically stacked)
      const varX = centerX + 500;
      variables.forEach((node, index) => {
        layoutedNodes.push(positionNode(node, varX, 50 + index * 420));
      });

      // Left side: Features (vertically stacked)
      const featureX = centerX - 700;
      features.forEach((node, index) => {
        layoutedNodes.push(positionNode(node, featureX, 50 + index * 150));
      });

      setNodes(layoutedNodes);

      setTimeout(() => {
        fitView({ padding: 0.15, maxZoom: 1 });
      }, 0);
    } catch (error) {
      console.error("Layout failed:", error);
      setNodes(nodes.map((n) => ({ ...n, hidden: false })));
    }

    isDirtyRef.current = false;
  }, [getNodes, setNodes, fitView]);

  return { layout };
};

// ============================================================================
// Node Components
// ============================================================================

const nodeBaseClasses =
  "relative flex flex-col rounded-lg border p-4 transition-colors border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20";

// Classes to prevent dragging when interacting with form elements
const noDragClasses = "nodrag nowheel";

interface NodeWrapperProps {
  children: React.ReactNode;
  nodeId: string | null;
  onDelete?: () => void;
  className?: string;
  title: string;
  titleColor?: string;
}

const NodeWrapper = ({
  children,
  nodeId,
  onDelete,
  className = "w-80",
  title,
  titleColor = "text-zinc-100",
}: NodeWrapperProps) => (
  <div data-id={nodeId} className={`${nodeBaseClasses} ${className}`}>
    {onDelete && (
      <button
        onClick={onDelete}
        className="absolute top-2 right-2 z-10 rounded p-1 transition-colors hover:bg-red-500/20"
        title="Delete node"
      >
        <X size={16} className="text-red-500" />
      </button>
    )}
    <Label className={`text-sm font-semibold ${titleColor}`}>{title}</Label>
    <div className={`${noDragClasses} mt-3`}>{children}</div>
  </div>
);

// Helper hook for node data updates
const useNodeData = <T extends NodeData>() => {
  const nodeId = useNodeId();
  const { getNode, setNodes } = useReactFlow();

  const updateData = useCallback(
    (updates: Partial<T>) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === nodeId) {
            return { ...node, data: { ...node.data, ...updates } };
          }
          return node;
        })
      );
    },
    [nodeId, setNodes]
  );

  const data = (getNode(nodeId!)?.data as T) || ({} as T);

  return { nodeId, data, updateData };
};

// Output Node
const BlueprintOutputNode = () => {
  const { nodeId, data, updateData } = useNodeData<OutputNodeData>();

  return (
    <NodeWrapper
      nodeId={nodeId}
      className="w-80"
      title="Blueprint Output"
      titleColor="text-orange-400"
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-500" id="target" />
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Name *</Label>
          <Input
            value={data.name || ""}
            onChange={(e) => updateData({ name: e.target.value })}
            placeholder="Blueprint name"
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Description</Label>
          <Textarea
            value={data.description || ""}
            onChange={(e) => updateData({ description: e.target.value })}
            placeholder="Brief description of the blueprint"
            className="mt-1 h-16 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Author</Label>
          <Input
            value={data.author || ""}
            onChange={(e) => updateData({ author: e.target.value })}
            placeholder="Author name or email"
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Category</Label>
          <Input
            value={data.category || ""}
            onChange={(e) => updateData({ category: e.target.value })}
            placeholder="e.g., Game Servers, Utilities"
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Update URL</Label>
          <Input
            value={data.updateUrl || ""}
            onChange={(e) => updateData({ updateUrl: e.target.value })}
            placeholder="URL for egg updates (optional)"
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Switch
            id={`${nodeId}-public`}
            checked={data.isPublic ?? true}
            onCheckedChange={(checked) => updateData({ isPublic: checked })}
          />
          <Label htmlFor={`${nodeId}-public`} className="text-xs">
            Public Blueprint
          </Label>
        </div>
      </div>
    </NodeWrapper>
  );
};

// Docker Image Node
const BlueprintDockerImageNode = () => {
  const { nodeId, data, updateData } = useNodeData<DockerImageNodeData>();
  const { getNodes, setNodes, getEdges, setEdges } = useReactFlow();

  const handleDelete = () => {
    setNodes(getNodes().filter((n) => n.id !== nodeId));
    setEdges(getEdges().filter((e) => e.source !== nodeId && e.target !== nodeId));
  };

  return (
    <NodeWrapper
      nodeId={nodeId}
      onDelete={handleDelete}
      className="w-80"
      title="Docker Image"
      titleColor="text-sky-400"
    >
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500" id="source" />
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Label *</Label>
          <Input
            value={data.label || ""}
            onChange={(e) => updateData({ label: e.target.value })}
            placeholder="e.g., Debian, Ubuntu"
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Image URL *</Label>
          <Input
            value={data.image || ""}
            onChange={(e) => updateData({ image: e.target.value })}
            placeholder="e.g., ghcr.io/ptero-eggs/steamcmd:dotnet"
            className="mt-1 h-8 text-xs"
          />
        </div>
      </div>
    </NodeWrapper>
  );
};

// Variable Node
const BlueprintVariableNode = () => {
  const { nodeId, data, updateData } = useNodeData<VariableNodeData>();
  const { getNodes, setNodes, getEdges, setEdges } = useReactFlow();

  const handleDelete = () => {
    setNodes(getNodes().filter((n) => n.id !== nodeId));
    setEdges(getEdges().filter((e) => e.source !== nodeId && e.target !== nodeId));
  };

  return (
    <NodeWrapper
      nodeId={nodeId}
      onDelete={handleDelete}
      className="w-80"
      title="Variable"
      titleColor="text-emerald-400"
    >
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500" id="source" />
      <div className="space-y-2">
        <div>
          <Label className="text-xs">Name *</Label>
          <Input
            value={data.name || ""}
            onChange={(e) => updateData({ name: e.target.value })}
            placeholder="e.g., [STEAM] AppID"
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Description</Label>
          <Input
            value={data.description || ""}
            onChange={(e) => updateData({ description: e.target.value })}
            placeholder="Description for users"
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Environment Variable *</Label>
          <Input
            value={data.envVariable || ""}
            onChange={(e) => updateData({ envVariable: e.target.value })}
            placeholder="e.g., SRCDS_APPID"
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Default Value</Label>
          <Input
            value={data.defaultValue || ""}
            onChange={(e) => updateData({ defaultValue: e.target.value })}
            placeholder="Default value"
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Rules</Label>
          <Input
            value={data.rules || ""}
            onChange={(e) => updateData({ rules: e.target.value })}
            placeholder="e.g., required|string|in:739590"
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Field Type</Label>
          <Input
            value={data.fieldType || ""}
            onChange={(e) => updateData({ fieldType: e.target.value })}
            placeholder="e.g., text, number, boolean"
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div className="flex gap-4 pt-1">
          <div className="flex items-center gap-2">
            <Switch
              id={`${nodeId}-viewable`}
              checked={data.userViewable ?? true}
              onCheckedChange={(checked) => updateData({ userViewable: checked })}
            />
            <Label htmlFor={`${nodeId}-viewable`} className="text-xs">
              Viewable
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id={`${nodeId}-editable`}
              checked={data.userEditable ?? true}
              onCheckedChange={(checked) => updateData({ userEditable: checked })}
            />
            <Label htmlFor={`${nodeId}-editable`} className="text-xs">
              Editable
            </Label>
          </div>
        </div>
      </div>
    </NodeWrapper>
  );
};

// Install Script Node
const BlueprintInstallScriptNode = () => {
  const { nodeId, data, updateData } = useNodeData<InstallScriptNodeData>();

  return (
    <NodeWrapper
      nodeId={nodeId}
      className="w-96"
      title="Installation Script"
      titleColor="text-violet-400"
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-500" id="target" />
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500" id="source" />
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Container Image</Label>
          <Input
            value={data.container || ""}
            onChange={(e) => updateData({ container: e.target.value })}
            placeholder="e.g., ghcr.io/ptero-eggs/installers:debian"
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Entrypoint</Label>
          <Input
            value={data.entrypoint || ""}
            onChange={(e) => updateData({ entrypoint: e.target.value })}
            placeholder="e.g., bash"
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Script *</Label>
          <Textarea
            value={data.script || ""}
            onChange={(e) => updateData({ script: e.target.value })}
            placeholder="#!/bin/bash&#10;# Installation script..."
            className="mt-1 h-32 font-mono text-xs"
          />
        </div>
      </div>
    </NodeWrapper>
  );
};

// Startup Command Node
const BlueprintStartupCommandNode = () => {
  const { nodeId, data, updateData } = useNodeData<StartupCommandNodeData>();

  return (
    <NodeWrapper
      nodeId={nodeId}
      className="w-96"
      title="Startup Command"
      titleColor="text-amber-400"
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-500" id="target" />
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500" id="source" />
      <div>
        <Label className="text-xs">Command *</Label>
        <Textarea
          value={data.command || ""}
          onChange={(e) => updateData({ command: e.target.value })}
          placeholder="e.g., ./EcoServer --username={{SLG_USER}} --password={{SLG_PW}}"
          className="mt-1 h-20 font-mono text-xs"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Use {"{{VAR_NAME}}"} syntax for variable substitution
        </p>
      </div>
    </NodeWrapper>
  );
};

// Config Node
const BlueprintConfigNode = () => {
  const { nodeId, data, updateData } = useNodeData<ConfigNodeData>();
  const { getNodes, setNodes, getEdges, setEdges } = useReactFlow();

  const handleDelete = () => {
    setNodes(getNodes().filter((n) => n.id !== nodeId));
    setEdges(getEdges().filter((e) => e.source !== nodeId && e.target !== nodeId));
  };

  return (
    <NodeWrapper
      nodeId={nodeId}
      onDelete={handleDelete}
      className="w-96"
      title="Configuration"
      titleColor="text-pink-400"
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-500" id="target" />
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500" id="source" />
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Stop Command</Label>
          <Input
            value={data.stop || ""}
            onChange={(e) => updateData({ stop: e.target.value })}
            placeholder="e.g., stop, exit, ^C"
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Startup Detection (JSON)</Label>
          <Textarea
            value={data.startup || ""}
            onChange={(e) => updateData({ startup: e.target.value })}
            placeholder='{"done": "Server started"}'
            className="mt-1 h-16 font-mono text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">File Parser Config (JSON)</Label>
          <Textarea
            value={data.files || ""}
            onChange={(e) => updateData({ files: e.target.value })}
            placeholder='{"server.properties": {"parser": "properties", "find": {...}}}'
            className="mt-1 h-20 font-mono text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Log Config (JSON)</Label>
          <Textarea
            value={data.logs || ""}
            onChange={(e) => updateData({ logs: e.target.value })}
            placeholder="{}"
            className="mt-1 h-12 font-mono text-xs"
          />
        </div>
      </div>
    </NodeWrapper>
  );
};

// Feature Node
const BlueprintFeatureNode = () => {
  const { nodeId, data, updateData } = useNodeData<FeatureNodeData>();
  const { getNodes, setNodes, getEdges, setEdges } = useReactFlow();

  const handleDelete = () => {
    setNodes(getNodes().filter((n) => n.id !== nodeId));
    setEdges(getEdges().filter((e) => e.source !== nodeId && e.target !== nodeId));
  };

  return (
    <NodeWrapper
      nodeId={nodeId}
      onDelete={handleDelete}
      className="w-72"
      title="Feature"
      titleColor="text-cyan-400"
    >
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500" id="source" />
      <div>
        <Label className="text-xs">Feature Tag *</Label>
        <Input
          value={data.feature || ""}
          onChange={(e) => updateData({ feature: e.target.value })}
          placeholder="e.g., steam_disk_space, eula"
          className="mt-1 h-8 text-xs"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Common: steam_disk_space, eula, java_version, pid_limit
        </p>
      </div>
    </NodeWrapper>
  );
};

// ============================================================================
// Conversion Functions
// ============================================================================

const nodesToBlueprint = (nodes: Node[], edges: Edge[]): Partial<Blueprint> => {
  const blueprint: Partial<Blueprint> = {
    metaVersion: "PTDL_v2",
    dockerImages: {},
    variables: [],
    features: [],
    fileDenylist: [],
    config: {},
    scripts: {},
    dockerConfig: {
      stdin_open: true,
      tty: true,
      environment: {},
      volumes: [{ name: "data", target: "/home/container" }],
    },
  };

  nodes.forEach((node) => {
    switch (node.type) {
      case "blueprintOutput": {
        const data = node.data as OutputNodeData;
        blueprint.name = data.name || "Untitled Blueprint";
        blueprint.description = data.description;
        blueprint.author = data.author;
        blueprint.category = data.category;
        blueprint.updateUrl = data.updateUrl;
        blueprint.isPublic = data.isPublic ?? true;
        break;
      }
      case "blueprintDockerImage": {
        const data = node.data as DockerImageNodeData;
        if (data.label && data.image) {
          blueprint.dockerImages![data.label] = data.image;
        }
        break;
      }
      case "blueprintVariable": {
        const data = node.data as VariableNodeData;
        if (data.name && data.envVariable) {
          blueprint.variables!.push({
            name: data.name,
            description: data.description,
            env_variable: data.envVariable,
            default_value: data.defaultValue || "",
            rules: data.rules,
            field_type: data.fieldType || "text",
            user_viewable: data.userViewable ?? true,
            user_editable: data.userEditable ?? true,
          });
        }
        break;
      }
      case "bluePrintInstallScript": {
        const data = node.data as InstallScriptNodeData;
        blueprint.scripts = {
          installation: {
            script: data.script || "",
            container: data.container || "ghcr.io/ptero-eggs/installers:debian",
            entrypoint: data.entrypoint || "bash",
          },
        };
        break;
      }
      case "blueprintStartupCommand": {
        const data = node.data as StartupCommandNodeData;
        blueprint.startup = data.command || "";
        break;
      }
      case "blueprintConfig": {
        const data = node.data as ConfigNodeData;
        blueprint.config = {
          files: data.files || "{}",
          startup: data.startup || "{}",
          logs: data.logs || "{}",
          stop: data.stop || "stop",
        };
        break;
      }
      case "blueprintFeature": {
        const data = node.data as FeatureNodeData;
        if (data.feature) {
          blueprint.features!.push(data.feature);
        }
        break;
      }
    }
  });

  // Ensure at least one docker image
  if (Object.keys(blueprint.dockerImages!).length === 0) {
    blueprint.dockerImages = { Default: "alpine:latest" };
  }

  return blueprint;
};

const nodesToPterodactylEgg = (nodes: Node[], edges: Edge[]): PterodactylEgg => {
  const blueprint = nodesToBlueprint(nodes, edges);

  return {
    meta: {
      version: "PTDL_v2",
      update_url: blueprint.updateUrl || null,
    },
    name: blueprint.name || "Untitled",
    author: blueprint.author,
    description: blueprint.description || null,
    features: blueprint.features,
    docker_images: blueprint.dockerImages,
    file_denylist: blueprint.fileDenylist,
    startup: blueprint.startup,
    config: blueprint.config as PterodactylEgg["config"],
    scripts: blueprint.scripts as PterodactylEgg["scripts"],
    variables: blueprint.variables,
  };
};

const blueprintToNodes = (
  blueprint: Blueprint | PterodactylEgg
): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let nodeId = 0;
  const getId = (prefix: string) => `${prefix}-${nodeId++}`;

  // Normalize - handle both Blueprint and PterodactylEgg formats
  const isPterodactyl = "docker_images" in blueprint;
  const dockerImages = isPterodactyl
    ? (blueprint as PterodactylEgg).docker_images || {}
    : (blueprint as Blueprint).dockerImages || {};
  const config = blueprint.config || {};
  const scripts = blueprint.scripts || {};

  // Create Output Node
  const outputId = getId("output");
  nodes.push({
    id: outputId,
    type: "blueprintOutput",
    position: { x: 400, y: 700 },
    data: {
      name: blueprint.name,
      description: blueprint.description,
      author: blueprint.author,
      category: isPterodactyl ? undefined : (blueprint as Blueprint).category,
      updateUrl: isPterodactyl
        ? (blueprint as PterodactylEgg).meta?.update_url || undefined
        : (blueprint as Blueprint).updateUrl,
      isPublic: isPterodactyl ? true : (blueprint as Blueprint).isPublic,
    } as OutputNodeData,
  });

  // Create Docker Image Nodes
  const dockerNodeIds: string[] = [];
  Object.entries(dockerImages).forEach(([label, image], index) => {
    const id = getId("docker");
    dockerNodeIds.push(id);
    nodes.push({
      id,
      type: "blueprintDockerImage",
      position: { x: 100 + index * 340, y: 50 },
      data: { label, image } as DockerImageNodeData,
    });
  });

  // Create Install Script Node
  const installId = getId("install");
  const installation = (scripts as any)?.installation;
  nodes.push({
    id: installId,
    type: "bluePrintInstallScript",
    position: { x: 350, y: 250 },
    data: {
      script: installation?.script || "",
      container: installation?.container || "ghcr.io/ptero-eggs/installers:debian",
      entrypoint: installation?.entrypoint || "bash",
    } as InstallScriptNodeData,
  });

  // Connect Docker Images to Install Script
  dockerNodeIds.forEach((dockerId, index) => {
    edges.push({
      id: `e-docker-${index}`,
      source: dockerId,
      target: installId,
      type: "animatedBezier",
    });
  });

  // Create Startup Command Node
  const startupId = getId("startup");
  nodes.push({
    id: startupId,
    type: "blueprintStartupCommand",
    position: { x: 200, y: 500 },
    data: {
      command: blueprint.startup || "",
    } as StartupCommandNodeData,
  });

  // Connect Install Script to Startup
  edges.push({
    id: "e-install-startup",
    source: installId,
    target: startupId,
    type: "animatedBezier",
  });

  // Create Config Node if there's config data
  const hasConfig =
    config &&
    ((config as any).files ||
      (config as any).startup ||
      (config as any).logs ||
      (config as any).stop);

  if (hasConfig) {
    const configId = getId("config");
    nodes.push({
      id: configId,
      type: "blueprintConfig",
      position: { x: 600, y: 500 },
      data: {
        files: (config as any).files || "",
        startup: (config as any).startup || "",
        logs: (config as any).logs || "",
        stop: (config as any).stop || "",
      } as ConfigNodeData,
    });

    // Connect Config to Output
    edges.push({
      id: "e-config-output",
      source: configId,
      target: outputId,
      type: "animatedBezier",
    });
  }

  // Connect Startup to Output
  edges.push({
    id: "e-startup-output",
    source: startupId,
    target: outputId,
    type: "animatedBezier",
  });

  // Create Variable Nodes
  (blueprint.variables || []).forEach((variable, index) => {
    const id = getId("var");
    nodes.push({
      id,
      type: "blueprintVariable",
      position: { x: 900, y: 50 + index * 420 },
      data: {
        name: variable.name,
        description: variable.description,
        envVariable: variable.env_variable,
        defaultValue: variable.default_value,
        rules: variable.rules,
        fieldType: variable.field_type,
        userViewable: variable.user_viewable,
        userEditable: variable.user_editable,
      } as VariableNodeData,
    });

    // Connect variable to output
    edges.push({
      id: `e-var-${index}`,
      source: id,
      target: outputId,
      type: "animatedBezier",
    });
  });

  // Create Feature Nodes
  (blueprint.features || []).forEach((feature, index) => {
    const id = getId("feature");
    nodes.push({
      id,
      type: "blueprintFeature",
      position: { x: -200, y: 50 + index * 150 },
      data: { feature } as FeatureNodeData,
    });

    // Connect feature to output
    edges.push({
      id: `e-feature-${index}`,
      source: id,
      target: outputId,
      type: "animatedBezier",
    });
  });

  return { nodes, edges };
};

// ============================================================================
// Auto Layout Button
// ============================================================================

const AutoLayoutButton = () => {
  const { layout } = useAutoLayout();
  const [isLoading, setIsLoading] = useState(false);

  const handleLayout = async () => {
    setIsLoading(true);
    await layout();
    setIsLoading(false);
  };

  return (
    <Button
      onClick={handleLayout}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <Layout className="h-4 w-4" />
      {isLoading ? "Layouting..." : "Auto Layout"}
    </Button>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const initialNodes: Node[] = [
  { id: "bpi", type: "bluePrintInstallScript", position: { x: 300, y: 200 }, data: {} },
  { id: "bsc", type: "blueprintStartupCommand", position: { x: 300, y: 500 }, data: {} },
  { id: "bpo", type: "blueprintOutput", position: { x: 300, y: 750 }, data: { isPublic: true } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "bpi", target: "bsc", type: "animatedBezier" },
  { id: "e2", source: "bsc", target: "bpo", type: "animatedBezier" },
];

// Singleton node types - only one allowed
const SINGLETON_TYPES = ["bluePrintInstallScript", "blueprintStartupCommand", "blueprintOutput"];

// Nodes that should only have one incoming connection (target)
const SINGLE_TARGET_TYPES = [
  "bluePrintInstallScript",
  "blueprintStartupCommand",
  "blueprintOutput",
  "blueprintConfig",
];

const BlueprintBuilderPage = () => {
  const nodeTypes = useMemo(
    () => ({
      blueprintOutput: BlueprintOutputNode,
      bluePrintInstallScript: BlueprintInstallScriptNode,
      blueprintDockerImage: BlueprintDockerImageNode,
      blueprintVariable: BlueprintVariableNode,
      blueprintStartupCommand: BlueprintStartupCommandNode,
      blueprintFeature: BlueprintFeatureNode,
      blueprintConfig: BlueprintConfigNode,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      animatedBezier: AnimatedBezierEdge,
    }),
    []
  );

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [nodeCounter, setNodeCounter] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onNodesChange = useCallback(
    (changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  // Custom connection handler that removes existing connections for single-target nodes
  const onConnect = useCallback(
    (connection: Connection) => {
      const targetNode = nodes.find((n) => n.id === connection.target);

      if (targetNode && SINGLE_TARGET_TYPES.includes(targetNode.type || "")) {
        // Remove any existing edges targeting this node's target handle
        setEdges((eds) => {
          const filtered = eds.filter(
            (e) => !(e.target === connection.target && e.targetHandle === connection.targetHandle)
          );
          return addEdge({ ...connection, type: "animatedBezier" }, filtered);
        });
      } else {
        setEdges((eds) => addEdge({ ...connection, type: "animatedBezier" }, eds));
      }
    },
    [nodes]
  );

  const handleCreateNode = useCallback(
    (type: string, position?: { x: number; y: number }) => {
      // Prevent creating multiple singleton nodes
      if (SINGLETON_TYPES.includes(type)) {
        const existing = nodes.find((n) => n.type === type);
        if (existing) return;
      }

      const newId = `${type}-${nodeCounter}`;
      setNodeCounter((prev) => prev + 1);

      const newNode: Node = {
        id: newId,
        type,
        position: position || { x: 400, y: 300 },
        data: type === "blueprintOutput" ? { isPublic: true } : {},
      };

      setNodes((prev) => [...prev, newNode]);
    },
    [nodeCounter, nodes]
  );

  // Export to JSON
  const handleExport = useCallback(() => {
    const egg = nodesToPterodactylEgg(nodes, edges);
    const blob = new Blob([JSON.stringify(egg, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${egg.name?.toLowerCase().replace(/\s+/g, "-") || "blueprint"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  // Import from JSON
  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const { nodes: newNodes, edges: newEdges } = blueprintToNodes(json);
        setNodes(newNodes);
        setEdges(newEdges);
        setNodeCounter(newNodes.length + 1);
      } catch (err) {
        console.error("Failed to import blueprint:", err);
        alert("Failed to import blueprint. Please check the file format.");
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="h-full w-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            colorMode="dark"
            connectionLineType={ConnectionLineType.Bezier}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            fitViewOptions={{ padding: 0.2 }}
          >
            <Background />
            <MiniMap
              nodeColor={(node) => {
                switch (node.type) {
                  case "blueprintOutput":
                    return "#f97316";
                  case "blueprintDockerImage":
                    return "#0ea5e9";
                  case "blueprintVariable":
                    return "#10b981";
                  case "bluePrintInstallScript":
                    return "#8b5cf6";
                  case "blueprintStartupCommand":
                    return "#f59e0b";
                  case "blueprintConfig":
                    return "#ec4899";
                  case "blueprintFeature":
                    return "#06b6d4";
                  default:
                    return "#6b7280";
                }
              }}
            />
            <Panel position="top-right" className="flex gap-2">
              <AutoLayoutButton />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Import
              </Button>
              <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button
                onClick={() => console.log(nodesToPterodactylEgg(nodes, edges))}
                variant="ghost"
                size="sm"
                className="gap-2"
                title="Log Blueprint JSON"
              >
                <FileCode className="h-4 w-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </Panel>
            <Controls />
          </ReactFlow>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => handleCreateNode("blueprintDockerImage")}>
          Docker Image
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleCreateNode("blueprintVariable")}>
          Variable
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleCreateNode("blueprintFeature")}>
          Feature
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => handleCreateNode("blueprintConfig")}
          disabled={nodes.some((n) => n.type === "blueprintConfig")}
        >
          Config
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => handleCreateNode("blueprintStartupCommand")}
          disabled={nodes.some((n) => n.type === "blueprintStartupCommand")}
        >
          Startup Command
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => handleCreateNode("bluePrintInstallScript")}
          disabled={nodes.some((n) => n.type === "bluePrintInstallScript")}
        >
          Install Script
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default BlueprintBuilderPage;
