import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { BsSun, BsMoon } from "react-icons/bs";

interface ThemeToggleButtonProps {
  isDark: boolean;
  onToggle: () => void;
}

export const ThemeToggleButton = ({ isDark, onToggle }: ThemeToggleButtonProps) => (
  <Button
    variant="outline"
    size="sm"
    onClick={onToggle}
    className={cn(
      "p-2 transition-all hover:scale-110 active:scale-95",
      isDark
        ? "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-100"
        : "border-zinc-300 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900"
    )}
  >
    {isDark ? <BsSun className="h-4 w-4" /> : <BsMoon className="h-4 w-4" />}
  </Button>
);
