"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Course = {
  id: string;
  user_id: string;
  name: string;
  lecturer_name: string | null;
  color_label: string;
  created_at: string;
  updated_at: string;
};

type CourseFormState = {
  name: string;
  lecturer_name: string;
  color_label: string;
};

const emptyForm: CourseFormState = {
  name: "",
  lecturer_name: "",
  color_label: "#38bdf8",
};

const colorOptions = [
  "#38bdf8",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#8b5cf6",
  "#14b8a6",
  "#64748b",
  "#ec4899",
];

function courseOrderKey(userId: string) {
  return `studyflow:course-order:${userId}`;
}

function applyStoredOrder(items: Course[], userId: string) {
  try {
    const stored = window.localStorage.getItem(courseOrderKey(userId));
    if (!stored) return items;

    const ids = JSON.parse(stored) as unknown;
    if (!Array.isArray(ids)) return items;

    const positions = new Map(ids.map((id, index) => [String(id), index]));

    return [...items].sort((a, b) => {
      const aPosition = positions.get(a.id);
      const bPosition = positions.get(b.id);

      if (aPosition === undefined && bPosition === undefined) return 0;
      if (aPosition === undefined) return 1;
      if (bPosition === undefined) return -1;
      return aPosition - bPosition;
    });
  } catch {
    return items;
  }
}

