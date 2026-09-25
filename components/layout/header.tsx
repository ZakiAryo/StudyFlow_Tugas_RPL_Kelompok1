"use client";

import { Menu, Search } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/92 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border bg-card lg:hidden"
          aria-label="Buka sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden lg:block">
          <p className="text-sm font-medium">Ruang belajar yang rapi.</p>
          <p className="text-xs text-muted-foreground">
            Pantau deadline, progress, dan jadwal dari satu tempat.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden h-10 min-w-64 items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground md:flex">
          <Search className="h-4 w-4" />
          Cari tugas atau mata kuliah
        </div>
        <LogoutButton />
        <ThemeToggle />
      </div>
    </header>
  );
}
