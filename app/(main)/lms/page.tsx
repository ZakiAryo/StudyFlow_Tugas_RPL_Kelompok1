"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  Cloud,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";

type LMSConnection = {
  id: string;
  provider: string;
  status: string;
  lms_username: string | null;
  session_expires_at: string | null;
  last_synced_at: string | null;
};

type LMSCourse = {
  id: string;
  course_name: string;
  lecturer_name: string | null;
  class_info: string | null;
  course_url: string | null;
  photo_url: string | null;
  last_synced_at: string | null;
};

export default function LMSPage() {
  const router = useRouter();

  const [connection, setConnection] =
    useState<LMSConnection | null>(null);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] =
    useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [courses, setCourses] = useState<LMSCourse[]>([]);
  const [loadingCourses, setLoadingCourses] =
    useState(false);

  async function loadConnection() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/lms/connection", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Gagal mengambil koneksi LMS."
        );
      }

      setConnection(result.connection ?? null);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil koneksi LMS."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadCourses() {
    try {
      setLoadingCourses(true);

      const response = await fetch("/api/lms/courses", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Gagal mengambil data mata kuliah LMS."
        );
      }

      setCourses(result.courses ?? []);
    } catch (err) {
      console.error("Load LMS courses error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil data mata kuliah LMS."
      );
    } finally {
      setLoadingCourses(false);
    }
  }

  async function handleDisconnect() {
    try {
      setDisconnecting(true);
      setError("");
      setMessage("");

      const response = await fetch(
        "/api/lms/connection",
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Gagal memutus koneksi LMS."
        );
      }

      setConnection(null);
      setCourses([]);
      setMessage("Koneksi LMS berhasil diputus.");
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Gagal memutus koneksi LMS."
      );
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      setError("");
      setMessage("");

      const response = await fetch("/api/lms/sync", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Sync gagal."
        );
      }

      setMessage(
        result.message ||
          "Sinkronisasi LMS berhasil."
      );

      await loadConnection();
      await loadCourses();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat melakukan sync."
      );
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadConnection();
    loadCourses();
  }, []);

  const isConnected =
    connection?.status === "connected";

  const isConnecting =
    connection?.status === "connecting";

  return (
    <main className="min-h-full space-y-6 p-6 lg:p-8">
      {/* HEADER */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/10 via-transparent to-violet-500/10 p-6 lg:p-8">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-emerald-400">
              <BookOpen className="h-4 w-4" />
              LMS INTEGRATION
            </div>

            <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
              LMS UNINDRA
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Hubungkan StudyFlow dengan LMS untuk
              mengakses mata kuliah, pertemuan, materi,
              dan tugas.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {!isConnected && (
              <button
                type="button"
                onClick={() =>
                  router.push("/lms/connect")
                }
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-300"
              >
                <Wifi className="h-4 w-4" />
                Connect LMS
              </button>
            )}

            {isConnected && (
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}

                {syncing
                  ? "Syncing..."
                  : "Sync Sekarang"}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* STATUS */}
      <section className="rounded-3xl border border-white/10 bg-card/60 p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                isConnected
                  ? "bg-emerald-400/10 text-emerald-400"
                  : isConnecting
                    ? "bg-amber-400/10 text-amber-400"
                    : "bg-white/5 text-muted-foreground"
              }`}
            >
              {isConnected ? (
                <Wifi className="h-6 w-6" />
              ) : isConnecting ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <WifiOff className="h-6 w-6" />
              )}
            </div>

            <div>
              <h2 className="font-semibold">
                Koneksi LMS
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                {loading
                  ? "Memeriksa koneksi..."
                  : isConnected
                    ? "LMS terhubung"
                    : isConnecting
                      ? "Koneksi sedang disiapkan"
                      : "LMS belum terhubung"}
              </p>
            </div>
          </div>

          {!loading && (
            <div
              className={`flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                isConnected
                  ? "bg-emerald-400/10 text-emerald-400"
                  : isConnecting
                    ? "bg-amber-400/10 text-amber-400"
                    : "bg-white/5 text-muted-foreground"
              }`}
            >
              {isConnected && (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}

              {isConnected
                ? "CONNECTED"
                : isConnecting
                  ? "CONNECTING"
                  : "DISCONNECTED"}
            </div>
          )}
        </div>

        {connection?.lms_username && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
              <UserRound className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Username LMS
              </p>

              <p className="mt-1 font-medium">
                {connection.lms_username}
              </p>
            </div>
          </div>
        )}

        {connection?.last_synced_at && (
          <div className="mt-4 text-xs text-muted-foreground">
            Terakhir sync:{" "}
            {new Date(
              connection.last_synced_at
            ).toLocaleString("id-ID")}
          </div>
        )}

        {(isConnected || isConnecting) && (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-red-400/20 px-4 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-400/10 disabled:opacity-50"
          >
            {disconnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}

            Putuskan Koneksi
          </button>
        )}
      </section>

      {/* MESSAGE */}
      {message && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-300">
          {message}
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* INFO */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-card/50 p-5">
          <BookOpen className="h-5 w-5 text-emerald-400" />

          <h3 className="mt-4 font-semibold">
            Mata Kuliah
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Data mata kuliah dan dosen dari LMS.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-card/50 p-5">
          <RefreshCw className="h-5 w-5 text-violet-400" />

          <h3 className="mt-4 font-semibold">
            Pertemuan
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Pertemuan dan deskripsi materi akan
            disinkronkan.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-card/50 p-5">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />

          <h3 className="mt-4 font-semibold">
            Materi & Tugas
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Materi dan file tugas dapat ditampilkan
            di StudyFlow.
          </p>
        </div>
      </section>

      {/* COURSES */}
      {courses.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">
            Mata Kuliah ({courses.length})
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <div
                key={course.id}
                className="rounded-3xl border border-white/10 bg-card/50 p-5"
              >
                <Link
                  href={`/lms/courses/${course.id}`}
                  className="font-semibold transition hover:text-emerald-400"
                >
                  {course.course_name}
                </Link>

                <p className="mt-1 text-sm text-muted-foreground">
                  {course.lecturer_name || "-"}
                </p>

                {course.class_info && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {course.class_info}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-4">
                  <Link
                    href={`/lms/courses/${course.id}`}
                    className="text-xs font-medium text-emerald-400 hover:underline"
                  >
                    Lihat Pertemuan →
                  </Link>

                  {course.course_url?.startsWith(
                    "http"
                  ) && (
                    <a
                      href={course.course_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Buka di LMS
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {loadingCourses && courses.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Memuat mata kuliah...
        </p>
      )}

      {/* EMPTY STATE */}
      {!isConnected && courses.length === 0 && (
        <section className="flex min-h-[240px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8">
          <div className="max-w-md text-center">
            <Cloud className="mx-auto h-10 w-10 text-muted-foreground/40" />

            <h2 className="mt-4 font-semibold">
              Belum ada data LMS
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Hubungkan LMS terlebih dahulu sebelum
              melakukan sinkronisasi data.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}