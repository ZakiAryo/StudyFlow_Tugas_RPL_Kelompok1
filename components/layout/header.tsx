"use client";

import { Menu, Search, Sparkles } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-[4.5rem] items-center justify-between gap-3 border-b bg-background/75 px-4 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-card/80 transition hover:bg-muted lg:hidden"
          aria-label="Buka sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden min-w-0 sm:block">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><p className="truncate text-sm font-bold">Your academic workspace</p></div>
          <p className="truncate text-xs text-muted-foreground">Plan less. Focus more. Keep moving.</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden h-10 w-64 items-center gap-2 rounded-xl border bg-card/70 px-3 text-sm text-muted-foreground md:flex">
          <Search className="h-4 w-4" />
          Cari tugas atau mata kuliah
        </div>
        <LogoutButton />
        <ThemeToggle />
      </div>
    </header>
  );
}
