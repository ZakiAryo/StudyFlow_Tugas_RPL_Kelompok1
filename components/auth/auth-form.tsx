"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { createSupabaseClient } from "@/lib/supabase";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

        if (loginError) {
          throw loginError;
        }

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
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (registerError) {
        throw registerError;
      }

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

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {mode === "register" ? (
        <label className="space-y-2 text-sm">
          <span className="font-medium">Nama lengkap</span>
          <input
            required
            name="full_name"
            className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
            placeholder="Nama kamu"
          />
        </label>
      ) : null}

      <label className="space-y-2 text-sm">
        <span className="font-medium">Email</span>
        <input
          required
          type="email"
          name="email"
          className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
          placeholder="nama@email.com"
        />
      </label>

      <label className="space-y-2 text-sm">
        <span className="font-medium">Password</span>
        <input
          required
          type="password"
          name="password"
          minLength={6}
          className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
          placeholder="Minimal 6 karakter"
        />
      </label>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          {notice}
        </p>
      ) : null}

      <button
        disabled={isLoading}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {mode === "login" ? "Login" : "Register"}
      </button>
    </form>
  );
}
