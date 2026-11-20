"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";

function AnimatedStatValue({ value }: { value: string }) {
  const numericValue = Number(value);
  const isNumeric = Number.isFinite(numericValue);
  const [displayValue, setDisplayValue] = useState(isNumeric ? 0 : value);

  useEffect(() => {
    if (!isNumeric) {
      setDisplayValue(value);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const duration = 650;

    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(numericValue * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, [isNumeric, numericValue, value]);

  return <>{displayValue}</>;
}

export function DashboardCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border bg-card/80 p-5 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/5 blur-2xl transition-transform duration-500 group-hover:scale-150" />
      <div className="absolute -bottom-16 -left-16 h-24 w-24 rounded-full bg-violet-500/5 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.13em] text-muted-foreground">
            {label}
          </p>

          <p className="mt-3 text-3xl font-black tracking-tight tabular-nums">
            <AnimatedStatValue value={value} />
          </p>

          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {helper}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10 transition-all duration-300 group-hover:rotate-3 group-hover:scale-105 group-hover:bg-primary/15 group-hover:shadow-[0_0_20px_hsl(var(--primary)/0.12)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}
