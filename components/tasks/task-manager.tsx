
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { DeadlineBadge } from "@/components/tasks/deadline-badge";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { StatusBadge } from "@/components/tasks/status-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getDeadlineLabel, getDeadlineState } from "@/lib/deadline";
import { createSupabaseClient } from "@/lib/supabase";
import { clamp, cn } from "@/lib/utils";

type Priority = "low" | "medium" | "high" | "urgent";
type TaskStatus = "not_started" | "in_progress" | "revision" | "completed";
type TaskFilter = "all" | "today" | "this_week" | "overdue" | "completed";

type CourseOption = {
  id: string;
  name: string;
  color_label: string;
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

type TaskFormState = {
  title: string;
  description: string;
  course_id: string;
  deadline: string;
  priority: Priority;
  status: TaskStatus;
  progress: number;
};

const filterOptions: { value: TaskFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
];

const priorityOptions: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "revision", label: "Revision" },
  { value: "completed", label: "Completed" },
];

const emptyForm: TaskFormState = {
  title: "",
  description: "",
  course_id: "",
  deadline: new Date().toISOString().slice(0, 10),
  priority: "medium",
  status: "not_started",
  progress: 0,
};

function sortTasks(a: Task, b: Task) {
  const deadlineDiff = a.deadline.localeCompare(b.deadline);

  if (deadlineDiff !== 0) {
    return deadlineDiff;
  }

  return b.created_at.localeCompare(a.created_at);
}

function matchesFilter(task: Task, filter: TaskFilter) {
  const completed = task.status === "completed";
  const state = getDeadlineState(task.deadline, completed);

  if (filter === "all") {
    return true;
  }

  if (filter === "completed") {
    return completed;
  }

  if (filter === "today") {
    return state === "due_today";
  }

  if (filter === "this_week") {
    return ["due_today", "due_tomorrow", "due_this_week"].includes(state);
  }

  return state === "overdue";
}

