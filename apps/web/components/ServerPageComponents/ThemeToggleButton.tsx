import {TextureButton} from "@workspace/ui/components/texture-button";
import { cn } from "@workspace/ui/lib/utils";
import { BsSun } from "react-icons/bs";

interface ThemeToggleButtonProps {
  onToggle: () => void;
}

export const ThemeToggleButton = ({ onToggle }: ThemeToggleButtonProps) => (
  <TextureButton variant="minimal"
    onClick={onToggle}
  >
    <BsSun className="h-4 w-4" />
  </TextureButton>
);
