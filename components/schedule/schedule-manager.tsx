"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays,
  ChevronDown,
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
  const dayDifference = (dayOrder.get(a.day_of_week) ?? 0) - (dayOrder.get(b.day_of_week) ?? 0);
  if (dayDifference !== 0) return dayDifference;
  return normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time));
}

function TimePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="font-semibold">{label}</span>
      <div className="relative">
        <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
        <input
          type="time"
          lang="id-ID"
          step="60"
          value={normalizeTime(value)}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          aria-label={label}
        />
      </div>
    </label>
  );
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
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayValue>(() => {
    const index = new Date().getDay();
    return dayOptions[index === 0 ? 6 : index - 1].value;
  });

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
    setIsFormOpen(false);
    setEditingSession(null);
    setForm({
      ...emptyForm,
      course_id: courses[0]?.id || "",
    });
    setError(null);
  }

  function startEdit(session: ScheduleSession) {
    setIsFormOpen(true);
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

  function startAddSchedule() {
    setIsFormOpen(true);
    setEditingSession(null);
    setForm({ ...emptyForm, course_id: courses[0]?.id || "" });
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

  const selectedDayData = groupedSessions.find((day) => day.value === selectedDay) ?? groupedSessions[0];
  const todayIndex = new Date().getDay();
  const todayDay = dayOptions[todayIndex === 0 ? 6 : todayIndex - 1].value;

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[2rem] border bg-gradient-to-br from-primary/15 via-card to-violet-500/10 p-6 shadow-sm sm:p-8">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1.5 text-xs font-bold backdrop-blur">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              Weekly schedule
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Jadwal Kuliah</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Semua sesi kuliah kamu dalam satu timeline yang simpel. Pilih hari, cek kelas, lalu gas.
            </p>
          </div>
          <button onClick={startAddSchedule} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5">
            <Plus className="h-4 w-4" /> Tambah Jadwal
          </button>
        </div>
      </section>

      {error ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-300/50 bg-rose-500/5 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:text-rose-300 sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          <button onClick={() => void loadSchedule()} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border bg-background px-3 font-medium">
            <RefreshCw className="h-4 w-4" /> Coba lagi
          </button>
        </div>
      ) : null}

      <section className="rounded-3xl border bg-card/80 p-4 shadow-sm backdrop-blur-xl sm:p-5">
        <div className="flex items-center justify-between gap-3 px-1">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">September 2026</p><p className="mt-1 text-sm text-muted-foreground">Pilih hari untuk melihat jadwal</p></div>
          <button onClick={() => void loadSchedule()} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border hover:bg-muted/70" aria-label="Refresh jadwal">
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2">
          {dayOptions.map((day) => {
            const active = selectedDay === day.value;
            const today = todayDay === day.value;
            return (
              <button key={day.value} onClick={() => setSelectedDay(day.value)} className={cn("group rounded-2xl border px-1 py-3 text-center transition-all hover:-translate-y-0.5 hover:border-primary/30", active ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-background/60 hover:bg-muted/60")}>
                <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70 sm:text-xs">{day.label.slice(0, 3)}</span>
                <span className={cn("mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-xl text-sm font-black", active ? "bg-white/15" : today ? "bg-primary/10 text-primary" : "bg-muted/60")}>{dayOptions.indexOf(day) + 21}</span>
                {today ? <span className={cn("mt-1 block text-[9px] font-bold uppercase", active ? "text-primary-foreground/80" : "text-primary")}>Today</span> : <span className="mt-1 block h-[11px]" />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border bg-card/80 p-5 shadow-sm backdrop-blur-xl sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{selectedDayData?.label}</p>
            <h2 className="mt-1 text-2xl font-black">{selectedDay === todayDay ? "Today's classes" : `Jadwal ${selectedDayData?.label}`}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{selectedDayData?.sessions.length ?? 0} sesi kuliah</p>
        </div>

        {isLoading ? (
          <div className="mt-6 space-y-4">{[1,2].map((item) => <div key={item} className="h-28 animate-pulse rounded-3xl bg-muted" />)}</div>
        ) : !selectedDayData?.sessions.length ? (
          <div className="mt-6 flex min-h-56 flex-col items-center justify-center rounded-3xl border border-dashed bg-background/40 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><CalendarDays className="h-7 w-7" /></div>
            <h3 className="mt-4 font-bold">Hari ini kosong ✨</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">Tidak ada kelas di hari {selectedDayData?.label}. Waktunya catch up tugas atau istirahat.</p>
          </div>
        ) : (
          <div className="relative mt-6 space-y-4">
            <div className="absolute bottom-6 left-[4.25rem] top-6 hidden w-px bg-border sm:block" />
            {selectedDayData.sessions.map((session, index) => {
              const course = courseById.get(session.course_id);
              const now = new Date();
              const [sh, sm] = normalizeTime(session.start_time).split(":").map(Number);
              const [eh, em] = normalizeTime(session.end_time).split(":").map(Number);
              const currentMinutes = now.getHours() * 60 + now.getMinutes();
              const isToday = selectedDay === todayDay;
              const isNow = isToday && currentMinutes >= sh * 60 + sm && currentMinutes < eh * 60 + em;
              return (
                <div key={session.id} className="relative flex gap-4 sm:gap-5">
                  <div className="w-14 shrink-0 pt-4 text-right sm:w-16"><span className="text-sm font-black">{normalizeTime(session.start_time)}</span></div>
                  <div className={cn("relative min-w-0 flex-1 rounded-3xl border p-4 transition-all duration-300 sm:p-5", isNow ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10" : "bg-background/60 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md")}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-1 h-3 w-3 shrink-0 rounded-full ring-4 ring-background" style={{backgroundColor: course?.color_label ?? "#64748b"}} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-black sm:text-lg">{course?.name ?? "Mata kuliah terhapus"}</h3>{isNow ? <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary-foreground">Now</span> : index === 0 && selectedDay === todayDay ? <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-violet-600 dark:text-violet-300">Next</span> : null}</div>
                          <p className="mt-1 text-xs text-muted-foreground">{formatTimeRange(session.start_time, session.end_time)}</p>
                        </div>
                      </div>
                      <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex"><Clock3 className="h-5 w-5" /></div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{session.room || "Ruangan belum diisi"}</span><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />{selectedDayData.label}</span></div>
                    <div className="mt-4 flex gap-2 border-t pt-3"><button onClick={() => startEdit(session)} className="inline-flex h-8 flex-1 items-center justify-center gap-2 rounded-xl border text-xs font-semibold hover:bg-muted/70"><Pencil className="h-3.5 w-3.5" /> Edit</button><button onClick={() => void handleDelete(session)} disabled={deletingId === session.id} className="inline-flex h-8 flex-1 items-center justify-center gap-2 rounded-xl border text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-70 dark:text-rose-300 dark:hover:bg-rose-950">{deletingId === session.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Hapus</button></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border bg-card p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Schedule editor</p><h2 className="mt-1 text-2xl font-black">{formTitle}</h2><p className="mt-1 text-sm text-muted-foreground">Atur kelas, hari, waktu, dan ruangan.</p></div>
              <button type="button" onClick={resetForm} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border hover:bg-muted/70" aria-label="Tutup"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block space-y-2 text-sm"><span className="font-semibold">Mata kuliah</span><select required value={form.course_id} onChange={(event) => setForm((current) => ({...current, course_id: event.target.value}))} disabled={courses.length === 0} className="h-11 w-full rounded-2xl border bg-background px-3 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20">{courses.length === 0 ? <option value="">Belum ada mata kuliah</option> : null}{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
              <label className="block space-y-2 text-sm"><span className="font-semibold">Hari</span><select required value={form.day_of_week} onChange={(event) => setForm((current) => ({...current, day_of_week: event.target.value as DayValue}))} className="h-11 w-full rounded-2xl border bg-background px-3 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20">{dayOptions.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>
              <div className="grid gap-3 sm:grid-cols-2"><TimePicker label="Jam mulai" value={form.start_time} onChange={(value) => setForm((current) => ({ ...current, start_time: value }))} /><TimePicker label="Jam selesai" value={form.end_time} onChange={(value) => setForm((current) => ({ ...current, end_time: value }))} /></div>
              <label className="block space-y-2 text-sm"><span className="font-semibold">Ruangan</span><input value={form.room} onChange={(event) => setForm((current) => ({...current, room: event.target.value}))} placeholder="Contoh: R. 204" className="h-11 w-full rounded-2xl border bg-background px-3 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20" /></label>
              <div className="flex gap-3 pt-2"><button type="button" onClick={resetForm} className="h-11 flex-1 rounded-2xl border text-sm font-bold hover:bg-muted">Batal</button><button disabled={isSaving || courses.length === 0} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{editingSession ? "Simpan perubahan" : "Tambah jadwal"}</button></div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
