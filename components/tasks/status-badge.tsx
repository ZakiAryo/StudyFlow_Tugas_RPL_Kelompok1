import { cn } from "@/lib/utils";

const labels: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  revision: "Revision",
  completed: "Completed",
};

const styles: Record<string, string> = {
  not_started:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300",
  in_progress:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300",
  revision:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
  completed:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs font-semibold",
        styles[status] ?? styles.not_started,
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}
