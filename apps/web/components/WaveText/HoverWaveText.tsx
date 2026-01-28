"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@workspace/ui/lib/utils";

interface HoverWaveTextProps {
  text: string;
  className?: string;
  highlightClassName?: string;
  baseClassName?: string;
  isHovered?: boolean;
  baseOpacity?: number;
}

export const HoverWaveText = ({
  text,
  className,
  highlightClassName = "text-zinc-100",
  baseClassName = "text-zinc-600",
  isHovered = false,
  baseOpacity = 0.5,
}: HoverWaveTextProps) => {
  const [waveIndex, setWaveIndex] = useState(-1);
  const [isAnimating, setIsAnimating] = useState(false);
  const WAVE_WIDTH = 4;

  // Start wave animation when hovered
  const startWave = useCallback(() => {
    if (!isAnimating) {
      setIsAnimating(true);
      setWaveIndex(0);
    }
  }, [isAnimating]);

  // Trigger wave on hover
  useEffect(() => {
    if (isHovered) {
      startWave();
    }
  }, [isHovered, startWave]);

  // Animate the wave across characters
  useEffect(() => {
    if (waveIndex >= 0 && waveIndex < text.length + WAVE_WIDTH) {
      const timer = setTimeout(() => {
        setWaveIndex(waveIndex + 1);
      }, 40); // Slightly faster for hover interaction

      return () => clearTimeout(timer);
    } else if (waveIndex >= text.length + WAVE_WIDTH) {
      const resetTimer = setTimeout(() => {
        setWaveIndex(-1);
        setIsAnimating(false);
      }, 100);

      return () => clearTimeout(resetTimer);
    }
  }, [waveIndex, text.length]);

  const characters = useMemo(() => text.split(""), [text]);

  // Calculate the current opacity based on hover state and animation
  const getCurrentOpacity = () => {
    if (isHovered) return 1;
    return baseOpacity;
  };

  return (
    <span
      className={cn("inline-flex transition-opacity duration-150", className)}
      style={{ opacity: getCurrentOpacity() }}
    >
      {characters.map((char, index) => {
        const distanceFromWave = waveIndex - index;
        const isHighlighted = distanceFromWave >= 0 && distanceFromWave < WAVE_WIDTH;
        const colorOpacity = isHighlighted ? 1 - distanceFromWave / WAVE_WIDTH : 0;

        return (
          <motion.span
            key={index}
            className={cn("transition-colors duration-100", baseClassName)}
            style={{
              color: isHighlighted ? `rgba(244, 244, 245, ${colorOpacity})` : undefined,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        );
      })}
    </span>
  );
};
