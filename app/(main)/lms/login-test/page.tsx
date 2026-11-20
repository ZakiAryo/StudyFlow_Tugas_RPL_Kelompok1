"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";

// HALAMAN SEMENTARA UNTUK PENGUJIAN LOGIN LANGSUNG KE LMS.
// Hanya menampilkan diagnosis. Tidak menyimpan apa pun.

export default function LMSLoginTestPage() {
  const [challenge, setChallenge] = useState("");
  const [image, setImage] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [kapca, setKapca] = useState("");

  const [loadingCaptcha, setLoadingCaptcha] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [diagnosis, setDiagnosis] = useState<unknown>(null);

  async function loadCaptcha() {
    try {
      setLoadingCaptcha(true);
      setError("");
      setKapca("");

      const response = await fetch("/api/lms/captcha", { cache: "no-store" });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Gagal mengambil captcha.");
      }

      setChallenge(result.challenge);
      setImage(result.image);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil captcha.");
    } finally {
      setLoadingCaptcha(false);
    }
  }

  useEffect(() => {
    loadCaptcha();
  }, []);

  async function handleSubmit() {
    if (!username || !password || !kapca) {
      setError("Username, password, dan jawaban captcha wajib diisi.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setDiagnosis(null);

      const response = await fetch("/api/lms/login-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge, username, password, kapca }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Pengujian login gagal.");
      }

      setDiagnosis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pengujian login gagal.");
    } finally {
      setSubmitting(false);
      setPassword("");
      // Captcha hanya berlaku sekali, muat yang baru.
      loadCaptcha();
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-5 p-6">
      <Link
        href="/lms"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke LMS
      </Link>

      <div>
        <h1 className="text-xl font-bold">Uji Login LMS (sementara)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Login langsung ke LMS kampus. Hanya menampilkan diagnosis, tidak
          menyimpan apa pun. Coba satu kali saja per percobaan.
        </p>
      </div>

      <div className="space-y-4 rounded-3xl border border-white/10 bg-card/50 p-5">
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Username / NPM"
          autoComplete="off"
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none"
        />

        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          autoComplete="off"
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none"
        />

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt="Captcha"
                className="h-[50px] rounded-lg border border-white/10"
              />
            ) : (
              <div className="flex h-[50px] w-[173px] items-center justify-center rounded-lg border border-white/10 text-xs text-muted-foreground">
                {loadingCaptcha ? "Memuat..." : "Tidak ada gambar"}
              </div>
            )}

            <button
              type="button"
              onClick={loadCaptcha}
              disabled={loadingCaptcha || submitting}
              className="rounded-xl border border-white/10 p-2 transition hover:bg-white/5 disabled:opacity-50"
              title="Muat ulang captcha"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <input
            value={kapca}
            onChange={(event) => setKapca(event.target.value)}
            placeholder="Jawaban captcha"
            autoComplete="off"
            inputMode="numeric"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none"
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || loadingCaptcha || !challenge}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Menguji..." : "Uji Login"}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {diagnosis !== null && (
        <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-4 text-xs">
          {JSON.stringify(diagnosis, null, 2)}
        </pre>
      )}
    </main>
  );
}
