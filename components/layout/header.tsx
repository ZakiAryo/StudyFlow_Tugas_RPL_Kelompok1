"use client";

import { Menu, Search } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-[4.5rem] items-center justify-between gap-3 border-b border-border/60 bg-background/75 px-4 backdrop-blur-2xl md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-card/80 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:text-primary lg:hidden"
          aria-label="Buka sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden min-w-0 lg:block">
          <p className="text-sm font-black tracking-tight">Ruang belajar kamu.</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">Pantau deadline, progress, dan jadwal dari satu tempat.</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden h-10 min-w-64 items-center gap-2 rounded-2xl border border-border/70 bg-card/70 px-3 text-sm text-muted-foreground shadow-sm backdrop-blur transition hover:border-primary/30 md:flex">
          <Search className="h-4 w-4 text-primary" />
          <span>Cari tugas atau mata kuliah</span>
          <span className="ml-auto rounded-lg border bg-background/70 px-1.5 py-0.5 text-[10px] font-bold">⌘ K</span>
        </div>
        <div className="rounded-xl border bg-card/70 p-0.5 shadow-sm">
          <ThemeToggle />
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