export function TaskManager() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState<TaskFormState>(emptyForm);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks
      .filter((task) => matchesFilter(task, filter))
      .filter((task) => task.title.toLowerCase().includes(query))
      .sort(sortTasks);
  }, [filter, search, tasks]);

  const formTitle = editingTask ? "Edit tugas" : "Tambah tugas";

  const loadTasks = useCallback(async () => {
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

      setUserId(user.id);

      const [coursesResult, tasksResult] = await Promise.all([
        supabase
          .from("courses")
          .select("id,name,color_label")
          .eq("user_id", user.id)
          .order("name", { ascending: true }),
        supabase
          .from("tasks")
          .select(
            "id,user_id,course_id,title,description,deadline,priority,status,progress,created_at,updated_at",
          )
          .eq("user_id", user.id)
          .order("deadline", { ascending: true }),
      ]);

      if (coursesResult.error) {
        throw coursesResult.error;
      }

      if (tasksResult.error) {
        throw tasksResult.error;
      }

      const loadedCourses = (coursesResult.data ?? []) as CourseOption[];
      const loadedTasks = (tasksResult.data ?? []) as Task[];

      setCourses(loadedCourses);
      setTasks(loadedTasks.sort(sortTasks));
      setForm((current) => ({
        ...current,
        course_id: current.course_id || loadedCourses[0]?.id || "",
      }));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Gagal memuat tugas.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  function resetForm() {
    setIsFormOpen(false);
    setEditingTask(null);
    setForm({
      ...emptyForm,
      course_id: courses[0]?.id || "",
    });
    setError(null);
  }

  function startCreate() {
    setEditingTask(null);
    setForm({
      ...emptyForm,
      course_id: courses[0]?.id || "",
    });
    setError(null);
    setIsFormOpen(true);
  }

  function startEdit(task: Task) {
    setEditingTask(task);
    setIsFormOpen(true);
    setForm({
      title: task.title,
      description: task.description ?? "",
      course_id: task.course_id,
      deadline: task.deadline,
      priority: task.priority,
      status: task.status,
      progress: task.progress,
    });
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setError("Session tidak ditemukan. Silakan login ulang.");
      router.replace("/login");
      return;
    }

    const title = form.title.trim();
    const description = form.description.trim();
    const progress = clamp(Number(form.progress), 0, 100);

    if (!title) {
      setError("Judul tugas wajib diisi.");
      return;
    }

    if (!form.course_id || !courseById.has(form.course_id)) {
      setError("Pilih mata kuliah yang valid untuk akun ini.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const payload = {
        title,
        description: description || null,
        course_id: form.course_id,
        deadline: form.deadline,
        priority: form.priority,
        status: form.status,
        progress,
      };

      if (editingTask) {
        const { data, error: updateError } = await supabase
          .from("tasks")
          .update(payload)
          .eq("id", editingTask.id)
          .eq("user_id", userId)
          .select(
            "id,user_id,course_id,title,description,deadline,priority,status,progress,created_at,updated_at",
          )
          .single();

        if (updateError) {
          throw updateError;
        }

        setTasks((current) =>
          current
            .map((task) => (task.id === editingTask.id ? (data as Task) : task))
            .sort(sortTasks),
        );
      } else {
        const { data, error: insertError } = await supabase
          .from("tasks")
          .insert({
            user_id: userId,
            ...payload,
          })
          .select(
            "id,user_id,course_id,title,description,deadline,priority,status,progress,created_at,updated_at",
          )
          .single();

        if (insertError) {
          throw insertError;
        }

        setTasks((current) => [data as Task, ...current].sort(sortTasks));
      }

      resetForm();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Gagal menyimpan tugas.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(task: Task) {
    const confirmed = window.confirm(
      `Hapus tugas "${task.title}"? Tindakan ini tidak bisa dibatalkan.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(task.id);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const { error: deleteError } = await supabase
        .from("tasks")
        .delete()
        .eq("id", task.id)
        .eq("user_id", task.user_id);

      if (deleteError) {
        throw deleteError;
      }

      setTasks((current) => current.filter((item) => item.id !== task.id));

      if (editingTask?.id === task.id) {
        resetForm();
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Gagal menghapus tugas.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const activeTasks = tasks.filter((task) => task.status !== "completed");
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const overdueTasks = tasks.filter(
    (task) => getDeadlineState(task.deadline, task.status === "completed") === "overdue",
  );
  const dueTodayTasks = tasks.filter(
    (task) => getDeadlineState(task.deadline, task.status === "completed") === "due_today",
  );
  const averageProgress = tasks.length
    ? Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length)
    : 0;
  const focusTask = [...activeTasks].sort((a, b) => {
    const priorityRank: Record<Priority, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
    return priorityDiff !== 0 ? priorityDiff : sortTasks(a, b);
  })[0] ?? null;

  function formatDeadline(date: string) {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${date}T00:00:00`));
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border bg-card/80 p-6 shadow-sm backdrop-blur-xl sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary">
              <Target className="h-3.5 w-3.5" />
              Your workload
            </div>

            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              Tugas.
            </h1>

            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Keep your workload under control. Fokus ke yang paling penting,
              selesaikan satu per satu.
            </p>
          </div>

          <button
            type="button"
            onClick={startCreate}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <Plus className="h-4 w-4" />
            Tambah Tugas
          </button>
        </div>
      </section>

      {error && !isFormOpen ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          <button
            onClick={() => void loadTasks()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 font-medium dark:border-rose-900 dark:bg-rose-950"
          >
            <RefreshCw className="h-4 w-4" />
            Coba lagi
          </button>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Semua tugas",
            value: tasks.length,
            icon: ClipboardList,
            note: "total workload",
          },
          {
            label: "Hari ini",
            value: dueTodayTasks.length,
            icon: Clock3,
            note: "perlu perhatian",
          },
          {
            label: "Overdue",
            value: overdueTasks.length,
            icon: AlertTriangle,
            note: "segera dibereskan",
          },
          {
            label: "Completion",
            value: `${averageProgress}%`,
            icon: CheckCircle2,
            note: `${completedTasks.length} selesai`,
          },
        ].map((stat) => (
          <article
            key={stat.label}
            className="group rounded-3xl border bg-card/70 p-5 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:scale-110">
                <stat.icon className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {stat.note}
              </span>
            </div>
            <p className="mt-5 text-3xl font-black tracking-tight">{stat.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
          </article>
        ))}
      </section>

      {focusTask ? (
        <section className="overflow-hidden rounded-[2rem] border bg-gradient-to-br from-primary/10 via-card to-violet-500/10 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                <Target className="h-4 w-4" />
                Focus now
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                Kerjakan ini dulu berdasarkan priority dan deadline.
              </p>

              <div className="mt-4 flex items-start gap-3">
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      courseById.get(focusTask.course_id)?.color_label ?? "#64748b",
                  }}
                />

                <div className="min-w-0">
                  <h2 className="truncate text-xl font-black tracking-tight sm:text-2xl">
                    {focusTask.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {courseById.get(focusTask.course_id)?.name ?? "Mata kuliah"} ·
                    deadline {formatDeadline(focusTask.deadline)}
                  </p>
                </div>
              </div>

              <div className="mt-4 max-w-xl">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                  <span>Progress</span>
                  <span>{focusTask.progress}%</span>
                </div>
                <ProgressBar value={focusTask.progress} />
              </div>
            </div>

            <Link
              href={`/tasks/${focusTask.id}`}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5"
            >
              Buka tugas
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : null}

      <section className="rounded-[2rem] border bg-card/80 p-5 shadow-sm backdrop-blur-xl sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-500">
              Task board
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">
              Your tasks
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cari, filter, lalu pilih tugas yang mau kamu kerjakan.
            </p>
          </div>

          <button
            onClick={() => void loadTasks()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border transition hover:bg-muted"
            aria-label="Refresh data"
          >
            <RefreshCw
              className={cn("h-4 w-4", isLoading && "animate-spin")}
            />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row">
          <label className="relative block flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-2xl border bg-background/70 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Cari tugas..."
            />
          </label>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={cn(
                  "h-11 shrink-0 rounded-2xl border px-4 text-sm font-semibold transition",
                  filter === option.value
                    ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/15"
                    : "hover:bg-muted",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-56 animate-pulse rounded-3xl border bg-muted/40"
              />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="mt-5 flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ClipboardList className="h-7 w-7" />
            </div>
            <h3 className="mt-4 font-bold">Belum ada tugas</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Tambahkan tugas pertama untuk mulai melacak deadline dan progress.
            </p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="mt-5 flex min-h-56 flex-col items-center justify-center rounded-3xl border border-dashed p-8 text-center">
            <Search className="h-7 w-7 text-muted-foreground" />
            <h3 className="mt-3 font-bold">Tidak ada tugas yang cocok</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Coba ubah pencarian atau filter.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredTasks.map((task) => {
              const course = courseById.get(task.course_id);
              const completed = task.status === "completed";
              const deadlineLabel = getDeadlineLabel(task.deadline, completed);
              const overdue =
                getDeadlineState(task.deadline, completed) === "overdue";

              return (
                <article
                  key={task.id}
                  className={cn(
                    "group flex min-h-64 flex-col rounded-3xl border bg-background/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
                    overdue && "border-rose-300/70 dark:border-rose-900",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full ring-4 ring-background"
                        style={{
                          backgroundColor: course?.color_label ?? "#64748b",
                        }}
                      />
                      <p className="truncate text-xs font-semibold text-muted-foreground">
                        {course?.name ?? "Mata kuliah terhapus"}
                      </p>
                    </div>
                    <PriorityBadge priority={task.priority} />
                  </div>

                  <h3 className="mt-4 line-clamp-2 text-lg font-black tracking-tight group-hover:text-primary">
                    {task.title}
                  </h3>

                  {task.description ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">
                      {task.description}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Tidak ada deskripsi.
                    </p>
                  )}

                  <div className="mt-auto pt-5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>Progress</span>
                      <span>{task.progress}%</span>
                    </div>

                    <div className="mt-2">
                      <ProgressBar value={task.progress} />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <DeadlineBadge label={deadlineLabel} />
                      <StatusBadge status={task.status} />
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="col-span-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition hover:bg-muted"
                      >
                        <ClipboardList className="h-3.5 w-3.5" />
                        Detail
                      </Link>

                      <button
                        onClick={() => startEdit(task)}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>

                      <button
                        onClick={() => void handleDelete(task)}
                        disabled={deletingId === task.id}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-950"
                      >
                        {deletingId === task.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Hapus
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* REDESIGNED TASK FORM */}
      {isFormOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-md sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) {
              resetForm();
            }
          }}
        >
          <form
            onSubmit={handleSubmit}
            className="relative my-auto w-full max-w-3xl overflow-hidden rounded-[28px] border border-slate-700/70 bg-[#111827] text-slate-100 shadow-[0_30px_100px_rgba(0,0,0,0.55)]"
          >
            {/* Modal accent */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400" />

            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-700/70 px-5 pb-5 pt-7 sm:px-8">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
                  <Target className="h-3.5 w-3.5" />
                  StudyFlow / Task Manager
                </div>

                <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {formTitle}
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Atur detail dan prioritas tugasmu di sini.
                </p>
              </div>

              <button
                type="button"
                onClick={resetForm}
                disabled={isSaving}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/70 text-slate-400 transition hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-50"
                aria-label="Tutup form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form body */}
            <div className="max-h-[calc(100vh-220px)] space-y-6 overflow-y-auto px-5 py-6 sm:px-8">
              {error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              ) : null}

              {/* Basic information */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-400/10 text-sm font-black text-cyan-300">
                    01
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Informasi tugas
                    </h3>
                    <p className="text-xs text-slate-500">
                      Identitas dan detail pekerjaan
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">
                    Judul tugas <span className="text-rose-400">*</span>
                  </label>
                  <input
                    required
                    maxLength={150}
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    className="h-12 w-full rounded-xl border border-slate-700 bg-[#0b1220] px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                    placeholder="Contoh: Analisis jurnal sistem informasi"
                  />
                  <div className="text-right text-[10px] text-slate-600">
                    {form.title.length}/150
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">
                    Deskripsi
                  </label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className="w-full resize-none rounded-xl border border-slate-700 bg-[#0b1220] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                    placeholder="Jelaskan apa yang perlu dikerjakan..."
                  />
                  <div className="text-right text-[10px] text-slate-600">
                    {form.description.length}/500
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">
                    Mata kuliah <span className="text-rose-400">*</span>
                  </label>
                  <select
                    required
                    value={form.course_id}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        course_id: event.target.value,
                      }))
                    }
                    disabled={courses.length === 0}
                    className="h-12 w-full rounded-xl border border-slate-700 bg-[#0b1220] px-4 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10 disabled:opacity-60"
                  >
                    {courses.length === 0 ? (
                      <option value="">Belum ada mata kuliah</option>
                    ) : null}
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              {/* Schedule and priority */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-400/10 text-sm font-black text-violet-300">
                    02
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Pengaturan tugas
                    </h3>
                    <p className="text-xs text-slate-500">
                      Deadline, prioritas, dan status
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">
                      Deadline <span className="text-rose-400">*</span>
                    </label>
                    <input
                      required
                      type="date"
                      value={form.deadline}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          deadline: event.target.value,
                        }))
                      }
                      className="h-12 w-full rounded-xl border border-slate-700 bg-[#0b1220] px-4 text-sm text-white outline-none transition [color-scheme:dark] focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">
                      Priority
                    </label>
                    <select
                      value={form.priority}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          priority: event.target.value as Priority,
                        }))
                      }
                      className="h-12 w-full rounded-xl border border-slate-700 bg-[#0b1220] px-4 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                    >
                      {priorityOptions.map((priority) => (
                        <option key={priority.value} value={priority.value}>
                          {priority.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">
                    Status pengerjaan
                  </label>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value as TaskStatus,
                        progress:
                          event.target.value === "completed"
                            ? 100
                            : current.progress,
                      }))
                    }
                    className="h-12 w-full rounded-xl border border-slate-700 bg-[#0b1220] px-4 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                  >
                    {statusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              {/* Progress */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/10 text-sm font-black text-emerald-300">
                    03
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Progress pengerjaan
                    </h3>
                    <p className="text-xs text-slate-500">
                      Perbarui perkembangan tugas
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-[#0b1220] p-5">
                  <div className="mb-4 flex items-end justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-400">
                        Current progress
                      </p>
                      <p className="mt-1 text-3xl font-black tracking-tight text-white">
                        {form.progress}
                        <span className="ml-1 text-lg text-cyan-400">%</span>
                      </p>
                    </div>
                    <div className="rounded-xl bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-300">
                      {form.progress === 100
                        ? "Completed"
                        : form.progress >= 70
                          ? "Almost there"
                          : form.progress >= 30
                            ? "In progress"
                            : "Just started"}
                    </div>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={form.progress}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        progress: Number(event.target.value),
                        status:
                          Number(event.target.value) === 100
                            ? "completed"
                            : current.status === "completed"
                              ? "in_progress"
                              : current.status,
                      }))
                    }
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-cyan-400"
                  />

                  <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-500">
                    <span>0% — Belum mulai</span>
                    <span>100% — Selesai</span>
                  </div>
                </div>
              </section>

              {courses.length === 0 ? (
                <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Tambahkan mata kuliah terlebih dahulu sebelum membuat tugas.
                  </p>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-700/70 bg-[#0d1523] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <p className="hidden text-xs text-slate-500 sm:block">
                <span className="text-rose-400">*</span> Wajib diisi
              </p>

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSaving}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-700 px-5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isSaving || courses.length === 0}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 px-6 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:shadow-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isSaving
                    ? "Menyimpan..."
                    : editingTask
                      ? "Simpan perubahan"
                      : "Tambah tugas"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
