import { Loader } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils";

export const Spinner = ({ className, ...props }: React.ComponentProps<"svg">) => {
  return (
    <Loader
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
};
