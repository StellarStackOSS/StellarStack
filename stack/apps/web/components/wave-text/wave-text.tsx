"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@workspace/ui/lib/utils";

interface WaveTextProps {
  text: string;
  className?: string;
  highlightClassName?: string;
  baseClassName?: string;
}

export const WaveText = ({
  text,
  className,
  highlightClassName = "text-zinc-100",
  baseClassName = "text-zinc-600",
}: WaveTextProps) => {
  const [waveIndex, setWaveIndex] = useState(-1);
  const [isAnimating, setIsAnimating] = useState(false);

  // Start wave animation at random intervals (3-8 seconds)
  useEffect(() => {
    const startWave = () => {
      if (!isAnimating) {
        setIsAnimating(true);
        setWaveIndex(0);
      }
    };

    // Initial delay before first wave
    const initialDelay = setTimeout(() => {
      startWave();
    }, 2000);

    // Random interval for subsequent waves
    const interval = setInterval(() => {
      const randomDelay = Math.random() * 5000 + 3000; // 3-8 seconds
      setTimeout(startWave, randomDelay);
    }, 8000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [isAnimating]);

  // Animate through each character
  useEffect(() => {
    if (waveIndex >= 0 && waveIndex < text.length) {
      const timer = setTimeout(() => {
        setWaveIndex(waveIndex + 1);
      }, 60); // Speed of wave propagation

      return () => clearTimeout(timer);
    } else if (waveIndex >= text.length) {
      // Wave complete
      const resetTimer = setTimeout(() => {
        setWaveIndex(-1);
        setIsAnimating(false);
      }, 1000);

      return () => clearTimeout(resetTimer);
    }
  }, [waveIndex, text.length]);

  const characters = useMemo(() => text.split(""), [text]);

  return (
    <span className={cn("inline-flex", className)}>
      {characters.map((char, index) => {
        // Calculate if this character should be highlighted
        // The wave has a width of 3 characters
        const distanceFromWave = waveIndex - index;
        const isHighlighted = distanceFromWave >= 0 && distanceFromWave < 4;

        // Calculate opacity based on distance from wave center
        const opacity = isHighlighted
          ? 1 - (distanceFromWave / 4)
          : 0;

        return (
          <motion.span
            key={index}
            className={cn(
              "transition-colors duration-150",
              baseClassName
            )}
            style={{
              color: isHighlighted
                ? `rgba(244, 244, 245, ${opacity})`
                : undefined,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        );
      })}
    </span>
  );
};
