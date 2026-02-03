import { cn } from "@stellarUI/lib/utils";

interface SectionTitleProps {
  children: string;
  className?: string;
}

export const SectionTitle = ({ children, className }: SectionTitleProps) => (
  <h2
    className={cn(
      "mb-6 text-sm font-medium tracking-wider uppercase",
      "text-zinc-300",
      className
    )}
  >
    {children}
  </h2>
);
