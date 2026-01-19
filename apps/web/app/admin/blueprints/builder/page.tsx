'use client';
import '@xyflow/react/dist/style.css';
import {
    addEdge,
    applyEdgeChanges,
    applyNodeChanges,
    Background,
    ConnectionLineType,
    Controls,
    EdgeProps,
    getBezierPath,
    Handle,
    MiniMap,
    Panel,
    Position,
    ReactFlow,
    useNodeId,
    useReactFlow
} from '@xyflow/react';
import React, {useCallback, useRef, useState} from "react";
import {
    Button,
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
    Input,
    Switch
} from "@workspace/ui/components";
import {Label} from "@workspace/ui/components/label";
import {Textarea} from "@workspace/ui/components/textarea";
import {LayoutIcon, X} from 'lucide-react';
import {motion} from 'framer-motion';

// Animated Bezier edge component with single pulse effect
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
      {/* Base static line */}
      <path
        d={edgePath}
        stroke="#6b7280"
        strokeWidth={1.75}
        fill="none"
        markerEnd={markerEnd}
      />
      {/* Animated single pulse with Framer Motion */}
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
          ease: 'easeInOut',
          repeat: Infinity,
          repeatDelay: 0.8,
        }}
        style={{
          opacity: 0.9,
        }}
      />
    </g>
  );
};

// Semantic blueprint layout - understands node types
const useAutoLayout = () => {
    const { getNodes, setNodes, getEdges, fitView } = useReactFlow();
    const isDirtyRef = useRef(false);

    const layout = useCallback(async () => {
        if (isDirtyRef.current) return;
        isDirtyRef.current = true;

        const nodes = getNodes();

        // First pass: measure nodes with hidden visibility
        const hiddenNodes = nodes.map(node => ({
            ...node,
            hidden: true
        }));
        setNodes(hiddenNodes);

        // Wait for DOM update
        await new Promise(resolve => setTimeout(resolve, 50));

        // Measure node dimensions and categorize by type
        const nodeData: any = {};
        const dockerImages: any[] = [];
        const variables: any[] = [];
        let installScript: any = null;
        let outputNode: any = null;

        nodes.forEach(node => {
            const element = document.querySelector(`[data-id="${node.id}"]`);
            const width = element?.clientWidth || 200;
            const height = element?.clientHeight || 100;
            nodeData[node.id] = { width, height };

            if (node.type === 'blueprintDockerImage') {
                dockerImages.push(node);
            } else if (node.type === 'blueprintVariable') {
                variables.push(node);
            } else if (node.type === 'bluePrintInstallScript') {
                installScript = node;
            } else if (node.type === 'blueprintOutput') {
                outputNode = node;
            }
        });

        try {
            const layoutedNodes: any[] = [];

            // Position Docker Images at top, horizontally spread
            dockerImages.forEach((node, index) => {
                const x = 100 + index * 300;
                const y = 100;
                layoutedNodes.push({
                    ...node,
                    position: {
                        x: x - nodeData[node.id].width / 2,
                        y: y - nodeData[node.id].height / 2
                    },
                    hidden: false
                });
            });

            // Position Install Script in center, below docker images
            if (installScript) {
                const totalWidth = dockerImages.length * 300;
                const x = 100 + totalWidth / 2 - 150;
                const y = 400;
                layoutedNodes.push({
                    ...installScript,
                    position: {
                        x: x - nodeData[installScript.id].width / 2,
                        y: y - nodeData[installScript.id].height / 2
                    },
                    hidden: false
                });
            }

            // Position Variables on the right side, vertically spread
            variables.forEach((node, index) => {
                const x = 100 + (dockerImages.length + 3) * 300;
                const y = 100 + index * 650;
                layoutedNodes.push({
                    ...node,
                    position: {
                        x: x - nodeData[node.id].width / 2,
                        y: y - nodeData[node.id].height / 2
                    },
                    hidden: false
                });
            });

            // Position Output at bottom center
            if (outputNode) {
                const totalWidth = dockerImages.length * 300;
                const x = 100 + totalWidth / 2 - 150;
                const y = 650;
                layoutedNodes.push({
                    ...outputNode,
                    position: {
                        x: x - nodeData[outputNode.id].width / 2,
                        y: y - nodeData[outputNode.id].height / 2
                    },
                    hidden: false
                });
            }

            setNodes(layoutedNodes);

            // Fit view
            setTimeout(() => {
                fitView({ padding: 0.2, maxZoom: 1 });
            }, 0);
        } catch (error) {
            console.error('Layout failed:', error);
            // Fallback: just unhide nodes
            setNodes(nodes.map(n => ({ ...n, hidden: false })));
        }

        isDirtyRef.current = false;
    }, [getNodes, setNodes, getEdges, fitView]);

    return { layout };
};


