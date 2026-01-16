import { cn } from "@workspace/ui/lib/utils";
import { CornerDecorations } from "../ServerPageComponents/CornerDecorations";

interface AccountSectionCardProps {
  isDark: boolean;
  children: React.ReactNode;
  className?: string;
}

export const AccountSectionCard = ({ isDark, children, className }: AccountSectionCardProps) => (
  <div
    className={cn(
      "relative mb-6 border p-6",
      isDark
        ? "border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a]"
        : "border-zinc-300 bg-gradient-to-b from-white via-zinc-50 to-zinc-100",
      className
    )}
  >
    <CornerDecorations isDark={isDark} />
    {children}
  </div>
);
