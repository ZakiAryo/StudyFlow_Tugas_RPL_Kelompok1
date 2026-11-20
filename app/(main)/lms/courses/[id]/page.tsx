"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ClipboardList,
  FileText,
  Loader2,
  Plus,
  X,
} from "lucide-react";

type Content = {
  id: string;
  lms_meeting_id: string;
  content_type: string;
  content_name: string;
  content_url: string | null;
  added: boolean;
};

type Meeting = {
  id: string;
  meeting_name: string;
  meeting_url: string | null;
  meeting_date: string | null;
  description: string | null;
  contents: Content[];
};

type Course = {
  id: string;
  course_name: string;
  lecturer_name: string | null;
  class_info: string | null;
  course_url: string | null;
};

const PRIORITY_OPTIONS = [
  { value: "low", label: "Rendah" },
  { value: "medium", label: "Sedang" },
  { value: "high", label: "Tinggi" },
  { value: "urgent", label: "Mendesak" },
];

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function LMSCourseDetailPage() {
  const params = useParams<{ id: string }>();
  const courseId = params?.id;

  const [course, setCourse] = useState<Course | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Dialog "Tambahkan ke Tugas Saya"
  const [selectedTask, setSelectedTask] = useState<Content | null>(null);
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!courseId) return;

    async function loadDetail() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/lms/courses/${courseId}`, {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Gagal mengambil detail mata kuliah."
          );
        }

        setCourse(result.course);
        setMeetings(result.meetings ?? []);
      } catch (err) {
        console.error("Load LMS course detail error:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Gagal mengambil detail mata kuliah."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDetail();
  }, [courseId]);

  function openTaskDialog(content: Content) {
    setSelectedTask(content);
    setDeadline("");
    setPriority("medium");
    setFormError("");
  }

  function markAdded(contentId: string) {
    setMeetings((current) =>
      current.map((meeting) => ({
        ...meeting,
        contents: meeting.contents.map((content) =>
          content.id === contentId ? { ...content, added: true } : content
        ),
      }))
    );
  }

  async function handleAddTask() {
    if (!selectedTask) return;

    if (!deadline) {
      setFormError("Deadline wajib diisi.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const response = await fetch("/api/lms/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lms_content_id: selectedTask.id,
          deadline,
          priority,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // 409 = sudah pernah ditambahkan, tandai saja sebagai sudah ditambahkan
        if (response.status === 409) {
          markAdded(selectedTask.id);
        }

        throw new Error(result.error || "Gagal menambahkan tugas.");
      }

      markAdded(selectedTask.id);
      setMessage(`"${selectedTask.content_name}" ditambahkan ke Tugas Saya.`);
      setSelectedTask(null);
    } catch (err) {
      console.error("Add LMS task error:", err);
      setFormError(
        err instanceof Error ? err.message : "Gagal menambahkan tugas."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-full space-y-6 p-6 lg:p-8">
      <Link
        href="/lms"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke LMS
      </Link>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat mata kuliah...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-300">
          {message}
        </div>
      )}

      {course && (
        <>
          <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/10 via-transparent to-violet-500/10 p-6 lg:p-8">
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
              {course.course_name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {course.lecturer_name || "-"}
            </p>
            {course.class_info && (
              <p className="mt-1 text-xs text-muted-foreground">
                {course.class_info}
              </p>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="font-semibold">
              Pertemuan ({meetings.length})
            </h2>

            {meetings.length === 0 && (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-muted-foreground">
                Belum ada pertemuan untuk mata kuliah ini.
              </div>
            )}

            {meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="rounded-3xl border border-white/10 bg-card/50 p-5"
              >
                <p className="font-semibold">{meeting.meeting_name}</p>

                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(meeting.meeting_date)}
                </p>

                {meeting.description && (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {meeting.description}
                  </p>
                )}

                {meeting.contents.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {meeting.contents.map((content) => {
                      const isTask = content.content_type === "tugas";

                      return (
                        <li
                          key={content.id}
                          className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3"
                        >
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                              isTask
                                ? "bg-amber-400/10 text-amber-400"
                                : "bg-violet-500/10 text-violet-400"
                            }`}
                          >
                            {isTask ? (
                              <ClipboardList className="h-4 w-4" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {content.content_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {isTask ? "Tugas" : "Materi"}
                            </p>
                          </div>

                          {content.content_url?.startsWith("http") && (
                            <a
                              href={content.content_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-emerald-400 hover:underline"
                            >
                              Buka
                            </a>
                          )}

                          {isTask &&
                            (content.added ? (
                              <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-400">
                                <Check className="h-3.5 w-3.5" />
                                Sudah ditambahkan
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openTaskDialog(content)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-semibold text-black transition hover:bg-emerald-300"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Tambahkan ke Tugas Saya
                              </button>
                            ))}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </section>
        </>
      )}

      {/* DIALOG TAMBAH TUGAS */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold">Tambahkan ke Tugas Saya</h2>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {selectedTask.content_name}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="rounded-xl p-2 text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Deadline
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-emerald-400/50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Prioritas
                </label>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm outline-none transition focus:border-emerald-400/50"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formError && (
              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
                {formError}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium transition hover:bg-white/5"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleAddTask}
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
