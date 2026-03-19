"use client";

import NumberFlow from "@number-flow/react";
import { cn } from "@stellarUI/lib/Utils";
import type {
  AnimatedNumberProps,
  CounterDigitProps,
  MechanicalCounterProps,
} from "../AnimationsTypes/Types";

export type { AnimatedNumberProps, CounterDigitProps, MechanicalCounterProps };

const AnimatedNumber = ({
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
        maximumFractionDigits: decimals,
      }}
      transformTiming={{
        duration: duration,
        easing: "ease-out",
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
    <span className={cn("relative inline-block overflow-hidden", className)}>
      <span className="inline-block transition-transform duration-300 ease-out">{digit}</span>
    </span>
  );
};

const MechanicalCounter = ({ value, className, digitClassName }: MechanicalCounterProps) => {
  const digits = Math.abs(value).toString().split("");
  const isNegative = value < 0;

  return (
    <span className={cn("inline-flex font-mono tabular-nums", className)}>
      {isNegative && <span>-</span>}
      {digits.map((digit, index) => (
        <CounterDigit key={`${index}-${digit}`} digit={digit} className={digitClassName} />
      ))}
    </span>
  );
};

export { AnimatedNumber, MechanicalCounter };
