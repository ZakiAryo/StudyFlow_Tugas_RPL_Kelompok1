"use client";

import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { createSupabaseClient } from "@/lib/supabase";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const fullName = String(formData.get("full_name") ?? "").trim();

    try {
      const supabase = createSupabaseClient();

      if (mode === "login") {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (loginError) throw loginError;

        const redirectTo =
          new URLSearchParams(window.location.search).get("redirectTo") ??
          "/dashboard";

        router.replace(redirectTo);
        router.refresh();
        return;
      }

      const { data, error: registerError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (registerError) throw registerError;

      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      setNotice(
        "Registrasi berhasil. Jika konfirmasi email aktif di Supabase, cek inbox kamu sebelum login.",
      );
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "Terjadi kesalahan saat memproses autentikasi.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const inputClass =
    "h-12 w-full rounded-xl border border-white/10 bg-[#0b1111] pl-11 pr-4 text-sm text-white placeholder:text-white/25 outline-none transition duration-300 focus:border-[#c8ff5f]/70 focus:ring-4 focus:ring-[#c8ff5f]/10 focus:shadow-[0_0_28px_rgba(200,255,95,.05)] disabled:opacity-60";

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {mode === "register" ? (
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/75">Nama lengkap</span>
          <input
            required
            name="full_name"
            autoComplete="name"
            className="h-12 w-full rounded-xl border border-white/10 bg-[#0b1111] px-4 text-sm text-white placeholder:text-white/25 outline-none transition duration-300 focus:border-[#c8ff5f]/70 focus:ring-4 focus:ring-[#c8ff5f]/10"
            placeholder="Nama kamu"
          />
        </label>
      ) : null}

      <label className="block space-y-2">
        <span className="text-xs font-semibold text-white/75">Email</span>
        <span className="relative block">
          <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors duration-300 peer-focus:text-[#c8ff5f]" />
          <input
            required
            type="email"
            name="email"
            autoComplete="email"
            className={`peer ${inputClass}`}
            placeholder="nama@email.com"
            disabled={isLoading}
          />
        </span>
      </label>

      <label className="block space-y-2">
        <span className="text-xs font-semibold text-white/75">Password</span>
        <span className="relative block">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            required
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={6}
            className={`peer ${inputClass} pr-12`}
            placeholder={mode === "login" ? "Masukkan password" : "Minimal 6 karakter"}
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/35 transition duration-200 hover:scale-105 hover:bg-white/5 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff5f]"
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </span>
      </label>

      {error ? (
        <p role="alert" className="animate-in fade-in slide-in-from-top-1 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm leading-5 text-rose-200">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="animate-in fade-in slide-in-from-top-1 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm leading-5 text-emerald-200">
          {notice}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isLoading}
        className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c8ff5f] px-4 text-sm font-bold text-[#101512] shadow-[0_8px_30px_rgba(200,255,95,.12)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#d5ff80] hover:shadow-[0_12px_36px_rgba(200,255,95,.2)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {isLoading ? "Memproses..." : mode === "login" ? "Masuk ke StudyFlow" : "Buat akun"}
        {!isLoading ? <span aria-hidden="true" className="ml-1 text-base transition-transform duration-200 group-hover:translate-x-1">↗</span> : null}
      </button>
    </form>
  );
}
