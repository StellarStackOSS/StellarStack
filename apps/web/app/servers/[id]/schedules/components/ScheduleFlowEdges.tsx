"use client";

import { EdgeProps, getBezierPath, useReactFlow } from "@xyflow/react";
import { motion } from "framer-motion";
import { SVGProps } from "react";

// Time Delay Edge - Blue with animated pulse and time badge
export const TimeDelayEdge = (props: EdgeProps) => {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd } =
    props;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Extract time offset and edge index from edge data
  const timeOffset = (props.data as any)?.timeOffset || 0;
  const edgeIndex = (props.data as any)?.edgeIndex || 0;

  // Delay for edge: 1.5 + 3*edgeIndex (pulses after start and between tasks)
  const pulseDelay = 1.5 + 3 * edgeIndex;

  return (
    <g>
      {/* Base edge path */}
      <path
        d={edgePath}
        stroke="#3b82f6"
        strokeWidth={2}
        fill="none"
        markerEnd={markerEnd}
        opacity={0.3}
      />

      {/* Pulsing animated line */}
      <motion.path
        d={edgePath}
        stroke="#60a5fa"
        strokeWidth={2}
        fill="none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{
          duration: 1.5,
          ease: "easeInOut",
          repeat: Infinity,
          delay: pulseDelay,
          repeatDelay: 10.5,
        }}
        markerEnd={markerEnd}
      />

      {/* Animated pulsing dot at midpoint */}
      <motion.circle
        cx={labelX}
        cy={labelY}
        r={3}
        fill="#93c5fd"
        initial={{ r: 3, opacity: 1 }}
        animate={{
          r: [3, 5, 3],
          opacity: [1, 0.5, 1],
        }}
        transition={{
          duration: 4,
          ease: "easeInOut",
          repeat: Infinity,
          repeatDelay: 0,
        }}
      />

      {/* Time offset badge */}
      {timeOffset > 0 && (
        <foreignObject
          x={labelX - 30}
          y={labelY - 20}
          width={60}
          height={24}
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div className="flex items-center justify-center w-full h-full bg-blue-900/80 text-blue-200 text-xs font-semibold rounded border border-blue-600/50 backdrop-blur-sm">
            {formatTime(timeOffset)}
          </div>
        </foreignObject>
      )}
    </g>
  );
};

// On Completion Edge - Purple with pulsing animation and badge
export const OnCompletionEdge = (props: EdgeProps) => {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd } =
    props;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Extract edge index from edge data to stagger animation
  const edgeIndex = (props.data as any)?.edgeIndex || 0;
  const pulseDelay = 1.5 + 3 * edgeIndex;

  return (
    <g>
      {/* Base dashed edge */}
      <path
        d={edgePath}
        stroke="#8b5cf6"
        strokeWidth={2}
        fill="none"
        strokeDasharray="6, 6"
        markerEnd={markerEnd}
        opacity={0.3}
      />

      {/* Pulsing animated line */}
      <motion.path
        d={edgePath}
        stroke="#a78bfa"
        strokeWidth={2}
        fill="none"
        strokeDasharray="6, 6"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{
          duration: 1.5,
          ease: "easeInOut",
          repeat: Infinity,
          repeatDelay: 10.5,
          delay: pulseDelay,
        }}
        markerEnd={markerEnd}
      />

      {/* "Wait for completion" badge at midpoint */}
      <foreignObject
        x={labelX - 60}
        y={labelY - 20}
        width={120}
        height={24}
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <div className="flex items-center justify-center w-full h-full bg-purple-900/80 text-purple-200 text-xs font-semibold rounded border border-purple-600/50 backdrop-blur-sm">
          Wait for completion
        </div>
      </foreignObject>
    </g>
  );
};

// Helper function to format time offset
function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}
