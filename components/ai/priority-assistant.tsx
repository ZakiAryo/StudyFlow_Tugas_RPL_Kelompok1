
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
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
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function RiskBadge({ riskLevel }: { riskLevel: RiskLevel }) {
  const labels: Record<RiskLevel, string> = {
    low: "Risiko rendah",
    medium: "Risiko sedang",
    high: "Risiko tinggi",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
        riskStyles[riskLevel],
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", {
          "bg-emerald-500": riskLevel === "low",
          "bg-amber-500": riskLevel === "medium",
          "bg-rose-500": riskLevel === "high",
        })}
      />
      {labels[riskLevel]}
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
        .select(
          "id,user_id,title,deadline,progress,priority,status,created_at",
        )
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
        throw new Error("Format rekomendasi dari AI tidak sesuai.");
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
    <main className="min-h-full space-y-6 pb-8">
      {/* HERO */}
      <section className="relative isolate overflow-hidden rounded-[28px] border border-teal-400/20 bg-[#11171a] p-5 text-white shadow-[0_20px_70px_-35px_rgba(45,212,191,0.22)] sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 -z-10 h-56 w-56 rounded-full bg-cyan-400/[0.07] blur-3xl" />

        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-teal-200">
              <Sparkles className="h-3.5 w-3.5" />
              YOUR STUDY SIDEKICK
              <span className="h-1 w-1 rounded-full bg-teal-300" />
              AI POWERED
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.7rem]">
              Kerjakan yang{" "}
              <span className="text-teal-300">paling penting</span> dulu.
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
              Nggak perlu menebak harus mulai dari mana. Biarkan AI membaca
              deadline, progress, prioritas, dan status tugas aktifmu untuk
              membantu menentukan langkah berikutnya.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
            <button
              type="button"
              onClick={() => void loadActiveTasks()}
              disabled={isLoadingTasks}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  isLoadingTasks && "animate-spin",
                )}
              />
              Refresh tasks
            </button>

            <button
              type="button"
              onClick={() => void generateRecommendations()}
              disabled={
                isGenerating || isLoadingTasks || tasks.length === 0
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-300 px-4 text-sm font-bold text-[#071b18] shadow-lg shadow-teal-400/10 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGenerating ? "Lagi mikir..." : "Generate priority"}
              {!isGenerating && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* HERO STATS */}
        <div className="relative mt-7 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-300/10 text-teal-300">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {isLoadingTasks ? "—" : tasks.length}
              </p>
              <p className="text-xs text-white/55">Tugas masih aktif</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-300/10 text-teal-300">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {recommendations.length}
              </p>
              <p className="text-xs text-white/55">Rekomendasi AI</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-400/10 text-rose-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{highRiskCount}</p>
              <p className="text-xs text-white/55">Tugas berisiko tinggi</p>
            </div>
          </div>
        </div>
      </section>

      {/* ERROR */}
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/[0.07] p-4 text-sm text-rose-700 dark:text-rose-300"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Ada yang belum beres</p>
            <p className="mt-1 leading-6">{error}</p>
          </div>
        </div>
      ) : null}

      {/* CONTENT */}
      <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-5">
          {/* ACTIVE TASKS SUMMARY */}
          <article className="rounded-[24px] border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600 dark:text-teal-300">
                  YOUR WORKLOAD
                </p>
                <h2 className="mt-1 text-lg font-bold tracking-tight">
                  Tugas aktif
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Snapshot pekerjaan yang belum selesai.
                </p>
              </div>

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-400/15 text-teal-700 dark:text-teal-300">
                <ClipboardList className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border bg-muted/30 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Total aktif
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight">
                  {isLoadingTasks ? "—" : tasks.length}
                </p>
              </div>

              <div className="rounded-2xl border bg-muted/30 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  High risk
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-rose-500">
                  {highRiskCount}
                </p>
              </div>
            </div>
          </article>

          {/* TASK LIST */}
          <article className="rounded-[24px] border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  Daftar tugas
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pilih tugas untuk melihat detailnya.
                </p>
              </div>

              <span className="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground">
                {tasks.length} tasks
              </span>
            </div>

            {isLoadingTasks ? (
              <div className="mt-5 space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="rounded-2xl border p-4">
                    <div className="h-4 w-48 animate-pulse rounded-full bg-muted" />
                    <div className="mt-3 h-3 w-32 animate-pulse rounded-full bg-muted" />
                    <div className="mt-4 h-1.5 w-full animate-pulse rounded-full bg-muted" />
                  </div>
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed p-7 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="mt-3 font-semibold">Kamu lagi clean slate ✨</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Belum ada tugas aktif. Tugas berstatus completed tidak
                  masuk analisis prioritas.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {tasks.slice(0, 5).map((task, index) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="group block rounded-2xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:border-teal-500/40 hover:bg-teal-500/[0.035]"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
                          index === 0
                            ? "bg-teal-300 text-[#071b18]"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-semibold leading-5">
                            {task.title}
                          </p>
                          <span className="shrink-0 text-xs font-bold tabular-nums">
                            {task.progress}%
                          </span>
                        </div>

                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock3 className="h-3.5 w-3.5" />
                          Deadline {formatDate(task.deadline)}
                        </p>

                        <div className="mt-3">
                          <ProgressBar value={task.progress} />
                        </div>
                      </div>

                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-teal-600" />
                    </div>
                  </Link>
                ))}

                {tasks.length > 5 ? (
                  <Link
                    href="/tasks"
                    className="flex items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm font-semibold text-muted-foreground transition hover:border-teal-500/40 hover:text-foreground"
                  >
                    Lihat semua {tasks.length} tugas
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : null}
              </div>
            )}
          </article>
        </div>

        {/* AI RECOMMENDATIONS */}
        <article className="min-w-0 rounded-[24px] border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-teal-400/15 px-3 py-1 text-xs font-bold text-teal-700 dark:text-teal-300">
                <Sparkles className="h-3.5 w-3.5" />
                SMART RECOMMENDATIONS
              </div>

              <h2 className="mt-3 text-xl font-bold tracking-tight">
                Rekomendasi AI
              </h2>

              <p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
                Prioritas yang lebih jelas, satu langkah pada satu waktu.
              </p>
            </div>

            {recommendations.length > 0 ? (
              <span className="inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                {recommendations.length} rekomendasi
              </span>
            ) : null}
          </div>

          {isGenerating ? (
            <div className="mt-6 space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="rounded-2xl border p-5">
                  <div className="h-4 w-36 animate-pulse rounded-full bg-muted" />
                  <div className="mt-4 h-4 w-3/4 animate-pulse rounded-full bg-muted" />
                  <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-muted" />
                  <div className="mt-2 h-3 w-4/5 animate-pulse rounded-full bg-muted" />
                </div>
              ))}

              <p className="text-center text-sm text-muted-foreground">
                AI lagi menyusun prioritasmu...
              </p>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="mt-6 flex min-h-[360px] flex-col items-center justify-center rounded-[22px] border border-dashed bg-muted/15 p-7 text-center sm:p-10">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-[22px] bg-teal-400/15 text-teal-700 dark:text-teal-300">
                <Sparkles className="h-7 w-7" />
                <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-card bg-teal-400" />
              </div>

              <h3 className="mt-5 text-lg font-bold">
                Let&apos;s find your next move.
              </h3>

              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Klik{" "}
                <span className="font-semibold text-foreground">
                  Generate priority
                </span>{" "}
                untuk menganalisis tugas aktif berdasarkan risiko dan
                dampaknya.
              </p>

              <button
                type="button"
                onClick={() => void generateRecommendations()}
                disabled={
                  isGenerating || isLoadingTasks || tasks.length === 0
                }
                className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-300 px-5 text-sm font-bold text-[#071b18] transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                Generate my priorities
              </button>

              {tasks.length === 0 && !isLoadingTasks ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Tambahkan tugas terlebih dahulu agar AI bisa mulai
                  membantu.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {recommendations.map((recommendation, index) => {
                const task = taskById.get(recommendation.task_id);
                const completed = task?.status === "completed";
                const deadlineLabel = task
                  ? getDeadlineLabel(task.deadline, completed)
                  : "Unknown deadline";

                return (
                  <section
                    key={`${recommendation.task_id}-${index}`}
                    className="group rounded-[22px] border bg-background p-4 transition duration-200 hover:border-teal-500/35 sm:p-5"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black",
                          index === 0
                            ? "bg-teal-300 text-[#071b18]"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <RiskBadge riskLevel={recommendation.risk_level} />

                          {task ? (
                            <>
                              <DeadlineBadge label={deadlineLabel} />
                              <PriorityBadge priority={task.priority} />
                              <StatusBadge status={task.status} />
                            </>
                          ) : null}
                        </div>

                        <h3 className="mt-3 text-base font-bold leading-6">
                          {task?.title ?? "Tugas"}
                        </h3>
                      </div>

                      <Link
                        href={`/tasks/${recommendation.task_id}`}
                        aria-label={`Lihat detail ${task?.title ?? "tugas"}`}
                        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition hover:border-teal-500/40 hover:bg-teal-500/[0.06]"
                      >
                        Detail
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>

                    {task ? (
                      <div className="mt-4 rounded-xl bg-muted/35 p-3.5">
                        <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                          <span className="font-medium text-muted-foreground">
                            Progress tugas
                          </span>
                          <span className="font-bold tabular-nums">
                            {task.progress}%
                          </span>
                        </div>

                        <ProgressBar value={task.progress} />
                      </div>
                    ) : null}

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border bg-muted/20 p-4">
                        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
                          <Target className="h-3.5 w-3.5 text-teal-600 dark:text-teal-300" />
                          Kenapa ini penting
                        </p>

                        <p className="mt-2 text-sm leading-6">
                          {recommendation.reason}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-teal-500/20 bg-teal-500/[0.045] p-4">
                        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
                          <ArrowRight className="h-3.5 w-3.5 text-teal-600 dark:text-teal-300" />
                          Langkah berikutnya
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

          <div className="mt-5 flex items-start gap-2 border-t pt-4 text-xs leading-5 text-muted-foreground">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-300" />
            <p>
              Gunakan rekomendasi sebagai panduan. Kamu tetap memegang kendali
              atas urutan dan cara menyelesaikan tugas.
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
