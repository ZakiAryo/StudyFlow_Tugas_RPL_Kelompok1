"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { DeadlineBadge } from "@/components/tasks/deadline-badge";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { StatusBadge } from "@/components/tasks/status-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getDeadlineLabel } from "@/lib/deadline";
import { createSupabaseClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Priority = "low" | "medium" | "high" | "urgent";
type TaskStatus = "not_started" | "in_progress" | "revision" | "completed";
type RiskLevel = "low" | "medium" | "high";

type ActiveTask = {
  id: string;
  user_id: string;
  title: string;
  deadline: string;
  progress: number;
  priority: Priority;
  status: TaskStatus;
  created_at: string;
};

type PriorityRecommendation = {
  task_id: string;
  reason: string;
  suggested_action: string;
  risk_level: RiskLevel;
};

type PriorityResponse = {
  recommendations: PriorityRecommendation[];
  error?: string;
  code?: string;
};

const riskStyles: Record<RiskLevel, string> = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  medium:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  high: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
};

function sortTasks(a: ActiveTask, b: ActiveTask) {
  const deadlineDiff = a.deadline.localeCompare(b.deadline);

  if (deadlineDiff !== 0) {
    return deadlineDiff;
  }

  return b.created_at.localeCompare(a.created_at);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00`));
}

function RiskBadge({ riskLevel }: { riskLevel: RiskLevel }) {
  return (
    <span
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs font-semibold capitalize",
        riskStyles[riskLevel],
      )}
    >
      {riskLevel} risk
    </span>
  );
}

export function PriorityAssistant() {
  const router = useRouter();
  const [tasks, setTasks] = useState<ActiveTask[]>([]);
  const [recommendations, setRecommendations] = useState<
    PriorityRecommendation[]
  >([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );

  const highRiskCount = recommendations.filter(
    (item) => item.risk_level === "high",
  ).length;

  const loadActiveTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error: tasksError } = await supabase
        .from("tasks")
        .select("id,user_id,title,deadline,progress,priority,status,created_at")
        .eq("user_id", user.id)
        .neq("status", "completed")
        .order("deadline", { ascending: true });

      if (tasksError) {
        throw tasksError;
      }

      setTasks(((data ?? []) as ActiveTask[]).sort(sortTasks));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat tugas aktif.",
      );
    } finally {
      setIsLoadingTasks(false);
    }
  }, [router]);

  useEffect(() => {
    void loadActiveTasks();
  }, [loadActiveTasks]);

  async function generateRecommendations() {
    setIsGenerating(true);
    setError(null);
    setRecommendations([]);

    try {
      const response = await fetch("/api/ai/priority", {
        method: "POST",
      });

      const payload = (await response.json().catch(() => null)) as
        | Partial<PriorityResponse>
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Gagal membuat rekomendasi prioritas.",
        );
      }

      if (!payload || !Array.isArray(payload.recommendations)) {
        throw new Error("Response AI tidak sesuai format rekomendasi.");
      }

      setRecommendations(payload.recommendations);
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Gagal membuat rekomendasi prioritas.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal">
            AI Priority Assistant
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Urutkan tugas aktif berdasarkan deadline, progress, priority, dan
            status agar kamu tahu apa yang perlu dikerjakan dulu.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => void loadActiveTasks()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted"
          >
            <RefreshCw
              className={cn("h-4 w-4", isLoadingTasks && "animate-spin")}
            />
            Refresh
          </button>
          <button
            onClick={() => void generateRecommendations()}
            disabled={isGenerating || isLoadingTasks || tasks.length === 0}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Priority
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-4">
          <article className="rounded-lg border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Tugas aktif</h2>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Total aktif</p>
                <p className="mt-2 text-2xl font-semibold">{tasks.length}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Rekomendasi</p>
                <p className="mt-2 text-2xl font-semibold">
                  {recommendations.length}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">High risk</p>
                <p className="mt-2 text-2xl font-semibold">{highRiskCount}</p>
              </div>
            </div>
          </article>

          <article className="rounded-lg border bg-card p-5 shadow-soft">
            <h2 className="font-semibold">Daftar tugas</h2>
            {isLoadingTasks ? (
              <div className="mt-5 space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="rounded-lg border p-4">
                    <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                    <div className="mt-3 h-3 w-32 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed p-6 text-center">
                <p className="font-medium">Tidak ada tugas aktif</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Tugas dengan status completed tidak masuk analisis prioritas.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {tasks.slice(0, 5).map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="block rounded-lg border p-4 transition hover:bg-muted"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {task.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Deadline {formatDate(task.deadline)}
                        </p>
                      </div>
                      <span className="text-xs font-semibold">
                        {task.progress}%
                      </span>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={task.progress} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </article>
        </div>

        <article className="rounded-lg border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Rekomendasi AI</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Hasil akan disimpan ke riwayat AI suggestions setelah dibuat.
              </p>
            </div>
            {recommendations.length > 0 ? (
              <span className="rounded-md border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                {recommendations.length} items
              </span>
            ) : null}
          </div>

          {isGenerating ? (
            <div className="mt-5 space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="rounded-lg border p-4">
                  <div className="h-4 w-64 animate-pulse rounded bg-muted" />
                  <div className="mt-3 h-3 w-full animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : recommendations.length === 0 ? (
            <div className="mt-5 flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <AlertTriangle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">Belum ada rekomendasi</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Klik Generate Priority untuk meminta AI mengurutkan tugas aktif
                berdasarkan risiko dan dampaknya.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {recommendations.map((recommendation, index) => {
                const task = taskById.get(recommendation.task_id);
                const completed = task?.status === "completed";
                const deadlineLabel = task
                  ? getDeadlineLabel(task.deadline, completed)
                  : "Unknown deadline";

                return (
                  <section
                    key={`${recommendation.task_id}-${index}`}
                    className="rounded-lg border bg-background p-4"
                  >
                    <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                            #{index + 1}
                          </span>
                          <RiskBadge riskLevel={recommendation.risk_level} />
                          {task ? (
                            <>
                              <DeadlineBadge label={deadlineLabel} />
                              <PriorityBadge priority={task.priority} />
                              <StatusBadge status={task.status} />
                            </>
                          ) : null}
                        </div>
                        <h3 className="mt-3 font-semibold">
                          {task?.title ?? recommendation.task_id}
                        </h3>
                      </div>
                      <Link
                        href={`/tasks/${recommendation.task_id}`}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted"
                      >
                        Detail
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>

                    {task ? (
                      <div className="mt-4 flex items-center gap-3">
                        <ProgressBar value={task.progress} />
                        <span className="w-10 text-right text-sm font-semibold">
                          {task.progress}%
                        </span>
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          Reason
                        </p>
                        <p className="mt-2 text-sm leading-6">
                          {recommendation.reason}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          Suggested action
                        </p>
                        <p className="mt-2 text-sm leading-6">
                          {recommendation.suggested_action}
                        </p>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
