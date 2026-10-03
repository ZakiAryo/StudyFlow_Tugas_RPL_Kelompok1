import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  medium: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300",
  high: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  urgent: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold capitalize", styles[priority])}>
      {priority}
    </span>
  );
}
