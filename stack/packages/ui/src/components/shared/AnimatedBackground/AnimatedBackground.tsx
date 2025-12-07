"use client";

import { useEffect, useRef, useCallback } from "react";

interface AnimatedBackgroundProps {
  isDark?: boolean;
  dotSize?: number;
  dotSpacing?: number;
  glowRadius?: number;
  glowIntensity?: number;
  trailLength?: number;
  trailDecay?: number;
  pulseSpeed?: number;
  pulseIntensity?: number;
}

interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

export const AnimatedBackground = ({
  isDark = true,
  dotSize = 1,
  dotSpacing = 24,
  glowRadius = 120,
  glowIntensity = 0.3,
  trailLength = 50,
  trailDecay = 0.98,
  pulseSpeed = 2,
  pulseIntensity = 0.3,
}: AnimatedBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const trailRef = useRef<TrailPoint[]>([]);
  const animationRef = useRef<number | undefined>(undefined);
  const lastTrailTimeRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const mouse = mouseRef.current;
    const trail = trailRef.current;

    const now = Date.now();
    if (now - lastTrailTimeRef.current > 16 && mouse.x > -500) {
      const lastPoint = trail[0];
      if (!lastPoint ||
          Math.abs(mouse.x - lastPoint.x) > 3 ||
          Math.abs(mouse.y - lastPoint.y) > 3) {
        trail.unshift({ x: mouse.x, y: mouse.y, age: 1 });
        if (trail.length > trailLength) {
          trail.pop();
        }
      }
      lastTrailTimeRef.current = now;
    }

    for (let i = 0; i < trail.length; i++) {
      const point = trail[i];
      if (point) {
        point.age *= trailDecay;
      }
    }

    while (trail.length > 0) {
      const lastPoint = trail[trail.length - 1];
      if (lastPoint && lastPoint.age < 0.01) {
        trail.pop();
      } else {
        break;
      }
    }

    ctx.clearRect(0, 0, width, height);

    const baseDotColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.12)";
    const glowColor = isDark ? [255, 255, 255] : [0, 0, 0];

    for (let x = dotSpacing / 2; x < width; x += dotSpacing) {
      for (let y = dotSpacing / 2; y < height; y += dotSpacing) {
        let maxIntensity = 0;

        for (let i = 0; i < trail.length; i++) {
          const point = trail[i];
          if (!point) continue;
          const dx = x - point.x;
          const dy = y - point.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          // Taper the trail radius based on age (older = smaller)
          const taperFactor = point.age * point.age; // Quadratic falloff for smooth taper
          const trailRadius = glowRadius * taperFactor;
          const glow = Math.max(0, 1 - distance / trailRadius);
          const intensity = glow * glowIntensity * taperFactor;
          maxIntensity = Math.max(maxIntensity, intensity);
        }

        const dx = x - mouse.x;
        const dy = y - mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const glow = Math.max(0, 1 - distance / glowRadius);

        // Add pulse effect that radiates outward from cursor
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const pulsePhase = elapsed * pulseSpeed - distance * 0.02;
        const pulse = 1 + Math.sin(pulsePhase * Math.PI) * pulseIntensity;

        const currentIntensity = glow * glowIntensity * pulse;
        maxIntensity = Math.max(maxIntensity, currentIntensity);

        if (maxIntensity > 0.005) {
          const alpha = isDark
            ? 0.08 + maxIntensity * 0.35
            : 0.12 + maxIntensity * 0.5;
          ctx.fillStyle = `rgba(${glowColor[0]}, ${glowColor[1]}, ${glowColor[2]}, ${alpha})`;

          const currentDotSize = dotSize + maxIntensity * (isDark ? 1.2 : 1.8);
          ctx.beginPath();
          ctx.arc(x, y, currentDotSize, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = baseDotColor;
          ctx.beginPath();
          ctx.arc(x, y, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    animationRef.current = requestAnimationFrame(draw);
  }, [isDark, dotSize, dotSpacing, glowRadius, glowIntensity, trailLength, trailDecay, pulseSpeed, pulseIntensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    const updatePosition = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    };

    const handleMouseMove = (e: MouseEvent) => {
      updatePosition(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        if (touch) {
          updatePosition(touch.clientX, touch.clientY);
        }
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        if (touch) {
          updatePosition(touch.clientX, touch.clientY);
        }
      }
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    const handleTouchEnd = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvas.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    />
  );
};
