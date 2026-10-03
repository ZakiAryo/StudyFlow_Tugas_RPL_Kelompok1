"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
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
    setEditingTask(null);
    setForm({
      ...emptyForm,
      course_id: courses[0]?.id || "",
    });
    setError(null);
  }

  function startEdit(task: Task) {
    setEditingTask(task);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal">Tugas</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Kelola tugas akademik, deadline, priority, status, dan progress.
          </p>
        </div>
        <button
          onClick={resetForm}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Tambah
        </button>
      </div>

      {error ? (
        <div className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          <button
            onClick={() => void loadTasks()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-rose-200 bg-white px-3 font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950"
          >
            <RefreshCw className="h-4 w-4" />
            Coba lagi
          </button>
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <form
          onSubmit={handleSubmit}
          className="h-fit rounded-lg border bg-card p-5 shadow-soft"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{formTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Setiap tugas harus terhubung ke satu mata kuliah.
              </p>
            </div>
            {editingTask ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted"
                aria-label="Batalkan edit"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="mt-5 space-y-4">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Judul tugas</span>
              <input
                required
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
                placeholder="Contoh: Analisis jurnal"
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium">Deskripsi</span>
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="min-h-24 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="Catatan singkat tentang tugas..."
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium">Mata kuliah</span>
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
                className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-70"
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
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium">Deadline</span>
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
                  className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium">Progress</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.progress}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      progress: clamp(Number(event.target.value), 0, 100),
                    }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium">Priority</span>
                <select
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priority: event.target.value as Priority,
                    }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
                >
                  {priorityOptions.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium">Status</span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as TaskStatus,
                    }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
                >
                  {statusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Progress preview</span>
                <span className="text-muted-foreground">{form.progress}%</span>
              </div>
              <ProgressBar value={form.progress} />
            </div>

            {courses.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted px-3 py-2 text-sm text-muted-foreground">
                Tambahkan mata kuliah terlebih dahulu sebelum membuat tugas.
              </p>
            ) : null}

            <button
              disabled={isSaving || courses.length === 0}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {editingTask ? "Simpan perubahan" : "Tambah tugas"}
            </button>
          </div>
        </form>

        <div className="rounded-lg border bg-card p-5 shadow-soft">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
            <div>
              <h2 className="font-semibold">Daftar tugas</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Hanya tugas milik akun yang sedang login yang ditampilkan.
              </p>
            </div>
            <button
              onClick={() => void loadTasks()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted"
              aria-label="Refresh data"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="Cari judul tugas..."
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFilter(option.value)}
                  className={cn(
                    "h-9 rounded-md border px-3 text-sm font-medium transition hover:bg-muted",
                    filter === option.value && "bg-primary text-primary-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="mt-5 space-y-3">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="rounded-lg border p-4">
                  <div className="h-4 w-52 animate-pulse rounded bg-muted" />
                  <div className="mt-3 h-3 w-36 animate-pulse rounded bg-muted" />
                  <div className="mt-5 h-2 w-full animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="mt-5 flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <ClipboardList className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">Belum ada tugas</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Tambahkan tugas pertama untuk mulai melacak deadline dan progress.
              </p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="mt-5 flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <h3 className="font-semibold">Tidak ada tugas yang cocok</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Ubah kata kunci pencarian atau filter untuk melihat tugas lain.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {filteredTasks.map((task) => {
                const course = courseById.get(task.course_id);
                const completed = task.status === "completed";
                const deadlineLabel = getDeadlineLabel(task.deadline, completed);
                const overdue = getDeadlineState(task.deadline, completed) === "overdue";

                return (
                  <article
                    key={task.id}
                    className={cn(
                      "rounded-lg border bg-background p-4",
                      overdue && "border-rose-200 dark:border-rose-900",
                    )}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor: course?.color_label ?? "#64748b",
                            }}
                          />
                          <p className="truncate text-sm text-muted-foreground">
                            {course?.name ?? "Mata kuliah terhapus"}
                          </p>
                        </div>
                        <h3 className="mt-2 font-semibold">{task.title}</h3>
                        {task.description ? (
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                            {task.description}
                          </p>
                        ) : null}
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

                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border text-sm font-medium hover:bg-muted"
                      >
                        <ClipboardList className="h-4 w-4" />
                        Detail
                      </Link>
                      <button
                        onClick={() => startEdit(task)}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border text-sm font-medium hover:bg-muted"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => void handleDelete(task)}
                        disabled={deletingId === task.id}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70 dark:text-rose-300 dark:hover:bg-rose-950"
                      >
                        {deletingId === task.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Hapus
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
