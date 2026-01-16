import { cn } from "@workspace/ui/lib/utils";

interface CornerDecorationsProps {
  isDark?: boolean;
  className?: string;
}

export const CornerDecorations = ({ isDark = true, className }: CornerDecorationsProps) => (
  <div className={cn("pointer-events-none absolute inset-0", className)}>
    <div
      className={cn(
        "absolute top-0 left-0 h-2 w-2 border-t border-l",
        isDark ? "border-zinc-500" : "border-zinc-400"
      )}
    />
    <div
      className={cn(
        "absolute top-0 right-0 h-2 w-2 border-t border-r",
        isDark ? "border-zinc-500" : "border-zinc-400"
      )}
    />
    <div
      className={cn(
        "absolute bottom-0 left-0 h-2 w-2 border-b border-l",
        isDark ? "border-zinc-500" : "border-zinc-400"
      )}
    />
    <div
      className={cn(
        "absolute right-0 bottom-0 h-2 w-2 border-r border-b",
        isDark ? "border-zinc-500" : "border-zinc-400"
      )}
    />
  </div>
);
