import { Loader } from "lucide-react"
import { cn } from "@stellarUI/lib/utils";

const Spinner = ({ className, ...props }: React.ComponentProps<"svg">) => {
  return (
    <Loader
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
};

export default Spinner
