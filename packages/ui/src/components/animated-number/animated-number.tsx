"use client";

import NumberFlow from "@number-flow/react";
import { cn } from "@workspace/ui/lib/utils";
import type { AnimatedNumberProps, CounterDigitProps, MechanicalCounterProps } from "../animations-types";

export type { AnimatedNumberProps, CounterDigitProps, MechanicalCounterProps };

export const AnimatedNumber = ({
  value,
  duration = 400,
  decimals = 0,
  suffix = "",
  prefix = "",
  className,
  willChange = false,
}: AnimatedNumberProps) => {
  return (
    <NumberFlow
      value={value}
      format={{
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }}
      transformTiming={{
        duration: duration,
        easing: "ease-out"
      }}
      prefix={prefix}
      suffix={suffix}
      className={cn("tabular-nums", className)}
      willChange={willChange}
    />
  );
};

// Mechanical counter style number display
const CounterDigit = ({ digit, className }: CounterDigitProps) => {
  return (
    <span
      className={cn(
        "inline-block relative overflow-hidden",
        className
      )}
    >
      <span className="transition-transform duration-300 ease-out inline-block">
        {digit}
      </span>
    </span>
  );
};

export const MechanicalCounter = ({
  value,
  className,
  digitClassName,
}: MechanicalCounterProps) => {
  const digits = Math.abs(value).toString().split("");
  const isNegative = value < 0;

  return (
    <span className={cn("inline-flex tabular-nums font-mono", className)}>
      {isNegative && <span>-</span>}
      {digits.map((digit, index) => (
        <CounterDigit
          key={`${index}-${digit}`}
          digit={digit}
          className={digitClassName}
        />
      ))}
    </span>
  );
};
