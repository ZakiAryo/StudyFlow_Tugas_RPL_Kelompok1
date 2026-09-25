"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays,
  Clock3,
  Loader2,
  MapPin,
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

type CourseOption = {
  id: string;
  name: string;
  color_label: string;
};

type ScheduleSession = {
  id: string;
  user_id: string;
  course_id: string;
  day_of_week: DayValue;
  start_time: string;
  end_time: string;
  room: string | null;
  created_at: string;
  updated_at: string;
};

type DayValue =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

type ScheduleFormState = {
  course_id: string;
  day_of_week: DayValue;
  start_time: string;
  end_time: string;
  room: string;
};

const dayOptions: { value: DayValue; label: string }[] = [
  { value: "monday", label: "Senin" },
  { value: "tuesday", label: "Selasa" },
  { value: "wednesday", label: "Rabu" },
  { value: "thursday", label: "Kamis" },
  { value: "friday", label: "Jumat" },
  { value: "saturday", label: "Sabtu" },
  { value: "sunday", label: "Minggu" },
];

const dayOrder = new Map(dayOptions.map((day, index) => [day.value, index]));

const emptyForm: ScheduleFormState = {
  course_id: "",
  day_of_week: "monday",
  start_time: "08:00",
  end_time: "09:40",
  room: "",
};

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

function formatTimeRange(startTime: string, endTime: string) {
  return `${normalizeTime(startTime)} - ${normalizeTime(endTime)}`;
}

function sortSessions(a: ScheduleSession, b: ScheduleSession) {
  const dayDiff =
    (dayOrder.get(a.day_of_week) ?? 99) - (dayOrder.get(b.day_of_week) ?? 99);

  if (dayDiff !== 0) {
    return dayDiff;
  }

  return a.start_time.localeCompare(b.start_time);
}

