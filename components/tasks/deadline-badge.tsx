import { cn } from "@/lib/utils";

export function DeadlineBadge({ label }: { label: string }) {
  const normalized = label.toLowerCase();
  const overdue = normalized.includes("overdue");
  const today = normalized.includes("today");
  const tomorrow = normalized.includes("tomorrow");
  const week = normalized.includes("week");

  return (
    <span
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs font-semibold",
        overdue && "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
        today && "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
        tomorrow && "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300",
        week && !today && !tomorrow && "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300",
        !overdue && !today && !tomorrow && !week && "bg-background text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}
