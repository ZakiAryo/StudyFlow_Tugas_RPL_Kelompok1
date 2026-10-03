"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
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

  const formTitle = useMemo(
    () => (editingCourse ? "Edit mata kuliah" : "Tambah mata kuliah"),
    [editingCourse],
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

      if (userError) {
        throw userError;
      }

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

      if (coursesError) {
        throw coursesError;
      }

      setCourses((data ?? []) as Course[]);
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

  function startEdit(course: Course) {
    setEditingCourse(course);
    setForm({
      name: course.name,
      lecturer_name: course.lecturer_name ?? "",
      color_label: course.color_label,
    });
    setError(null);
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

        if (updateError) {
          throw updateError;
        }

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

        if (insertError) {
          throw insertError;
        }

        setCourses((current) => [data as Course, ...current]);
      }

      resetForm();
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

    if (!confirmed) {
      return;
    }

    setDeletingId(course.id);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const { error: deleteError } = await supabase
        .from("courses")
        .delete()
        .eq("id", course.id)
        .eq("user_id", course.user_id);

      if (deleteError) {
        throw deleteError;
      }

      setCourses((current) => current.filter((item) => item.id !== course.id));

      if (editingCourse?.id === course.id) {
        resetForm();
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
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal">Mata Kuliah</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Kelola daftar mata kuliah, nama dosen, dan label warna milik akunmu.
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
            onClick={() => void loadCourses()}
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
                Data akan disimpan ke tabel `courses`.
              </p>
            </div>
            {editingCourse ? (
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
              <span className="font-medium">Nama mata kuliah</span>
              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
                placeholder="Contoh: Metodologi Riset"
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium">Nama dosen</span>
              <input
                value={form.lecturer_name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    lecturer_name: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
                placeholder="Contoh: Dr. Ayu Paramita"
              />
            </label>

            <div className="space-y-2">
              <p className="text-sm font-medium">Label warna</p>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() =>
                      setForm((current) => ({ ...current, color_label: color }))
                    }
                    className={cn(
                      "h-9 w-9 rounded-md border ring-offset-2 ring-offset-card transition",
                      form.color_label === color && "ring-2 ring-primary",
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Pilih warna ${color}`}
                  />
                ))}
              </div>
            </div>

            <button
              disabled={isSaving}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {editingCourse ? "Simpan perubahan" : "Tambah mata kuliah"}
            </button>
          </div>
        </form>

        <div className="min-h-80 rounded-lg border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Daftar mata kuliah</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Hanya data milik akun yang sedang login yang ditampilkan.
              </p>
            </div>
            <button
              onClick={() => void loadCourses()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted"
              aria-label="Refresh data"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </button>
          </div>

          {isLoading ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="rounded-lg border p-4">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  <div className="mt-3 h-3 w-44 animate-pulse rounded bg-muted" />
                  <div className="mt-5 h-9 w-full animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="mt-5 flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">Belum ada mata kuliah</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Tambahkan mata kuliah pertama untuk mulai menyusun jadwal dan
                tugas akademik.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {courses.map((course) => (
                <article key={course.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className="mt-1 h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: course.color_label }}
                      />
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{course.name}</h3>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {course.lecturer_name || "Nama dosen belum diisi"}
                        </p>
                      </div>
                    </div>
                    <BookOpen className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => startEdit(course)}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md border text-sm font-medium hover:bg-muted"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => void handleDelete(course)}
                      disabled={deletingId === course.id}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md border text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70 dark:text-rose-300 dark:hover:bg-rose-950"
                    >
                      {deletingId === course.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Hapus
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
