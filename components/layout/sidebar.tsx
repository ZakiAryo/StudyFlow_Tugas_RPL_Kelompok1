
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  BookMarked,
  CalendarDays,
  FileQuestion,
  GraduationCap,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "Mata Kuliah", icon: BookOpen },
  { href: "/tasks", label: "Tugas", icon: GraduationCap },
  { href: "/quiz", label: "Quiz", icon: FileQuestion },
  { href: "/schedule", label: "Jadwal", icon: CalendarDays },
  { href: "/lms", label: "LMS", icon: BookMarked },
  { href: "/ai/priority", label: "AI Priority", icon: Sparkles, ai: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  isOpen,
  isCollapsed,
  onClose,
  onToggleCollapse,
}: {
  isOpen?: boolean;
  isCollapsed?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();

  const renderContent = (collapsed = false) => (
    <aside
      className={cn(
        "relative flex h-full flex-col overflow-hidden border-r bg-card/85 shadow-2xl backdrop-blur-2xl transition-[width] duration-300",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-primary/8 before:via-transparent before:to-violet-500/5",
        collapsed ? "w-20" : "w-72",
      )}
    >
      {/* BRAND / LOGO */}
      <div
        className={cn(
          "relative flex h-20 shrink-0 items-center border-b border-border/70",
          collapsed ? "justify-center px-3" : "gap-3 px-5",
        )}
      >
        <Link
          href="/dashboard"
          onClick={onClose}
          aria-label="StudyFlow Dashboard"
          className="relative flex h-11 w-11 shrink-0 items-center justify-center transition-transform duration-200 hover:scale-105"
        >
          <Image
            src="/logo.png"
            alt="Logo StudyFlow"
            width={44}
            height={44}
            className="h-11 w-11 object-contain"
            priority
          />
        </Link>

        <div className={cn("min-w-0", collapsed && "hidden")}>
          <p className="truncate text-base font-black tracking-tight">
            StudyFlow
          </p>

          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />
            <p className="text-[11px] font-medium text-muted-foreground">
              Academic workspace
            </p>
          </div>
        </div>
      </div>

      <nav className="relative flex-1 space-y-1.5 overflow-y-auto px-3 py-5">
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              "mb-3 hidden items-center rounded-2xl border border-transparent text-xs font-bold text-muted-foreground transition-all duration-300 hover:border-border/70 hover:bg-background/60 hover:text-foreground lg:flex",
              collapsed
                ? "mx-auto h-10 w-10 justify-center px-0"
                : "h-10 w-full gap-3 px-3",
            )}
            aria-label={
              collapsed ? "Perluas sidebar" : "Ciutkan sidebar"
            }
            title={
              collapsed ? "Perluas sidebar" : "Ciutkan sidebar"
            }
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}

            <span className={cn(collapsed && "hidden")}>
              Collapse sidebar
            </span>
          </button>
        ) : null}

        {!collapsed ? (
          <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">
            Workspace
          </p>
        ) : null}

        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              title={item.label}
              className={cn(
                "group relative flex items-center overflow-hidden rounded-2xl py-2.5 text-sm font-bold transition-all duration-300",
                collapsed
                  ? "h-11 justify-center px-0"
                  : "gap-3 px-3",
                active
                  ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15"
                  : "text-muted-foreground hover:-translate-y-0.5 hover:bg-background/70 hover:text-foreground hover:shadow-sm",
              )}
            >
              {active ? (
                <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
              ) : null}

              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300",
                  active
                    ? "bg-primary/15 text-primary"
                    : "bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                )}
              >
                <item.icon className="h-4 w-4" />
              </span>

              <span
                className={cn(
                  "min-w-0 flex-1 truncate",
                  collapsed && "hidden",
                )}
              >
                {item.label}
              </span>

              {!collapsed && item.ai ? (
                <span className="inline-flex items-center gap-1 rounded-lg border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-violet-500">
                  <Sparkles className="h-2.5 w-2.5" />
                  AI
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div
        className={cn(
          "relative border-t border-border/70 p-3",
          collapsed && "hidden",
        )}
      >
        <div className="rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/10 via-background/60 to-violet-500/5 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-black">
                Stay productive ✨
              </p>
              <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                Keep your deadlines under control.
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden min-h-screen lg:fixed lg:inset-y-0 lg:flex">
        {renderContent(isCollapsed)}
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Tutup sidebar"
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <div className="relative h-full w-72 max-w-[85vw]">
            <button
              aria-label="Tutup menu"
              onClick={onClose}
              className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-card/90 shadow-lg backdrop-blur"
            >
              <X className="h-4 w-4" />
            </button>

            {renderContent(false)}
          </div>
        </div>
      ) : null}
    </>
  );
}