export function CourseManager() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState<CourseFormState>(emptyForm);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [draggedCourseId, setDraggedCourseId] = useState<string | null>(null);
  const [dragOverCourseId, setDragOverCourseId] = useState<string | null>(null);

  const formTitle = useMemo(
    () => (editingCourse ? "Edit mata kuliah" : "Tambah mata kuliah"),
    [editingCourse],
  );

  const lecturerCompleteCount = useMemo(
    () => courses.filter((course) => course.lecturer_name?.trim()).length,
    [courses],
  );

  const lecturerCompletion = courses.length
    ? Math.round((lecturerCompleteCount / courses.length) * 100)
    : 0;

  const persistCourseOrder = useCallback(
    (items: Course[]) => {
      if (!userId) return;
      try {
        window.localStorage.setItem(
          courseOrderKey(userId),
          JSON.stringify(items.map((course) => course.id)),
        );
      } catch {
        // Local storage is only a convenience layer; the course data itself stays in Supabase.
      }
    },
    [userId],
  );

  const loadCourses = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      const { data, error: coursesError } = await supabase
        .from("courses")
        .select("id,user_id,name,lecturer_name,color_label,created_at,updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (coursesError) throw coursesError;

      const loadedCourses = (data ?? []) as Course[];
      setCourses(applyStoredOrder(loadedCourses, user.id));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat data mata kuliah.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  function resetForm() {
    setForm(emptyForm);
    setEditingCourse(null);
    setError(null);
  }

  function openCreateForm() {
    resetForm();
    setIsFormOpen(true);
  }

  function closeForm() {
    if (isSaving) return;
    setIsFormOpen(false);
    resetForm();
  }

  function startEdit(course: Course) {
    setEditingCourse(course);
    setIsFormOpen(true);
    setForm({
      name: course.name,
      lecturer_name: course.lecturer_name ?? "",
      color_label: course.color_label,
    });
    setError(null);
  }

  function handleDragStart(event: React.DragEvent<HTMLButtonElement>, courseId: string) {
    setDraggedCourseId(courseId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", courseId);
  }

  function handleDragOver(event: React.DragEvent<HTMLElement>, courseId: string) {
    event.preventDefault();
    if (!draggedCourseId || draggedCourseId === courseId) return;
    event.dataTransfer.dropEffect = "move";
    setDragOverCourseId(courseId);
  }

  function handleDrop(event: React.DragEvent<HTMLElement>, targetCourseId: string) {
    event.preventDefault();

    const sourceCourseId = draggedCourseId || event.dataTransfer.getData("text/plain");
    if (!sourceCourseId || sourceCourseId === targetCourseId) {
      setDraggedCourseId(null);
      setDragOverCourseId(null);
      return;
    }

    setCourses((current) => {
      const sourceIndex = current.findIndex((course) => course.id === sourceCourseId);
      const targetIndex = current.findIndex((course) => course.id === targetCourseId);

      if (sourceIndex < 0 || targetIndex < 0) return current;

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      persistCourseOrder(next);
      return next;
    });

    setDraggedCourseId(null);
    setDragOverCourseId(null);
  }

  function handleDragEnd() {
    setDraggedCourseId(null);
    setDragOverCourseId(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setError("Session tidak ditemukan. Silakan login ulang.");
      router.replace("/login");
      return;
    }

    const trimmedName = form.name.trim();
    const trimmedLecturer = form.lecturer_name.trim();

    if (!trimmedName) {
      setError("Nama mata kuliah wajib diisi.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const payload = {
        name: trimmedName,
        lecturer_name: trimmedLecturer || null,
        color_label: form.color_label,
      };

      if (editingCourse) {
        const { data, error: updateError } = await supabase
          .from("courses")
          .update(payload)
          .eq("id", editingCourse.id)
          .eq("user_id", userId)
          .select("id,user_id,name,lecturer_name,color_label,created_at,updated_at")
          .single();

        if (updateError) throw updateError;

        setCourses((current) =>
          current.map((course) =>
            course.id === editingCourse.id ? (data as Course) : course,
          ),
        );
      } else {
        const { data, error: insertError } = await supabase
          .from("courses")
          .insert({
            user_id: userId,
            ...payload,
          })
          .select("id,user_id,name,lecturer_name,color_label,created_at,updated_at")
          .single();

        if (insertError) throw insertError;

        setCourses((current) => {
          const next = [...current, data as Course];
          persistCourseOrder(next);
          return next;
        });
      }

      resetForm();
      setIsFormOpen(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Gagal menyimpan mata kuliah.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(course: Course) {
    const confirmed = window.confirm(
      `Hapus mata kuliah "${course.name}"? Tindakan ini tidak bisa dibatalkan.`,
    );

    if (!confirmed) return;

    setDeletingId(course.id);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const { error: deleteError } = await supabase
        .from("courses")
        .delete()
        .eq("id", course.id)
        .eq("user_id", course.user_id);

      if (deleteError) throw deleteError;

      setCourses((current) => {
        const next = current.filter((item) => item.id !== course.id);
        persistCourseOrder(next);
        return next;
      });

      if (editingCourse?.id === course.id) {
        resetForm();
        setIsFormOpen(false);
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Gagal menghapus mata kuliah.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="sf-courses-page relative overflow-hidden pb-2">
      <div className="sf-course-ambient sf-course-ambient-one" aria-hidden="true" />
      <div className="sf-course-ambient sf-course-ambient-two" aria-hidden="true" />
      <div className="sf-course-grid" aria-hidden="true" />

      <div className="relative">
        <header className="sf-course-page-header sf-course-stagger mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Your courses</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Mata Kuliah</h1>
              <span className="rounded-full border border-border/80 bg-card/70 px-2 py-1 text-[10px] font-semibold text-muted-foreground backdrop-blur-xl">
                {courses.length} terdaftar
              </span>
            </div>
            <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">
              Kelola nama mata kuliah, dosen, dan warna identitasnya. Susun urutan card sesuai prioritasmu.
            </p>
          </div>

          <button
            onClick={openCreateForm}
            className="sf-course-add-button inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            Tambah Mata Kuliah
          </button>
        </header>

        {error ? (
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-rose-300/50 bg-rose-500/5 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:text-rose-300 sm:flex-row sm:items-center sm:justify-between">
            <p>{error}</p>
            <button
              onClick={() => void loadCourses()}
              className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-500/5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Coba lagi
            </button>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[230px_minmax(0,1fr)] xl:items-start">
          <aside className="sf-course-welcome sf-course-stagger rounded-2xl border border-white/10 bg-card/75 p-4 shadow-2xl shadow-black/10 backdrop-blur-2xl xl:sticky xl:top-5">
            <div className="sf-course-orbit" aria-hidden="true">
              <span className="sf-course-orbit-ring sf-course-orbit-ring-one" />
              <span className="sf-course-orbit-ring sf-course-orbit-ring-two" />
              <span className="sf-course-orbit-dot sf-course-orbit-dot-one" />
              <span className="sf-course-orbit-dot sf-course-orbit-dot-two" />
            </div>

            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.13em] text-primary">
                  <Sparkles className="h-2.5 w-2.5" />
                  Study space
                </span>
                <span className="sf-course-live-dot" aria-label="Live" />
              </div>

              <h2 className="mt-6 text-[24px] font-black leading-[1.05] tracking-tight">
                Halo, Jayy <span className="inline-block sf-wave">👋</span>
              </h2>
              <p className="mt-2.5 text-[10px] leading-[1.55] text-muted-foreground">
                Semua mata kuliahmu, satu ruang. Rapikan semester ini sebelum tugas mulai menumpuk.
              </p>

              <div className="sf-course-semester mt-4 rounded-xl border border-primary/15 bg-primary/[0.07] p-3">
                <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-primary/80">Semester aktif</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold">Genap 2025/2026</p>
                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                </div>
              </div>

              <div className="mt-3 rounded-xl border bg-background/45 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[9px] font-semibold text-muted-foreground">Ringkasan kamu</p>
                    <p className="mt-0.5 text-[10px] font-bold">Semester tetap terkendali</p>
                  </div>
                  <div
                    className="sf-course-progress-ring sf-course-progress-ring-small"
                    style={{ "--progress": `${lecturerCompletion}%` } as React.CSSProperties}
                  >
                    <span>{lecturerCompletion}%</span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/45 p-2.5">
                    <p className="text-[8px] uppercase tracking-wider text-muted-foreground">Mata kuliah</p>
                    <p className="mt-0.5 text-base font-black">{courses.length}</p>
                  </div>
                  <div className="rounded-lg bg-muted/45 p-2.5">
                    <p className="text-[8px] uppercase tracking-wider text-muted-foreground">Dosen</p>
                    <p className="mt-0.5 text-base font-black">{lecturerCompleteCount}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-2 text-[9px] leading-4 text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                  <span>
                    {lecturerCompletion === 100
                      ? "Data mata kuliah sudah lengkap."
                      : "Lengkapi nama dosen untuk merapikan data."}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.025] p-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="h-3.5 w-3.5" />
                </div>
                <p className="text-[9px] leading-4 text-muted-foreground">
                  Drag card untuk menentukan urutan prioritas.
                </p>
              </div>
            </div>
          </aside>

          <main className="min-w-0">
            <section className="sf-course-stagger sf-course-stagger-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Course priority
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Tarik handle <GripVertical className="mx-0.5 inline h-3 w-3" /> untuk menyusun posisi card.
                  </p>
                </div>
                <span className="hidden rounded-full border bg-card/60 px-2 py-1 text-[9px] text-muted-foreground sm:inline-flex">
                  Urutan tersimpan di perangkat ini
                </span>
              </div>

              <div className="grid gap-2.5 md:grid-cols-2">
                {isLoading ? (
                  [1, 2, 3, 4, 5, 6].map((item) => (
                    <div key={item} className="sf-course-skeleton h-[146px] rounded-2xl border bg-card/70" />
                  ))
                ) : courses.length === 0 ? (
                  <div className="md:col-span-2 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed bg-card/60 p-6 text-center backdrop-blur-xl">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <BookOpen className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-3 text-base font-bold">Belum ada mata kuliah</h3>
                    <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
                      Tambahkan mata kuliah pertama untuk mulai mengatur tugas dan jadwal kuliahmu.
                    </p>
                    <button
                      onClick={openCreateForm}
                      className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20"
                    >
                      <Plus className="h-3.5 w-3.5" /> Tambah Mata Kuliah
                    </button>
                  </div>
                ) : (
                  courses.map((course, index) => (
                    <article
                      key={course.id}
                      onDragOver={(event) => handleDragOver(event, course.id)}
                      onDrop={(event) => handleDrop(event, course.id)}
                      className={cn(
                        "sf-course-card group relative overflow-hidden rounded-2xl border bg-card/80 p-3 shadow-sm backdrop-blur-xl",
                        dragOverCourseId === course.id && draggedCourseId !== course.id && "sf-course-drag-over",
                        draggedCourseId === course.id && "sf-course-dragging",
                      )}
                      style={{
                        "--course-color": course.color_label,
                        "--course-delay": `${Math.min(index * 45, 320)}ms`,
                      } as React.CSSProperties}
                    >
                      <div className="sf-course-card-glow" aria-hidden="true" />
                      <div className="sf-course-card-line" aria-hidden="true" />

                      <div className="relative flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <button
                            type="button"
                            draggable
                            onDragStart={(event) => handleDragStart(event, course.id)}
                            onDragEnd={handleDragEnd}
                            className="sf-course-drag-handle mt-0.5 flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded-lg text-muted-foreground/50 transition hover:bg-muted/60 hover:text-primary active:cursor-grabbing"
                            aria-label={`Atur urutan ${course.name}`}
                            title="Tarik untuk mengatur urutan"
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>

                          <div
                            className="sf-course-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                            style={{ backgroundColor: `${course.color_label}18`, color: course.color_label }}
                          >
                            <BookOpen className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 pt-0.5">
                            <h3 className="truncate text-[12px] font-bold leading-4">{course.name}</h3>
                            <p className="mt-0.5 truncate text-[9px] text-muted-foreground">
                              {course.lecturer_name || "Dosen belum diisi"}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 rounded-lg bg-primary/10 px-1.5 py-1 text-[7px] font-bold tracking-wide text-primary">
                          ACTIVE
                        </span>
                      </div>

                      <div className="relative mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border bg-background/50 p-2 transition-colors duration-300 group-hover:bg-background/70">
                          <p className="text-[7px] font-bold uppercase tracking-wider text-muted-foreground">Dosen</p>
                          <p className="mt-0.5 truncate text-[9px] font-semibold">
                            {course.lecturer_name || "Belum diisi"}
                          </p>
                        </div>
                        <div className="rounded-xl border bg-background/50 p-2 transition-colors duration-300 group-hover:bg-background/70">
                          <p className="text-[7px] font-bold uppercase tracking-wider text-muted-foreground">Dibuat</p>
                          <p className="mt-0.5 text-[9px] font-semibold">
                            {new Intl.DateTimeFormat("id-ID", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            }).format(new Date(course.created_at))}
                          </p>
                        </div>
                      </div>

                      <div className="relative mt-2 flex gap-1.5">
                        <button
                          onClick={() => startEdit(course)}
                          className="inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-lg border text-[9px] font-semibold transition-all duration-300 hover:bg-muted/70"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          onClick={() => void handleDelete(course)}
                          disabled={deletingId === course.id}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border text-rose-500 transition-all duration-300 hover:bg-rose-500/10 disabled:opacity-60"
                          aria-label={`Hapus ${course.name}`}
                        >
                          {deletingId === course.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </button>
                        <span className="sf-course-arrow pointer-events-none absolute right-2 top-1.5">
                          <ArrowUpRight className="h-3.5 w-3.5" style={{ color: course.color_label }} />
                        </span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </main>
        </div>
      </div>

      {isFormOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-6"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeForm();
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="course-form-title"
                className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-border/80 bg-card shadow-2xl shadow-black/50 sm:max-h-[calc(100vh-3rem)]"
              >
                <div className="shrink-0 border-b border-border/80 px-5 py-5 sm:px-7 sm:py-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3.5">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
                        style={{
                          backgroundColor: `${form.color_label}14`,
                          borderColor: `${form.color_label}45`,
                          color: form.color_label,
                        }}
                      >
                        <BookOpen className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                          {editingCourse ? "EDIT COURSE" : "CREATE COURSE"}
                        </p>
                        <h2
                          id="course-form-title"
                          className="mt-1 text-xl font-black tracking-tight sm:text-2xl"
                        >
                          {formTitle}
                        </h2>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">
                          {editingCourse
                            ? "Perbarui informasi mata kuliah tanpa mengubah urutan prioritas."
                            : "Tambahkan mata kuliah baru dan lihat preview-nya secara realtime."}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={closeForm}
                      disabled={isSaving}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition hover:bg-muted/70 disabled:opacity-50"
                      aria-label="Tutup"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="min-h-0 flex-1 overflow-y-auto"
                >
                  <div className="grid md:grid-cols-[40%_60%]">
                    <section className="border-b border-border/80 p-5 sm:p-7 md:border-b-0 md:border-r">
                      <div className="mb-5">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                          INFORMASI
                        </p>
                        <p className="mt-1 text-sm font-bold">
                          Detail mata kuliah
                        </p>
                      </div>

                      <div className="space-y-5">
                        <label className="block space-y-2">
                          <span className="flex items-center justify-between text-xs font-bold">
                            Nama Mata Kuliah
                            <span className="text-[9px] font-normal text-muted-foreground">
                              Wajib
                            </span>
                          </span>
                          <input
                            required
                            autoFocus
                            value={form.name}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            className="h-11 w-full rounded-xl border border-border bg-background/70 px-3.5 text-sm outline-none transition-all duration-200 placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
                            placeholder="Contoh: Pemrograman Web"
                          />
                        </label>

                        <label className="block space-y-2">
                          <span className="flex items-center justify-between text-xs font-bold">
                            Nama Dosen
                            <span className="text-[9px] font-normal text-muted-foreground">
                              Opsional
                            </span>
                          </span>
                          <input
                            value={form.lecturer_name}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                lecturer_name: event.target.value,
                              }))
                            }
                            className="h-11 w-full rounded-xl border border-border bg-background/70 px-3.5 text-sm outline-none transition-all duration-200 placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
                            placeholder="Contoh: Dr. Ayu Paramita"
                          />
                        </label>

                        <div className="space-y-2.5">
                          <div>
                            <p className="text-xs font-bold">Identitas Warna</p>
                            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                              Pilih warna untuk membedakan mata kuliah di dashboard.
                            </p>
                          </div>

                          <div className="grid grid-cols-4 gap-2">
                            {colorOptions.map((color) => {
                              const selected = form.color_label === color;

                              return (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() =>
                                    setForm((current) => ({
                                      ...current,
                                      color_label: color,
                                    }))
                                  }
                                  className={cn(
                                    "group relative flex h-10 items-center justify-center rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.03]",
                                    selected
                                      ? "border-transparent ring-2 ring-primary ring-offset-2 ring-offset-card"
                                      : "border-border/70",
                                  )}
                                  style={{ backgroundColor: `${color}18` }}
                                  aria-label={`Pilih warna ${color}`}
                                >
                                  <span
                                    className="h-4 w-4 rounded-full shadow-sm transition-transform duration-200 group-hover:scale-110"
                                    style={{ backgroundColor: color }}
                                  />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="bg-muted/[0.12] p-5 sm:p-7">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary">
                            COURSE PREVIEW
                          </p>
                          <p className="mt-1 text-sm font-bold">
                            Begini tampilannya di dashboard
                          </p>
                        </div>

                        <span className="hidden rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-primary sm:inline-flex">
                          LIVE PREVIEW
                        </span>
                      </div>

                      <div className="mt-6">
                        <div
                          className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-lg transition-all duration-300"
                          style={{
                            boxShadow: `0 18px 45px -28px ${form.color_label}70`,
                          }}
                        >
                          <div
                            className="absolute inset-x-0 top-0 h-0.5 transition-colors duration-300"
                            style={{ backgroundColor: form.color_label }}
                          />

                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <div
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300"
                                style={{
                                  backgroundColor: `${form.color_label}18`,
                                  color: form.color_label,
                                }}
                              >
                                <BookOpen className="h-5 w-5" />
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-black">
                                  {form.name.trim() || "Nama Mata Kuliah"}
                                </p>
                                <p className="mt-1 truncate text-[10px] text-muted-foreground">
                                  {form.lecturer_name.trim() ||
                                    "Nama dosen akan muncul di sini"}
                                </p>
                              </div>
                            </div>

                            <span className="shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-[8px] font-bold tracking-wide text-primary">
                              ACTIVE
                            </span>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-border/70 bg-background/50 p-2.5">
                              <p className="text-[7px] font-bold uppercase tracking-wider text-muted-foreground">
                                DOSEN
                              </p>
                              <p className="mt-1 truncate text-[9px] font-semibold">
                                {form.lecturer_name.trim() || "Belum diisi"}
                              </p>
                            </div>

                            <div className="rounded-xl border border-border/70 bg-background/50 p-2.5">
                              <p className="text-[7px] font-bold uppercase tracking-wider text-muted-foreground">
                                STATUS
                              </p>
                              <p className="mt-1 text-[9px] font-semibold text-primary">
                                Siap disimpan
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <div className="rounded-xl border border-border/70 bg-card/70 p-3">
                            <div
                              className="mb-2 h-1.5 w-8 rounded-full"
                              style={{ backgroundColor: form.color_label }}
                            />
                            <p className="text-[8px] font-semibold text-muted-foreground">
                              Identitas
                            </p>
                            <p className="mt-0.5 text-[9px] font-bold">
                              Custom color
                            </p>
                          </div>

                          <div className="rounded-xl border border-border/70 bg-card/70 p-3">
                            <div className="mb-2 h-1.5 w-8 rounded-full bg-primary/70" />
                            <p className="text-[8px] font-semibold text-muted-foreground">
                              Status
                            </p>
                            <p className="mt-0.5 text-[9px] font-bold">
                              Active
                            </p>
                          </div>

                          <div className="rounded-xl border border-border/70 bg-card/70 p-3">
                            <div className="mb-2 h-1.5 w-8 rounded-full bg-muted-foreground/30" />
                            <p className="text-[8px] font-semibold text-muted-foreground">
                              Layout
                            </p>
                            <p className="mt-0.5 text-[9px] font-bold">
                              Dashboard
                            </p>
                          </div>
                        </div>

                        <p className="mt-5 text-[9px] leading-4 text-muted-foreground">
                          Preview mengikuti nama, dosen, dan warna yang kamu pilih.
                          Tidak ada perubahan yang disimpan sebelum tombol simpan
                          ditekan.
                        </p>
                      </div>
                    </section>
                  </div>

                  {error ? (
                    <div className="mx-5 mt-4 rounded-xl border border-rose-300/50 bg-rose-500/5 p-3 text-xs text-rose-600 dark:text-rose-300 sm:mx-7">
                      {error}
                    </div>
                  ) : null}

                  <div className="flex flex-col-reverse gap-2 border-t border-border/80 bg-card p-5 sm:flex-row sm:justify-end sm:p-6">
                    <button
                      type="button"
                      onClick={closeForm}
                      disabled={isSaving}
                      className="inline-flex h-11 items-center justify-center rounded-xl border px-5 text-sm font-semibold transition hover:bg-muted/70 disabled:opacity-50"
                    >
                      Batal
                    </button>

                    <button
                      disabled={isSaving}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {editingCourse
                        ? "Simpan Perubahan"
                        : "Simpan Mata Kuliah"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