const initialNodes = [
    { id: 'bpi', type: 'bluePrintInstallScript', position: { x: 300, y: 200 }, data: {} },
    { id: 'bpo', type: 'blueprintOutput', position: { x: 300, y: 500 }, data: {} },
];
const initialEdges = [
    { id: 'e5', source: 'bpi', target: 'bpo', type: 'animatedBezier' },
];


const BlueprintOutputNode = () => {
    const nodeId = useNodeId();

    return (
        <div data-id={nodeId} className="relative flex flex-col rounded-lg border p-4 transition-colors border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20 w-80">
            <Handle type="target" position={Position.Top} className="bg-blue-500" id="bpo_target_top" />
            <Label className="text-sm font-semibold">Blueprint Output</Label>
            <div className="mt-3">
                <Label className="text-xs">Name</Label>
                <Input
                    placeholder="Blueprint name"
                    className="mt-1 text-xs h-8"/>
            </div>
            <div className="mt-3">
                <Label className="text-xs">Description</Label>
                <Textarea
                    placeholder="Brief description of the blueprint"
                    className="mt-1 text-xs h-16"/>
            </div>
            <div className="mt-3">
                <Label className="text-xs">Author</Label>
                <Input
                    placeholder="Author name"
                    className="mt-1 text-xs h-8"/>
            </div>
            <div className="mt-3">
                <Label className="text-xs">Category</Label>
                <Input
                    placeholder="e.g., Game Servers, Utilities"
                    className="mt-1 text-xs h-8"/>
            </div>
        </div>
    );
}

const BlueprintVariableNode = () => {
    const nodeId = useNodeId();
    const { getNodes, setNodes, getEdges, setEdges } = useReactFlow();

    const handleDelete = () => {
        setNodes(getNodes().filter(n => n.id !== nodeId));
        setEdges(getEdges().filter(e => e.source !== nodeId && e.target !== nodeId));
    };

    return (
        <div data-id={nodeId}
            className="relative flex gap-3 h-fit flex-col rounded-lg border p-4 transition-colors border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20 w-80">
            <button
                onClick={handleDelete}
                className="absolute top-2 right-2 p-1 hover:bg-red-500/20 rounded transition-colors"
                title="Delete node"
            >
                <X size={16} className="text-red-500" />
            </button>
            <Handle type="source" position={Position.Bottom} className="bg-blue-500" id="bv_source_bottom"/>
            <Label className="text-sm font-semibold">Variable</Label>
            <div>
                <Label className="text-xs">Name</Label>
                <Input placeholder="e.g., [STEAM] AppID" className="mt-1 text-xs h-8"/>
            </div>
            <div>
                <Label className="text-xs">Description</Label>
                <Input placeholder="Description for users" className="mt-1 text-xs h-8"/>
            </div>
            <div>
                <Label className="text-xs">Environment Variable</Label>
                <Input placeholder="e.g., SRCDS_APPID" className="mt-1 text-xs h-8"/>
            </div>
            <div>
                <Label className="text-xs">Default Value</Label>
                <Input placeholder="Default value" className="mt-1 text-xs h-8"/>
            </div>
            <div>
                <Label className="text-xs">Rules</Label>
                <Input placeholder="e.g., required|string|in:739590" className="mt-1 text-xs h-8"/>
            </div>
            <div>
                <Label className="text-xs">Field Type</Label>
                <Input placeholder="e.g., text, number, boolean" className="mt-1 text-xs h-8"/>
            </div>
            <div className="flex gap-4">
                <div className="flex items-center gap-2">
                    <Switch id={`${nodeId}-viewable`}/>
                    <Label htmlFor={`${nodeId}-viewable`} className="text-xs">Viewable</Label>
                </div>
                <div className="flex items-center gap-2">
                    <Switch id={`${nodeId}-editable`}/>
                    <Label htmlFor={`${nodeId}-editable`} className="text-xs">Editable</Label>
                </div>
            </div>
        </div>
    );
}

