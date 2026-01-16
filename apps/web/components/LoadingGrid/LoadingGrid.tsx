"use client";

import {motion} from "framer-motion";
import {useMemo} from "react";

type LoaderPattern =
// Static patterns (simple pulse)
    | "solo-center" | "solo-tl" | "solo-br"
    | "line-h-top" | "line-h-mid" | "line-h-bot"
    | "line-v-left" | "line-v-mid" | "line-v-right"
    | "line-diag-1" | "line-diag-2"
    | "corners-only" | "corners-sync"
    | "plus-hollow" | "cross"
    | "L-tl" | "L-tr" | "L-bl" | "L-br"
    | "T-top" | "T-bot" | "T-left" | "T-right"
    | "duo-h" | "duo-v" | "duo-diag"
    | "frame" | "frame-sync"
    | "sparse-1" | "sparse-2" | "sparse-3"
    // Animated patterns (sequential/trail)
    | "wave-lr" | "wave-rl" | "wave-tb" | "wave-bt"
    | "diagonal-tl" | "diagonal-tr" | "diagonal-bl" | "diagonal-br"
    | "ripple-out" | "ripple-in"
    | "spiral-cw" | "spiral-ccw"
    | "snake" | "snake-rev"
    | "rain" | "rain-rev"
    | "edge-cw" | "edge-ccw"
    | "breathe" | "twinkle";

type ColorScheme = "cyan" | "peach" | "pink" | "purple" | "green";
type SizeOption = "sm" | "md" | "lg" | "xl";

interface GridLoaderProps {
    pattern?: LoaderPattern;
    color?: ColorScheme;
    size?: SizeOption;
    speed?: number;
    className?: string;
}

// Cell positions: 0-8 in row-major order
// 0 1 2
// 3 4 5
// 6 7 8

interface AnimationConfig {
    cells: number[];
    sequence?: number[][]; // For trail animations: array of steps, each step is array of active cells
    delays?: number[]; // For staggered pulse animations
}

const animations: Record<LoaderPattern, AnimationConfig> = {
    // Static patterns - all cells pulse together or with slight stagger
    "solo-center": { cells: [4] },
    "solo-tl": { cells: [0] },
    "solo-br": { cells: [8] },
    "line-h-top": { cells: [0, 1, 2] },
    "line-h-mid": { cells: [3, 4, 5] },
    "line-h-bot": { cells: [6, 7, 8] },
    "line-v-left": { cells: [0, 3, 6] },
    "line-v-mid": { cells: [1, 4, 7] },
    "line-v-right": { cells: [2, 5, 8] },
    "line-diag-1": { cells: [0, 4, 8] },
    "line-diag-2": { cells: [2, 4, 6] },
    "corners-only": { cells: [0, 2, 6, 8], delays: [0, 0.25, 0.5, 0.75] },
    "corners-sync": { cells: [0, 2, 6, 8] },
    "plus-hollow": { cells: [1, 3, 5, 7] },
    "cross": { cells: [1, 3, 4, 5, 7] },
    "L-tl": { cells: [0, 3, 6, 7] },
    "L-tr": { cells: [2, 5, 7, 8] },
    "L-bl": { cells: [0, 1, 3, 6] },
    "L-br": { cells: [1, 2, 5, 8] },
    "T-top": { cells: [0, 1, 2, 4] },
    "T-bot": { cells: [4, 6, 7, 8] },
    "T-left": { cells: [0, 3, 4, 6] },
    "T-right": { cells: [2, 4, 5, 8] },
    "duo-h": { cells: [3, 5] },
    "duo-v": { cells: [1, 7] },
    "duo-diag": { cells: [0, 8] },
    "frame": {
        cells: [0, 1, 2, 5, 8, 7, 6, 3],
        sequence: [[0], [1], [2], [5], [8], [7], [6], [3]]
    },
    "frame-sync": { cells: [0, 1, 2, 3, 5, 6, 7, 8] },
    "sparse-1": { cells: [0, 2, 4, 6, 8] },
    "sparse-2": { cells: [1, 3, 5, 7] },
    "sparse-3": { cells: [0, 5, 7] },

    // Sequential/trail animations
    "wave-lr": {
        cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        sequence: [[0, 3, 6], [1, 4, 7], [2, 5, 8]],
    },
    "wave-rl": {
        cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        sequence: [[2, 5, 8], [1, 4, 7], [0, 3, 6]],
    },
    "wave-tb": {
        cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        sequence: [[0, 1, 2], [3, 4, 5], [6, 7, 8]],
    },
    "wave-bt": {
        cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        sequence: [[6, 7, 8], [3, 4, 5], [0, 1, 2]],
    },
    "diagonal-tl": {
        cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        sequence: [[0], [1, 3], [2, 4, 6], [5, 7], [8]],
    },
    "diagonal-tr": {
        cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        sequence: [[2], [1, 5], [0, 4, 8], [3, 7], [6]],
    },
    "diagonal-bl": {
        cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        sequence: [[6], [3, 7], [0, 4, 8], [1, 5], [2]],
    },
    "diagonal-br": {
        cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        sequence: [[8], [5, 7], [2, 4, 6], [1, 3], [0]],
    },
    "ripple-out": {
        cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        sequence: [[4], [1, 3, 5, 7], [0, 2, 6, 8]],
    },
    "ripple-in": {
        cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        sequence: [[0, 2, 6, 8], [1, 3, 5, 7], [4]],
    },
    "spiral-cw": {
        cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        sequence: [[0], [1], [2], [5], [8], [7], [6], [3], [4]],
    },
    "spiral-ccw": {
        cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        sequence: [[0], [3], [6], [7], [8], [5], [2], [1], [4]],
    },
    "snake": {
        cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        sequence: [[0], [1], [2], [5], [4], [3], [6], [7], [8]],
    },
    "snake-rev": {
        cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        sequence: [[8], [7], [6], [3], [4], [5], [2], [1], [0]],
    },
    "rain": {
        cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        sequence: [[0], [3, 1], [6, 4, 2], [7, 5], [8]],
    },
    "rain-rev": {
        cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        sequence: [[6], [3, 7], [0, 4, 8], [1, 5], [2]],
    },
    "edge-cw": {
        cells: [0, 1, 2, 5, 8, 7, 6, 3],
        sequence: [[0], [1], [2], [5], [8], [7], [6], [3]],
    },
    "edge-ccw": {
        cells: [0, 3, 6, 7, 8, 5, 2, 1],
        sequence: [[0], [3], [6], [7], [8], [5], [2], [1]],
    },
    "breathe": {
        cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        sequence: [[4], [1, 3, 4, 5, 7], [0, 1, 2, 3, 4, 5, 6, 7, 8]],
    },
    "twinkle": {
        cells: [0, 2, 4, 6, 8],
        delays: [0, 0.2, 0.4, 0.6, 0.8],
    },
};

