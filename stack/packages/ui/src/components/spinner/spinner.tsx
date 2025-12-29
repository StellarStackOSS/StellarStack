import { LoaderIcon } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils";

export const Spinner = ({ className, ...props }: React.ComponentProps<"svg">) => {
  return (
    <LoaderIcon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
};