const BlueprintDockerImageNode = () => {
    const nodeId = useNodeId();
    const { getNodes, setNodes, getEdges, setEdges } = useReactFlow();

    const handleDelete = () => {
        setNodes(getNodes().filter(n => n.id !== nodeId));
        setEdges(getEdges().filter(e => e.source !== nodeId && e.target !== nodeId));
    };

    return (
        <div data-id={nodeId}
            className="relative flex w-80 h-fit flex-col rounded-lg border p-4 transition-colors border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20">
            <button
                onClick={handleDelete}
                className="absolute top-2 right-2 p-1 hover:bg-red-500/20 rounded transition-colors"
                title="Delete node"
            >
                <X size={16} className="text-red-500" />
            </button>
            <Handle type="source" position={Position.Bottom} className="bg-blue-500" id="bdi_source_bottom" />
            <Label className="text-sm font-semibold">Docker Image</Label>
            <div className="mt-3">
                <Label className="text-xs">Name/Label</Label>
                <Input
                    placeholder="e.g., debian"
                    className="mt-1 text-xs h-8"/>
            </div>
            <div className="mt-3">
                <Label className="text-xs">Image URL</Label>
                <Input
                    placeholder="e.g., ghcr.io/ptero-eggs/steamcmd:dotnet"
                    className="mt-1 text-xs h-8"/>
            </div>
        </div>
    );
}

const BlueprintInstallScriptNode = () => {
    const nodeId = useNodeId();
    return (
        <div data-id={nodeId} className="relative flex w-96 h-fit flex-col rounded-lg border p-4 transition-colors border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20">
            <Handle type="target" position={Position.Top} className="bg-blue-500" id="bpi_target_top" />
            <Handle type="source" position={Position.Bottom} className="bg-blue-500" id="bpi_source_bottom" />
            <Label className="text-sm font-semibold">Installation Script</Label>
            <div className="mt-3">
                <Label className="text-xs">Script</Label>
                <Textarea
                    placeholder="Enter installation script"
                    className="mt-1 text-xs h-24"/>
            </div>
        </div>
    );
}

const BlueprintStartupCommandNode = () => {
    const nodeId = useNodeId();
    const { getNodes, setNodes, getEdges, setEdges } = useReactFlow();

    const handleDelete = () => {
        setNodes(getNodes().filter(n => n.id !== nodeId));
        setEdges(getEdges().filter(e => e.source !== nodeId && e.target !== nodeId));
    };

    return (
        <div data-id={nodeId} className="relative flex w-96 h-fit flex-col rounded-lg border p-4 transition-colors border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20">
            <button
                onClick={handleDelete}
                className="absolute top-2 right-2 p-1 hover:bg-red-500/20 rounded transition-colors"
                title="Delete node"
            >
                <X size={16} className="text-red-500" />
            </button>
            <Handle type="target" position={Position.Top} className="bg-blue-500" id="bsc_target_top" />
            <Handle type="source" position={Position.Bottom} className="bg-blue-500" id="bsc_source_bottom" />
            <Label className="text-sm font-semibold">Startup Command</Label>
            <div className="mt-3">
                <Label className="text-xs">Startup Command</Label>
                <Textarea
                    placeholder="e.g., ./EcoServer --username={{SLG_USER}} --password={{SLG_PW}}"
                    className="mt-1 text-xs h-20"/>
            </div>
        </div>
    );
}

