import { cn } from "@/lib/utils";

function Skeleton({ className, shimmer, ...props }: React.HTMLAttributes<HTMLDivElement> & { shimmer?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden rounded-md", shimmer ? "bg-muted/50" : "animate-pulse bg-primary/10", className)} {...props}>
      {shimmer && (
        <div className="pointer-events-none absolute inset-0 animate-shimmer shimmer-overlay" />
      )}
    </div>
  );
}

export { Skeleton };