// Pastel color schemes matching the reference
const colorSchemes: Record<ColorScheme, { color: string; glow: string }> = {
    cyan: {
        color: "rgb(120, 220, 232)",
        glow: "rgba(120, 220, 232, 0.8)",
    },
    peach: {
        color: "rgb(255, 200, 150)",
        glow: "rgba(255, 200, 150, 0.8)",
    },
    pink: {
        color: "rgb(255, 140, 160)",
        glow: "rgba(255, 140, 160, 0.8)",
    },
    purple: {
        color: "rgb(200, 160, 255)",
        glow: "rgba(200, 160, 255, 0.8)",
    },
    green: {
        color: "rgb(140, 230, 180)",
        glow: "rgba(140, 230, 180, 0.8)",
    },
};

const sizeConfig = {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,
};

export function GridLoader({
                               pattern = "solo-center",
                               color = "cyan",
                               size = "md",
                               speed = 1,
                               className = "",
                           }: GridLoaderProps) {
    const config = animations[pattern];
    const colors = colorSchemes[color];
    const cellSize = sizeConfig[size];
    const gridSize = cellSize * 3;

    // For sequence-based animations, calculate which step each cell belongs to
    const cellStepMap = useMemo(() => {
        const map = new Map<number, number>();
        if (config.sequence) {
            config.sequence.forEach((stepCells, stepIndex) => {
                stepCells.forEach((cellIndex) => {
                    map.set(cellIndex, stepIndex);
                });
            });
        }
        return map;
    }, [config.sequence]);

    const totalSteps = config.sequence?.length || 1;
    const stepDuration = speed / totalSteps;
    const trailDuration = stepDuration * 2; // How long the trail/fade lasts

    const activeCells = new Set(config.cells);

    return (
        <div
            className={className}
            style={{
                display: "inline-grid",
                gridTemplateColumns: `repeat(3, ${cellSize}px)`,
                width: gridSize,
                height: gridSize,
            }}
        >
            {Array.from({ length: 9 }, (_, index) => {
                const isActive = activeCells.has(index);

                if (!isActive) {
                    return (
                        <div
                            key={index}
                            style={{
                                width: cellSize,
                                height: cellSize,
                                backgroundColor: "transparent",
                            }}
                        />
                    );
                }

                // Calculate delay based on sequence or delays array
                let delay = 0;
                if (config.sequence) {
                    const step = cellStepMap.get(index) || 0;
                    delay = step * stepDuration;
                } else if (config.delays) {
                    const cellIndexInArray = config.cells.indexOf(index);
                    delay = (config.delays[cellIndexInArray] || 0) * speed;
                }

                return (
                    <motion.div
                        key={index}
                        style={{
                            width: cellSize,
                            height: cellSize,
                            backgroundColor: colors.color,
                        }}
                        animate={{
                            opacity: [0, 1, 1, 0],
                            boxShadow: [
                                `0 0 0px 0px transparent`,
                                `0 0 ${cellSize}px ${cellSize / 2}px ${colors.glow}`,
                                `0 0 ${cellSize}px ${cellSize / 2}px ${colors.glow}`,
                                `0 0 0px 0px transparent`,
                            ],
                        }}
                        transition={{
                            duration: config.sequence ? speed + trailDuration : speed,
                            repeat: Infinity,
                            repeatType: "loop",
                            delay,
                            ease: "easeInOut",
                            times: config.sequence ? [0, 0.1, 0.3, 1] : [0, 0.3, 0.7, 1],
                        }}
                    />
                );
            })}
        </div>
    );
}

export const loaderPatterns = Object.keys(animations) as LoaderPattern[];

export type { LoaderPattern, ColorScheme, SizeOption, GridLoaderProps };
export default GridLoader;