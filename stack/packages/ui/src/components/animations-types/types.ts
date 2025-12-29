import type { ReactNode } from "react";

// Common props shared across animation components
export interface BaseAnimationProps {
  className?: string;
  isDark?: boolean;
}

// FadeIn types
export type FadeDirection = "up" | "down" | "left" | "right" | "none";

export interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  direction?: FadeDirection;
}

export interface StaggerContainerProps {
  children: ReactNode[];
  staggerDelay?: number;
  initialDelay?: number;
  className?: string;
  direction?: FadeDirection;
}

// AnimatedNumber types
export interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  formatFn?: (value: number) => string;
  willChange?: boolean;
}

export interface CounterDigitProps {
  digit: string;
  className?: string;
}

export interface MechanicalCounterProps {
  value: number;
  className?: string;
  digitClassName?: string;
}

// PulsingDot types
export type PulsingDotStatus = "online" | "offline" | "warning" | "error";
export type PulsingDotSize = "sm" | "md" | "lg";

export interface PulsingDotProps {
  status?: PulsingDotStatus;
  size?: PulsingDotSize;
  className?: string;
  pulse?: boolean;
}

// ProgressRing types
export interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  trackColor?: string;
  progressColor?: string;
  showPercentage?: boolean;
  animated?: boolean;
  children?: ReactNode;
}

// GlowCard types
export interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  glowSize?: number;
  glowOpacity?: number;
  isDark?: boolean;
}

export interface GradientBorderCardProps {
  children: ReactNode;
  className?: string;
  borderWidth?: number;
  isDark?: boolean;
  animated?: boolean;
}

// NoiseOverlay types
export interface NoiseOverlayProps {
  opacity?: number;
  className?: string;
}

export interface ScanlineOverlayProps {
  opacity?: number;
  className?: string;
  speed?: number;
}

// FloatingParticles types
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  baseVx: number;
  baseVy: number;
}

export interface FloatingParticlesProps {
  count?: number;
  color?: string;
  minSize?: number;
  maxSize?: number;
  speed?: number;
  className?: string;
}

export interface FloatingDotsProps {
  count?: number;
  className?: string;
  isDark?: boolean;
}

// GradientText types
export interface GradientTextProps {
  children: ReactNode;
  className?: string;
  gradient?: string;
  animated?: boolean;
}

export interface ShimmerTextProps {
  children: ReactNode;
  className?: string;
  isDark?: boolean;
}

// DropZone types
export interface DropZoneProps {
  children: ReactNode;
  onDrop?: (files: FileList) => void;
  onDragEnter?: () => void;
  onDragLeave?: () => void;
  className?: string;
  isDark?: boolean;
  acceptedTypes?: string[];
  disabled?: boolean;
}

export interface UploadButtonProps {
  onSelect?: (files: FileList) => void;
  accept?: string;
  multiple?: boolean;
  className?: string;
  isDark?: boolean;
  children?: ReactNode;
  progress?: number;
  isUploading?: boolean;
}