export function ScheduleManager() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [sessions, setSessions] = useState<ScheduleSession[]>([]);
  const [form, setForm] = useState<ScheduleFormState>(emptyForm);
  const [editingSession, setEditingSession] = useState<ScheduleSession | null>(
    null,
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );

  const groupedSessions = useMemo(() => {
    const sortedSessions = [...sessions].sort(sortSessions);

    return dayOptions.map((day) => ({
      ...day,
      sessions: sortedSessions.filter(
        (session) => session.day_of_week === day.value,
      ),
    }));
  }, [sessions]);

  const formTitle = editingSession ? "Edit jadwal kuliah" : "Tambah jadwal kuliah";

  const loadSchedule = useCallback(async () => {
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

      const [coursesResult, sessionsResult] = await Promise.all([
        supabase
          .from("courses")
          .select("id,name,color_label")
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

      if (coursesResult.error) {
        throw coursesResult.error;
      }

      if (sessionsResult.error) {
        throw sessionsResult.error;
      }

      const loadedCourses = (coursesResult.data ?? []) as CourseOption[];
      const loadedSessions = (sessionsResult.data ?? []) as ScheduleSession[];

      setCourses(loadedCourses);
      setSessions(loadedSessions.sort(sortSessions));
      setForm((current) => ({
        ...current,
        course_id: current.course_id || loadedCourses[0]?.id || "",
      }));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat jadwal kuliah.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  function resetForm() {
    setEditingSession(null);
    setForm({
      ...emptyForm,
      course_id: courses[0]?.id || "",
    });
    setError(null);
  }

  function startEdit(session: ScheduleSession) {
    setEditingSession(session);
    setForm({
      course_id: session.course_id,
      day_of_week: session.day_of_week,
      start_time: normalizeTime(session.start_time),
      end_time: normalizeTime(session.end_time),
      room: session.room ?? "",
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

    if (!form.course_id) {
      setError("Pilih mata kuliah terlebih dahulu.");
      return;
    }

    if (!courseById.has(form.course_id)) {
      setError("Mata kuliah tidak valid untuk akun ini.");
      return;
    }

    if (form.end_time <= form.start_time) {
      setError("Jam selesai harus lebih besar dari jam mulai.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const payload = {
        course_id: form.course_id,
        day_of_week: form.day_of_week,
        start_time: form.start_time,
        end_time: form.end_time,
        room: form.room.trim() || null,
      };

      if (editingSession) {
        const { data, error: updateError } = await supabase
          .from("schedule_sessions")
          .update(payload)
          .eq("id", editingSession.id)
          .eq("user_id", userId)
          .select(
            "id,user_id,course_id,day_of_week,start_time,end_time,room,created_at,updated_at",
          )
          .single();

        if (updateError) {
          throw updateError;
        }

        setSessions((current) =>
          current
            .map((session) =>
              session.id === editingSession.id
                ? (data as ScheduleSession)
                : session,
            )
            .sort(sortSessions),
        );
      } else {
        const { data, error: insertError } = await supabase
          .from("schedule_sessions")
          .insert({
            user_id: userId,
            ...payload,
          })
          .select(
            "id,user_id,course_id,day_of_week,start_time,end_time,room,created_at,updated_at",
          )
          .single();

        if (insertError) {
          throw insertError;
        }

        setSessions((current) =>
          [data as ScheduleSession, ...current].sort(sortSessions),
        );
      }

      resetForm();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Gagal menyimpan jadwal kuliah.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(session: ScheduleSession) {
    const course = courseById.get(session.course_id);
    const confirmed = window.confirm(
      `Hapus jadwal ${course?.name ?? "mata kuliah"} pada ${dayOptions.find((day) => day.value === session.day_of_week)?.label}?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(session.id);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const { error: deleteError } = await supabase
        .from("schedule_sessions")
        .delete()
        .eq("id", session.id)
        .eq("user_id", session.user_id);

      if (deleteError) {
        throw deleteError;
      }

      setSessions((current) => current.filter((item) => item.id !== session.id));

      if (editingSession?.id === session.id) {
        resetForm();
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Gagal menghapus jadwal kuliah.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal">Jadwal Kuliah</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Input jadwal kuliah secara manual dan lihat sesi mingguan per hari.
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
            onClick={() => void loadSchedule()}
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
                Jadwal diinput manual oleh user.
              </p>
            </div>
            {editingSession ? (
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

            <label className="space-y-2 text-sm">
              <span className="font-medium">Hari</span>
              <select
                required
                value={form.day_of_week}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    day_of_week: event.target.value as DayValue,
                  }))
                }
                className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
              >
                {dayOptions.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium">Jam mulai</span>
                <input
                  required
                  type="time"
                  value={form.start_time}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      start_time: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium">Jam selesai</span>
                <input
                  required
                  type="time"
                  value={form.end_time}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      end_time: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            </div>

            <label className="space-y-2 text-sm">
              <span className="font-medium">Ruangan</span>
              <input
                value={form.room}
                onChange={(event) =>
                  setForm((current) => ({ ...current, room: event.target.value }))
                }
                className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
                placeholder="Contoh: R. 204"
              />
            </label>

            {courses.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted px-3 py-2 text-sm text-muted-foreground">
                Tambahkan mata kuliah terlebih dahulu sebelum membuat jadwal.
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
              {editingSession ? "Simpan perubahan" : "Tambah jadwal"}
            </button>
          </div>
        </form>

        <div className="rounded-lg border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Jadwal mingguan</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Diurutkan berdasarkan hari dan jam mulai.
              </p>
            </div>
            <button
              onClick={() => void loadSchedule()}
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
                  <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                  <div className="mt-4 space-y-3">
                    <div className="h-20 animate-pulse rounded-md bg-muted" />
                    <div className="h-20 animate-pulse rounded-md bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="mt-5 flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <CalendarDays className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">Belum ada jadwal kuliah</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Buat jadwal manual untuk melihat sesi kuliah tersusun per hari.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {groupedSessions.map((day) => (
                <section key={day.value} className="rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">{day.label}</h3>
                  </div>

                  <div className="mt-4 space-y-3">
                    {day.sessions.length > 0 ? (
                      day.sessions.map((session) => {
                        const course = courseById.get(session.course_id);

                        return (
                          <article
                            key={session.id}
                            className="rounded-md border bg-background p-3"
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
                                  <p className="truncate font-medium">
                                    {course?.name ?? "Mata kuliah terhapus"}
                                  </p>
                                </div>
                                <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                                  <Clock3 className="h-3.5 w-3.5" />
                                  {formatTimeRange(
                                    session.start_time,
                                    session.end_time,
                                  )}
                                </p>
                                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {session.room || "Ruangan belum diisi"}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={() => startEdit(session)}
                                className="inline-flex h-8 flex-1 items-center justify-center gap-2 rounded-md border text-xs font-medium hover:bg-muted"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={() => void handleDelete(session)}
                                disabled={deletingId === session.id}
                                className="inline-flex h-8 flex-1 items-center justify-center gap-2 rounded-md border text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70 dark:text-rose-300 dark:hover:bg-rose-950"
                              >
                                {deletingId === session.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                Hapus
                              </button>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                        Tidak ada sesi.
                      </p>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
