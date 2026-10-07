import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Circle, MinusCircle, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  listProjectSteps,
  setProjectStepStatus,
  type ProjectStepStatus,
} from "@/lib/workspace.functions";

const STATUS_ORDER: ProjectStepStatus[] = [
  "not_started",
  "in_progress",
  "blocked",
  "completed",
];

const STATUS_META: Record<
  ProjectStepStatus,
  { label: string; node: string; ring: string; bar: string; chip: string; icon: any }
> = {
  not_started: {
    label: "Not started",
    node: "bg-muted text-muted-foreground border-border",
    ring: "ring-border",
    bar: "bg-border",
    chip: "bg-muted/40 text-muted-foreground border-border",
    icon: Circle,
  },
  in_progress: {
    label: "In progress",
    node: "bg-cyan/20 text-cyan border-cyan/50",
    ring: "ring-cyan/40",
    bar: "bg-gradient-to-r from-cyan/60 to-cyan/20",
    chip: "bg-cyan/15 text-cyan border-cyan/40",
    icon: Loader2,
  },
  blocked: {
    label: "Blocked",
    node: "bg-destructive/15 text-destructive border-destructive/50",
    ring: "ring-destructive/40",
    bar: "bg-destructive/40",
    chip: "bg-destructive/15 text-destructive border-destructive/40",
    icon: AlertTriangle,
  },
  completed: {
    label: "Completed",
    node: "bg-cyan text-background border-cyan",
    ring: "ring-cyan",
    bar: "bg-cyan",
    chip: "bg-cyan/15 text-cyan border-cyan/40",
    icon: Check,
  },
};

export function ProjectStatusChart({ missionId }: { missionId: string }) {
  const qc = useQueryClient();
  const fetchSteps = useServerFn(listProjectSteps);
  const setStatus = useServerFn(setProjectStepStatus);

  const stepsQ = useQuery({
    queryKey: ["mission-steps", missionId],
    queryFn: () => fetchSteps({ data: { mission_id: missionId } }),
  });

  const updateM = useMutation({
    mutationFn: (vars: { step_key: string; status: ProjectStepStatus }) =>
      setStatus({
        data: {
          mission_id: missionId,
          step_key: vars.step_key as any,
          status: vars.status,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mission-steps", missionId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const steps = stepsQ.data?.steps ?? [];
  const completed = steps.filter((s) => s.status === "completed").length;
  const progressPct = steps.length ? (completed / steps.length) * 100 : 0;

  return (
    <section className="border-b border-border bg-card/30 px-5 py-4 lg:px-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
            MISSION STATUS
          </h2>
          <p className="text-xs text-muted-foreground">
            {completed} of {steps.length} steps complete · click any step to update its status
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{Math.round(progressPct)}%</span>
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-cyan transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="relative">
        {/* Linear chart */}
        <div className="flex items-start gap-0.5">
          {steps.map((s, i) => {
            const meta = STATUS_META[s.status];
            const Icon = meta.icon;
            const next = steps[i + 1];
            return (
              <div key={s.key} className="flex flex-1 items-start">
                <div className="flex flex-1 flex-col items-center">
                  <StepMenu
                    current={s.status}
                    disabled={updateM.isPending}
                    onSelect={(status) =>
                      updateM.mutate({ step_key: s.key, status })
                    }
                  >
                    <div
                      className={`grid h-8 w-8 place-items-center rounded-full border-2 transition ${meta.node} ring-2 ring-offset-2 ring-offset-card/30 ${meta.ring}`}
                    >
                      <Icon
                        className={`h-3.5 w-3.5 ${s.status === "in_progress" ? "animate-spin" : ""}`}
                      />
                    </div>
                  </StepMenu>
                  <div className="mt-1.5 text-center">
                    <div className="text-[11px] font-semibold leading-tight text-foreground">{s.label}</div>
                    <span
                      className={`mt-0.5 inline-block rounded-full border px-1.5 py-0.5 text-[9px] font-medium leading-none ${meta.chip}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                </div>
                {next && (
                  <div
                    className={`mt-4 h-0.5 flex-1 rounded ${
                      s.status === "completed" ? "bg-cyan" : meta.bar
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StepMenu({
  current,
  onSelect,
  disabled,
  children,
}: {
  current: ProjectStepStatus;
  onSelect: (s: ProjectStepStatus) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        disabled={disabled}
        className="block cursor-pointer disabled:opacity-50"
        aria-label="Change step status"
      >
        {children}
      </button>
      <div className="invisible absolute left-1/2 top-full z-20 mt-2 w-44 -translate-x-1/2 rounded-md border border-border bg-card p-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        {STATUS_ORDER.map((s) => {
          const m = STATUS_META[s];
          const Icon = m.icon;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onSelect(s)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted/60 ${
                s === current ? "text-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {m.label}
              {s === current && <Check className="ml-auto h-3 w-3 text-cyan" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
