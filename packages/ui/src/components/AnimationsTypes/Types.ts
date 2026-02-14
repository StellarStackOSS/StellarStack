import type { ReactNode } from "react";

// Common props shared across animation components
export interface BaseAnimationProps {
  className?: string;
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
}

// DropZone types
export interface DropZoneProps {
  children: ReactNode;
  onDrop?: (files: FileList) => void;
  onDragEnter?: () => void;
  onDragLeave?: () => void;
  className?: string;
  acceptedTypes?: string[];
  disabled?: boolean;
}

export interface UploadButtonProps {
  onSelect?: (files: FileList) => void;
  accept?: string;
  multiple?: boolean;
  className?: string;
  children?: ReactNode;
  progress?: number;
  isUploading?: boolean;
}
