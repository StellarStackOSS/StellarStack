import { cn } from "@workspace/ui/lib/utils";

interface SectionTitleProps {
  isDark: boolean;
  children: string;
  className?: string;
}

export const SectionTitle = ({ isDark, children, className }: SectionTitleProps) => (
  <h2
    className={cn(
      "mb-6 text-sm font-medium tracking-wider uppercase",
      isDark ? "text-zinc-300" : "text-zinc-700",
      className
    )}
  >
    {children}
  </h2>
);
