"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Flame,
  ListChecks,
  MapPin,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DeadlineBadge } from "@/components/tasks/deadline-badge";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { StatusBadge } from "@/components/tasks/status-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getDeadlineLabel, getDeadlineState } from "@/lib/deadline";
import { createSupabaseClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Priority = "low" | "medium" | "high" | "urgent";
type TaskStatus = "not_started" | "in_progress" | "revision" | "completed";

type Course = {
  id: string;
  name: string;
  lecturer_name: string | null;
  color_label: string;
};

type ScheduleSession = {
  id: string;
  user_id: string;
  course_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string | null;
  created_at: string;
  updated_at: string;
};

type Task = {
  id: string;
  user_id: string;
  course_id: string;
  title: string;
  description: string | null;
  deadline: string;
  priority: Priority;
  status: TaskStatus;
  progress: number;
  created_at: string;
  updated_at: string;
};

const dayLabels = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

const dayVariants: Record<number, string[]> = {
  0: ["sunday", "minggu"],
  1: ["monday", "senin"],
  2: ["tuesday", "selasa"],
  3: ["wednesday", "rabu"],
  4: ["thursday", "kamis"],
  5: ["friday", "jumat", "jum'at"],
  6: ["saturday", "sabtu"],
};

function getTodayDayInfo() {
  const dayIndex = new Date().getDay();

  return {
    label: dayLabels[dayIndex],
    values: new Set(dayVariants[dayIndex]),
  };
}

function normalizeDay(value: string) {
  return value.trim().toLowerCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00`));
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function sortByDeadline(a: Task, b: Task) {
  const deadlineDiff = a.deadline.localeCompare(b.deadline);

  if (deadlineDiff !== 0) {
    return deadlineDiff;
  }

  return b.updated_at.localeCompare(a.updated_at);
}

function sortByUpdated(a: Task, b: Task) {
  return b.updated_at.localeCompare(a.updated_at);
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[2rem] border bg-gradient-to-br from-primary/15 via-card to-violet-500/10 p-6 shadow-sm sm:p-8">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1.5 text-xs font-bold backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Ruang belajar kamu
            </div>

            <div className="h-10 w-72 animate-pulse rounded-lg bg-muted sm:w-96" />
            <div className="mt-4 h-12 max-w-xl animate-pulse rounded-lg bg-muted" />

            <div className="mt-6 flex gap-2">
              <div className="h-10 w-32 animate-pulse rounded-xl bg-muted" />
              <div className="h-10 w-32 animate-pulse rounded-xl bg-muted" />
            </div>
          </div>

          <div className="w-full max-w-sm rounded-3xl border bg-background/65 p-5 shadow-lg backdrop-blur-xl">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-10 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-5 h-2 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div
            key={item}
            className="h-36 animate-pulse rounded-3xl bg-muted"
          />
        ))}
      </section>

      <div className="h-72 animate-pulse rounded-3xl bg-muted" />

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="h-96 animate-pulse rounded-3xl bg-muted" />
        <div className="h-96 animate-pulse rounded-3xl bg-muted" />
      </section>
    </div>
  );
}

function TaskPreview({
  task,
  course,
}: {
  task: Task;
  course?: Course;
}) {
  const completed = task.status === "completed";
  const deadlineLabel = getDeadlineLabel(task.deadline, completed);
  const overdue =
    getDeadlineState(task.deadline, completed) === "overdue";

  return (
    <article
      className={cn(
        "rounded-2xl border bg-background/60 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md",
        overdue && "border-rose-300/60 dark:border-rose-900",
      )}
    >
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: course?.color_label ?? "#64748b" }}
            />
            <p className="truncate text-xs font-semibold text-muted-foreground">
              {course?.name ?? "Mata kuliah terhapus"}
            </p>
          </div>

          <h3 className="mt-2 font-bold">{task.title}</h3>

          <p className="mt-1 text-xs text-muted-foreground">
            Deadline {formatDate(task.deadline)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DeadlineBadge label={deadlineLabel} />
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <ProgressBar value={task.progress} />
        <span className="w-10 text-right text-sm font-bold">
          {task.progress}%
        </span>
      </div>

      <Link
        href={`/tasks/${task.id}`}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition hover:bg-muted"
      >
        Buka detail
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

export function DashboardManager() {
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [scheduleSessions, setScheduleSessions] = useState<
    ScheduleSession[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const todayInfo = useMemo(() => getTodayDayInfo(), []);

  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );

  const todaySchedule = useMemo(
    () =>
      scheduleSessions
        .filter((session) =>
          todayInfo.values.has(normalizeDay(session.day_of_week)),
        )
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [scheduleSessions, todayInfo],
  );

  const metrics = useMemo(() => {
    const total = tasks.length;

    const completed = tasks.filter(
      (task) => task.status === "completed",
    ).length;

    const inProgress = tasks.filter(
      (task) => task.status === "in_progress",
    ).length;

    const overdue = tasks.filter(
      (task) =>
        getDeadlineState(
          task.deadline,
          task.status === "completed",
        ) === "overdue",
    ).length;

    const dueToday = tasks.filter(
      (task) =>
        getDeadlineState(
          task.deadline,
          task.status === "completed",
        ) === "due_today",
    ).length;

    const dueThisWeek = tasks.filter((task) =>
      ["due_today", "due_tomorrow", "due_this_week"].includes(
        getDeadlineState(
          task.deadline,
          task.status === "completed",
        ),
      ),
    ).length;

    const overallProgress =
      total > 0
        ? Math.round(
            tasks.reduce((sum, task) => sum + task.progress, 0) / total,
          )
        : 0;

    return {
      total,
      completed,
      inProgress,
      overdue,
      dueToday,
      dueThisWeek,
      overallProgress,
    };
  }, [tasks]);

  const upcomingTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status !== "completed")
        .sort(sortByDeadline)
        .slice(0, 5),
    [tasks],
  );

  const recentTasks = useMemo(
    () => [...tasks].sort(sortByUpdated).slice(0, 5),
    [tasks],
  );

  const statCards = [
    {
      label: "Total tugas",
      value: String(metrics.total),
      helper: "Semua tugas milik akun ini",
      icon: ListChecks,
    },
    {
      label: "Selesai",
      value: String(metrics.completed),
      helper: "Tugas dengan status completed",
      icon: CheckCircle2,
    },
    {
      label: "Dikerjakan",
      value: String(metrics.inProgress),
      helper: "Tugas dengan status in progress",
      icon: TrendingUp,
    },
    {
      label: "Overdue",
      value: String(metrics.overdue),
      helper: "Tugas yang melewati deadline",
      icon: Flame,
    },
    {
      label: "Deadline hari ini",
      value: String(metrics.dueToday),
      helper: "Butuh perhatian hari ini",
      icon: Clock3,
    },
    {
      label: "Deadline minggu ini",
      value: String(metrics.dueThisWeek),
      helper: "Rencanakan waktu belajar minggu ini",
      icon: CalendarClock,
    },
  ];

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
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

      const [tasksResult, coursesResult, scheduleResult] =
        await Promise.all([
          supabase
            .from("tasks")
            .select(
              "id,user_id,course_id,title,description,deadline,priority,status,progress,created_at,updated_at",
            )
            .eq("user_id", user.id)
            .order("deadline", { ascending: true }),

          supabase
            .from("courses")
            .select("id,name,lecturer_name,color_label")
            .eq("user_id", user.id)
            .order("name", { ascending: true }),

          supabase
            .from("schedule_sessions")
            .select(
              "id,user_id,course_id,day_of_week,start_time,end_time,room,created_at,updated_at",
            )
            .eq("user_id", user.id)
            .order("start_time", { ascending: true }),
        ]);

      if (tasksResult.error) {
        throw tasksResult.error;
      }

      if (coursesResult.error) {
        throw coursesResult.error;
      }

      if (scheduleResult.error) {
        throw scheduleResult.error;
      }

      setTasks((tasksResult.data ?? []) as Task[]);
      setCourses((coursesResult.data ?? []) as Course[]);
      setScheduleSessions(
        (scheduleResult.data ?? []) as ScheduleSession[],
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat dashboard.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[2rem] border bg-gradient-to-br from-primary/15 via-card to-violet-500/10 p-6 shadow-sm sm:p-8">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1.5 text-xs font-bold backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Ruang belajar kamu
            </div>

            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Keep going.{" "}
              <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                You got this.
              </span>
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Pantau tugas, deadline, progress, dan jadwal kuliah dari satu
              tempat. Bikin hari kuliahmu lebih terarah tanpa ribet.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/tasks"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4" />
                Tambah tugas
              </Link>

              <Link
                href="/schedule"
                className="inline-flex h-10 items-center gap-2 rounded-xl border bg-background/60 px-4 text-sm font-semibold backdrop-blur transition hover:-translate-y-0.5 hover:bg-background"
              >
                <CalendarClock className="h-4 w-4" />
                Lihat jadwal
              </Link>
            </div>
          </div>

          <div className="w-full max-w-sm rounded-3xl border bg-background/65 p-5 shadow-lg backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  Overall progress
                </p>
                <p className="mt-2 text-4xl font-black">
                  {metrics.overallProgress}%
                </p>
              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <TrendingUp className="h-7 w-7" />
              </div>
            </div>

            <div className="mt-5">
              <ProgressBar value={metrics.overallProgress} />
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Rata-rata progress dari {metrics.total} tugas yang terdaftar.
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-300/60 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300 sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>

          <button
            onClick={() => void loadDashboard()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border bg-background px-3 font-semibold"
          >
            <RefreshCw className="h-4 w-4" />
            Coba lagi
          </button>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statCards.map((stat) => (
          <DashboardCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="rounded-3xl border bg-card/80 p-5 shadow-sm backdrop-blur sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">
                {todayInfo.label}
              </p>
            </div>

            <h2 className="mt-2 text-xl font-bold">Jadwal hari ini</h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Sesi kuliah kamu, diurutkan berdasarkan jam mulai.
            </p>
          </div>

          <Link
            href="/schedule"
            className="inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition hover:bg-muted"
          >
            Kelola jadwal
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {todaySchedule.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed p-8 text-center">
            <CalendarClock className="mx-auto h-7 w-7 text-muted-foreground" />

            <p className="mt-3 font-semibold">
              Tidak ada jadwal kuliah hari ini.
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Gunakan waktu kosong untuk catch up tugas. ✨
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {todaySchedule.map((session) => {
              const course = courseById.get(session.course_id);

              return (
                <article
                  key={session.id}
                  className="group rounded-2xl border bg-background/60 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-background"
                          style={{
                            backgroundColor:
                              course?.color_label ?? "#64748b",
                          }}
                        />

                        <p className="truncate text-sm font-bold">
                          {course?.name ?? "Mata kuliah terhapus"}
                        </p>
                      </div>

                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {course?.lecturer_name ?? "Dosen belum diisi"}
                      </p>
                    </div>

                    <span className="rounded-xl bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary">
                      {formatTime(session.start_time)}
                    </span>
                  </div>

                  <div className="mt-5 space-y-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-primary" />
                      {formatTime(session.start_time)} -{" "}
                      {formatTime(session.end_time)}
                    </span>

                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {session.room?.trim() || "Ruang belum diisi"}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {tasks.length === 0 ? (
        <section className="relative overflow-hidden rounded-3xl border bg-card p-8 text-center shadow-sm sm:p-12">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5" />

          <div className="relative">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ListChecks className="h-8 w-8" />
            </div>

            <h2 className="mt-5 text-xl font-bold">
              Dashboard kamu masih kosong
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Tambahkan mata kuliah dan tugas pertama supaya StudyFlow bisa
              membantu kamu mengatur deadline dan progress.
            </p>

            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Link
                href="/courses"
                className="inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition hover:bg-muted"
              >
                Kelola mata kuliah
              </Link>

              <Link
                href="/tasks"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20"
              >
                <Plus className="h-4 w-4" />
                Tambah tugas
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border bg-card/80 p-5 shadow-sm backdrop-blur sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">
                  Next up
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  Deadline terdekat
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Fokus ke tugas yang paling dekat dulu.
                </p>
              </div>

              <Link
                href="/tasks"
                className="inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition hover:bg-muted"
              >
                Lihat semua
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {upcomingTasks.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed p-6 text-center">
                <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-500" />

                <p className="mt-3 font-semibold">
                  Semua tugas aktif sudah selesai.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {upcomingTasks.map((task) => (
                  <TaskPreview
                    key={task.id}
                    task={task}
                    course={courseById.get(task.course_id)}
                  />
                ))}
              </div>
            )}
          </article>

          <article className="rounded-3xl border bg-card/80 p-5 shadow-sm backdrop-blur sm:p-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-violet-500">
                Recently updated
              </p>

              <h2 className="mt-1 text-xl font-bold">
                Aktivitas tugas
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Tugas yang terakhir kamu ubah.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {recentTasks.map((task) => {
                const course = courseById.get(task.course_id);

                return (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="group block rounded-2xl border bg-background/60 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-500/30 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                course?.color_label ?? "#64748b",
                            }}
                          />

                          <p className="truncate text-xs text-muted-foreground">
                            {course?.name ?? "Mata kuliah terhapus"}
                          </p>
                        </div>

                        <p className="mt-2 truncate text-sm font-semibold group-hover:text-violet-500">
                          {task.title}
                        </p>
                      </div>

                      <span className="text-xs font-bold">
                        {task.progress}%
                      </span>
                    </div>

                    <div className="mt-3">
                      <ProgressBar value={task.progress} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
