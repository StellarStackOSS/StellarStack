"use client";

import { useEffect, useState } from "react";
import { cn } from "@stellarUI/lib/Utils";
import type { FadeInProps, FadeDirection, StaggerContainerProps } from "../AnimationsTypes/Types";

export type { FadeInProps, FadeDirection, StaggerContainerProps };

const FadeIn = ({
  children,
  delay = 0,
  duration = 400,
  className,
  direction = "up",
}: FadeInProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const directionStyles = {
    up: "translate-y-4",
    down: "-translate-y-4",
    left: "translate-x-4",
    right: "-translate-x-4",
    none: "",
  };

  return (
    <div
      className={cn(
        "transition-all",
        isVisible ? "opacity-100 translate-x-0 translate-y-0" : `opacity-0 ${directionStyles[direction]}`,
        className
      )}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
};

const StaggerContainer = ({
  children,
  staggerDelay = 50,
  initialDelay = 0,
  className,
  direction = "up",
}: StaggerContainerProps) => {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <FadeIn
          key={index}
          delay={initialDelay + index * staggerDelay}
          direction={direction}
        >
          {child}
        </FadeIn>
      ))}
    </div>
  );
};

export { FadeIn, StaggerContainer };