const BlueprintFeatureNode = () => {
    const nodeId = useNodeId();
    const { getNodes, setNodes, getEdges, setEdges } = useReactFlow();

    const handleDelete = () => {
        setNodes(getNodes().filter(n => n.id !== nodeId));
        setEdges(getEdges().filter(e => e.source !== nodeId && e.target !== nodeId));
    };

    return (
        <div data-id={nodeId} className="relative flex w-80 h-fit flex-col rounded-lg border p-4 transition-colors border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20">
            <button
                onClick={handleDelete}
                className="absolute top-2 right-2 p-1 hover:bg-red-500/20 rounded transition-colors"
                title="Delete node"
            >
                <X size={16} className="text-red-500" />
            </button>
            <Handle type="source" position={Position.Bottom} className="bg-blue-500" id="bf_source_bottom" />
            <Label className="text-sm font-semibold">Feature</Label>
            <div className="mt-3">
                <Label className="text-xs">Feature Tag</Label>
                <Input
                    placeholder="e.g., steam_disk_space, eula, modpack_installer"
                    className="mt-1 text-xs h-8"/>
            </div>
        </div>
    );
}



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
            <LayoutIcon className="h-4 w-4" />
            {isLoading ? 'Layouting...' : 'Auto Layout'}
        </Button>
    );
};

const BlueprintBuilderPage = () => {

    const nodeTypes = {
        blueprintOutput: BlueprintOutputNode,
        bluePrintInstallScript: BlueprintInstallScriptNode,
        blueprintDockerImage: BlueprintDockerImageNode,
        blueprintVariable: BlueprintVariableNode,
        blueprintStartupCommand: BlueprintStartupCommandNode,
        blueprintFeature: BlueprintFeatureNode,
    };

    const edgeTypes = {
        animatedBezier: AnimatedBezierEdge,
    };

    const [nodes, setNodes] = useState(initialNodes);
    const [edges, setEdges] = useState(initialEdges);
    const [nodeCounter, setNodeCounter] = useState(0);
    const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

    const onNodesChange = useCallback(
        (changes: any) => setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
        [],
    );
    const onEdgesChange = useCallback(
        (changes: any) => setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
        [],
    );
    const onConnect = useCallback(
        (params: any) => setEdges((edgesSnapshot) => addEdge({ ...params, type: 'animatedBezier' }, edgesSnapshot)),
        [],
    );

    const handleCreateNode = useCallback((type: string) => {
        // Prevent creating multiple install script nodes
        if (type === 'bluePrintInstallScript') {
            const existingInstallScript = nodes.find(n => n.type === 'bluePrintInstallScript');
            if (existingInstallScript) return;
        }

        const newId = `${type}-${nodeCounter}`;
        setNodeCounter(prev => prev + 1);
        const position = contextMenuPos || { x: 300, y: 300 };
        const newNode = {
            id: newId,
            type,
            position,
            data: { label: type }
        };
        setNodes(prev => [...prev, newNode]);
        setContextMenuPos(null);
    }, [nodeCounter, contextMenuPos, nodes]);

    const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenuPos({ x: e.clientX, y: e.clientY });
    }, []);

    const handleCanvasClick = useCallback(() => {
        setContextMenuPos(null);
    }, []);

  return (
      <ContextMenu>
          <ContextMenuTrigger asChild>
              <div
                  className="w-full h-full"
                  onClick={handleCanvasClick}
              >
                  <ReactFlow
                      nodes={nodes}
                      edges={edges}
                      nodeTypes={nodeTypes}
                      edgeTypes={edgeTypes}
                      colorMode={"dark"}
                      connectionLineType={ConnectionLineType.Bezier}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      onConnect={onConnect}
                      fitView
                  >
                      <Background/>
                      <MiniMap/>
                      <Panel position="top-right">
                          <AutoLayoutButton />
                      </Panel>
                      <Controls />
                  </ReactFlow>
              </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
              <ContextMenuItem onClick={() => handleCreateNode('blueprintDockerImage')}>
                  Docker Image
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleCreateNode('blueprintVariable')}>
                  Variable
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleCreateNode('blueprintStartupCommand')}>
                  Startup Command
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleCreateNode('bluePrintInstallScript')}>
                  Install Script
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleCreateNode('blueprintFeature')}>
                  Feature
              </ContextMenuItem>
          </ContextMenuContent>
      </ContextMenu>
  )
}
export default BlueprintBuilderPage;