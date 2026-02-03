import { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@stellarUI/lib/utils";
import { InfoTooltip } from "@stellarUI/components/InfoTooltip/InfoTooltip";

type CardProps = ComponentPropsWithoutRef<"div">;

const UsageCardTitle = ({ className, children, ...props }: CardProps) => {
  return (
    <div
      className={cn(
        "mb-6 text-2xl font-light text-zinc-100",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const UsageCardContent = ({ className, children, ...props }: CardProps) => {
  return (
    <div className={cn("flex flex-1 flex-col space-y-4", className)} {...props}>
      {children}
    </div>
  );
};

const UsageCardFooter = ({ className, children, ...props }: CardProps) => {
    return (
        <div
            className={cn(
                "mt-6 pt-4 border-t text-sm",
                "border-zinc-700 text-zinc-400",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};

interface UsageCardProps extends Omit<CardProps, 'title'> {
  title?: string;
  tooltipContent?: ReactNode;
}

const UsageCard = ({ className, children, title, tooltipContent, ...props }: UsageCardProps) => {
  return (
      <div className="bg-[#090909] border border-white/5 pt-2 p-1 rounded-lg flex flex-col h-full">
          {title && (
            <div className="text-xs pl-2 pb-2 opacity-50 flex flex-row justify-between shrink-0">
                <span>
                    {title}
                </span>
                {tooltipContent && <InfoTooltip content={tooltipContent} />}
            </div>
          )}
          <div
              className={cn(
                  "relative flex flex-col flex-1 rounded-lg border p-4 transition-colors border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20",
                  className
              )}
              {...props}
          >
              {children}
          </div>
      </div>
  );
};

UsageCard.Title = UsageCardTitle;
UsageCard.Content = UsageCardContent;
UsageCard.Footer = UsageCardFooter;

export { UsageCardContent, UsageCardTitle, UsageCardFooter };
export default UsageCard;
