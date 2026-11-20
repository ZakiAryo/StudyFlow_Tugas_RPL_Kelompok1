"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthForm } from "@/components/auth/auth-form";

const highlights = [
  "Pantau deadline tanpa panik",
  "Susun jadwal kuliah lebih rapi",
  "Fokus pada progres, bukan distraksi",
];

const typewriterText = "what matters.";

export default function LoginPage() {
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting && displayText === typewriterText) {
      timeout = setTimeout(() => {
        setIsDeleting(true);
      }, 2200);
    } else if (isDeleting && displayText === "") {
      timeout = setTimeout(() => {
        setIsDeleting(false);
      }, 600);
    } else {
      const nextLength = isDeleting
        ? displayText.length - 1
        : displayText.length + 1;

      timeout = setTimeout(
        () => {
          setDisplayText(typewriterText.slice(0, nextLength));
        },
        isDeleting ? 55 : 95,
      );
    }

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting]);

  return (
    <main className="relative isolate flex min-h-screen overflow-hidden bg-[#0b1010] text-white">
      {/* BACKGROUND */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        {/* LEFT ORB */}
        <div className="sf-login-orb sf-login-orb-left absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-teal-400/10 blur-[110px]" />

        {/* RIGHT ORB */}
        <div className="sf-login-orb sf-login-orb-right absolute -bottom-48 right-[-5rem] h-[34rem] w-[34rem] rounded-full bg-teal-300/10 blur-[120px]" />

        {/* MOVING GRID */}
        <div className="sf-login-grid" />
      </div>

      <div className="mx-auto grid min-h-screen w-full max-w-[1440px] grid-cols-1 lg:grid-cols-[1.05fr_.95fr]">
        {/* PANEL BRAND DESKTOP */}
        <section className="relative hidden flex-col justify-between px-10 py-10 lg:flex xl:px-16 xl:py-12">
          {/* LOGO ASLI */}
          <Link
            href="/login"
            className="sf-login-logo inline-flex w-fit items-center gap-3"
          >
            <Image
              src="/logo.png"
              alt="Logo StudyFlow"
              width={44}
              height={44}
              className="h-11 w-11 object-contain"
              priority
            />

            <span>
              <span className="block text-lg font-bold tracking-tight">
                StudyFlow
              </span>

              <span className="block text-[10px] font-semibold uppercase tracking-[.24em] text-white/40">
                Academic workspace
              </span>
            </span>
          </Link>

          <div className="max-w-xl pb-10">
            {/* BADGE */}
            <div className="sf-login-reveal sf-login-delay-1 mb-7 mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-white/70 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-[#2dd4bf]" />
              YOUR SPACE, YOUR PACE
            </div>

            {/* HERO */}
            <h1 className="sf-login-reveal sf-login-delay-2 max-w-lg text-5xl font-semibold leading-[1.04] tracking-[-0.055em] xl:text-7xl">
              Make room for

              <span className="mt-2 block min-h-[1.08em] text-[#2dd4bf]">
                {displayText}
                <span
                  aria-hidden="true"
                  className="ml-1 inline-block h-[0.82em] w-[2px] translate-y-[0.06em] animate-pulse rounded-full bg-[#2dd4bf]"
                />
              </span>
            </h1>

            {/* DESCRIPTION */}
            <p className="sf-login-reveal sf-login-delay-3 mt-6 max-w-md text-base leading-7 text-white/55">
              Satu ruang untuk tugas, jadwal, dan progres kuliah.
              Biar kamu bisa fokus belajar tanpa kehilangan arah.
            </p>

            {/* HIGHLIGHTS */}
            <div className="sf-login-reveal sf-login-delay-4 mt-9 space-y-3">
              {highlights.map((item, index) => (
                <div
                  key={item}
                  className="flex items-center gap-3 text-sm text-white/75"
                  style={{
                    animationDelay: `${700 + index * 100}ms`,
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2dd4bf]" />
                  {item}
                </div>
              ))}
            </div>

            {/* MINI DASHBOARD */}
            <div className="sf-login-reveal sf-login-delay-5 relative mt-12 max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-2xl backdrop-blur-xl">
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[#2dd4bf]/10 blur-3xl" />

              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-white/45">
                    YOUR WEEK, IN CONTROL
                  </p>

                  <p className="mt-2 text-xl font-semibold tracking-tight">
                    Small steps. Real progress.
                  </p>
                </div>

                <span className="rounded-xl bg-[#2dd4bf] p-2 text-[#101512]">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>

              <div className="relative mt-5 flex items-end gap-2">
                {[34, 52, 42, 72, 56, 88, 66].map((height, index) => (
                  <div
                    key={index}
                    className="flex-1 rounded-t-md bg-white/[0.09]"
                    style={{ height: `${height}px` }}
                  >
                    <div className="h-full rounded-t-md bg-gradient-to-t from-teal-300/50 to-[#2dd4bf]/90 opacity-90" />
                  </div>
                ))}
              </div>

              <div className="mt-3 flex justify-between text-[10px] uppercase tracking-[.16em] text-white/30">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-white/30">
            © {new Date().getFullYear()} StudyFlow. Built for your next step.
          </p>
        </section>

        {/* FORM LOGIN */}
        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-[440px]">
            {/* BRAND MOBILE */}
            <Link
              href="/login"
              className="sf-login-logo mb-10 inline-flex items-center gap-3 lg:hidden"
            >
              <Image
                src="/logo.png"
                alt="Logo StudyFlow"
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
                priority
              />

              <span>
                <span className="block font-bold tracking-tight">
                  StudyFlow
                </span>

                <span className="block text-[10px] uppercase tracking-[.2em] text-white/40">
                  Academic workspace
                </span>
              </span>
            </Link>

            {/* LOGIN CARD */}
            <div className="sf-login-card rounded-[30px] border border-white/10 bg-[#111818]/90 p-6 shadow-[0_30px_100px_rgba(0,0,0,.35)] backdrop-blur-xl sm:p-9">
              <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-[.22em] text-[#2dd4bf]">
                  WELCOME BACK
                </p>

                <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">
                  Lanjutkan progresmu.
                </h2>

                <p className="mt-3 text-sm leading-6 text-white/50">
                  Masuk ke akunmu dan rapikan langkah belajar berikutnya.
                </p>
              </div>

              <AuthForm mode="login" />

              <div className="my-7 flex items-center gap-4">
                <div className="h-px flex-1 bg-white/10" />

                <span className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/30">
                  STAY ON TRACK
                </span>

                <div className="h-px flex-1 bg-white/10" />
              </div>

              <p className="text-center text-sm text-white/50">
                Belum punya akun?{" "}
                <Link
                  href="/register"
                  className="font-semibold text-[#2dd4bf] transition hover:text-white"
                >
                  Buat akun <span aria-hidden="true">↗</span>
                </Link>
              </p>
            </div>

            <p className="mt-6 text-center text-xs text-white/25">
              Dengan masuk, kamu kembali ke ruang belajarmu.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}