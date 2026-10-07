import { Github } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// TODO: replace with the live repo URL once the project is connected to GitHub.
const REPO_URL = "";

export function GitHubSyncBadge() {
  const inner = (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-charcoal px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-gold/60 hover:text-gold">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-cyan" />
      </span>
      <Github size={11} />
      GitHub auto-sync
    </span>
  );

  const badge = REPO_URL ? (
    <a href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="Open GitHub repository">
      {inner}
    </a>
  ) : (
    inner
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-56 text-center">
          Changes made in Lovable push to GitHub automatically, and GitHub pushes sync back in real time. No manual push needed.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
