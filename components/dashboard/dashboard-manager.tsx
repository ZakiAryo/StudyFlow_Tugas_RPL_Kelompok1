"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Flame,
  ListChecks,
  MapPin,
  Plus,
  RefreshCw,
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
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-3">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-9 w-56 animate-pulse rounded bg-muted" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="h-24 w-full animate-pulse rounded-lg bg-muted md:w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="h-36 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </div>
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
  const overdue = getDeadlineState(task.deadline, completed) === "overdue";

  return (
    <article
      className={cn(
        "rounded-lg border bg-background p-4 transition hover:bg-muted/50",
        overdue && "border-rose-200 dark:border-rose-900",
      )}
    >
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: course?.color_label ?? "#64748b" }}
            />
            <p className="truncate text-sm text-muted-foreground">
              {course?.name ?? "Mata kuliah terhapus"}
            </p>
          </div>
          <h3 className="mt-2 font-semibold">{task.title}</h3>
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
        <span className="w-10 text-right text-sm font-semibold">
          {task.progress}%
        </span>
      </div>

      <Link
        href={`/tasks/${task.id}`}
        className="mt-4 inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
      >
        Buka detail
      </Link>
    </article>
  );
}

export function DashboardManager() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [scheduleSessions, setScheduleSessions] = useState<ScheduleSession[]>(
    [],
  );
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
    const completed = tasks.filter((task) => task.status === "completed").length;
    const inProgress = tasks.filter(
      (task) => task.status === "in_progress",
    ).length;
    const overdue = tasks.filter(
      (task) =>
        getDeadlineState(task.deadline, task.status === "completed") ===
        "overdue",
    ).length;
    const dueToday = tasks.filter(
      (task) =>
        getDeadlineState(task.deadline, task.status === "completed") ===
        "due_today",
    ).length;
    const dueThisWeek = tasks.filter((task) =>
      ["due_today", "due_tomorrow", "due_this_week"].includes(
        getDeadlineState(task.deadline, task.status === "completed"),
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
      helper: "Belum completed dan melewati deadline",
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

      const [tasksResult, coursesResult, scheduleResult] = await Promise.all([
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
      setScheduleSessions((scheduleResult.data ?? []) as ScheduleSession[]);
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
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Ringkasan akademik</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Pantau tugas, deadline, progress, dan jadwal dari data Supabase
            milik akun yang sedang login.
          </p>
        </div>

        <div className="rounded-lg border bg-card px-4 py-3 shadow-soft">
          <p className="text-sm text-muted-foreground">Overall progress</p>
          <div className="mt-3 flex items-center gap-3">
            <ProgressBar value={metrics.overallProgress} className="w-44" />
            <span className="text-sm font-semibold">
              {metrics.overallProgress}%
            </span>
          </div>
        </div>
      </section>

      {error ? (
        <div className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          <button
            onClick={() => void loadDashboard()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-rose-200 bg-white px-3 font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950"
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

      <section className="rounded-lg border bg-card p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold">Jadwal Hari Ini</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {todayInfo.label}, diurutkan berdasarkan jam mulai.
            </p>
          </div>
          <Link
            href="/schedule"
            className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
          >
            Kelola jadwal
          </Link>
        </div>

        {todaySchedule.length === 0 ? (
          <div className="mt-5 rounded-lg border border-dashed p-6 text-center">
            <CalendarClock className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 font-medium">
              Tidak ada jadwal kuliah hari ini.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {todaySchedule.map((session) => {
              const course = courseById.get(session.course_id);

              return (
                <article
                  key={session.id}
                  className="rounded-lg border bg-background p-4 transition hover:bg-muted/50"
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
                        <p className="truncate text-sm font-semibold">
                          {course?.name ?? "Mata kuliah terhapus"}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {course?.lecturer_name ?? "Dosen belum diisi"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-semibold">
                      {formatTime(session.start_time)}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Clock3 className="h-4 w-4" />
                      {formatTime(session.start_time)} -{" "}
                      {formatTime(session.end_time)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
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
        <section className="rounded-lg border border-dashed bg-card p-8 text-center shadow-soft">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
            <ListChecks className="h-6 w-6 text-primary" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Belum ada tugas</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Buat mata kuliah dan tugas pertama agar dashboard mulai menampilkan
            progress, deadline, dan prioritas.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Link
              href="/courses"
              className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
            >
              Kelola mata kuliah
            </Link>
            <Link
              href="/tasks"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Tambah tugas
            </Link>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-lg border bg-card p-5 shadow-soft">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-semibold">Upcoming deadlines</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tugas aktif terdekat berdasarkan deadline.
                </p>
              </div>
              <Link
                href="/tasks"
                className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
              >
                Lihat semua
              </Link>
            </div>

            {upcomingTasks.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed p-6 text-center">
                <p className="font-medium">Tidak ada deadline aktif</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Semua tugas sudah selesai atau belum ada tugas aktif.
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

          <article className="rounded-lg border bg-card p-5 shadow-soft">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-semibold">Recent tasks</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tugas yang terakhir diperbarui.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {recentTasks.map((task) => {
                const course = courseById.get(task.course_id);

                return (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="block rounded-lg border bg-background p-4 transition hover:bg-muted/50"
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
                        <p className="mt-2 truncate text-sm font-semibold">
                          {task.title}
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
                );
              })}
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
