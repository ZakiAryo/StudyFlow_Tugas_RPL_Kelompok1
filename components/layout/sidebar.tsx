"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
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
  { href: "/ai/priority", label: "AI Priority", icon: Sparkles },
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
        "flex h-full flex-col border-r bg-card transition-[width] duration-200",
        collapsed ? "w-20" : "w-72",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b",
          collapsed ? "justify-center px-3" : "gap-3 px-5",
        )}
      >
        <Image
          src="/logo.png"
          alt="Logo StudyFlow AI"
          width={250}
          height={250}
          className={cn(
            "shrink-0 object-contain",
            collapsed ? "h-9 w-9" : "h-11 w-11",
          )}
          priority
        />
        <div className={cn("min-w-0", collapsed && "hidden")}>
          <p className="truncate font-semibold">StudyFlow AI</p>
          <p className="text-xs text-muted-foreground">Academic workspace</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              "hidden items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground lg:flex",
              collapsed ? "mx-auto h-10 w-10 justify-center px-0" : "w-full gap-3",
            )}
            aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
            title={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
            <span className={cn(collapsed && "hidden")}>Collapse</span>
          </button>
        ) : null}

        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              title={item.label}
              className={cn(
                "flex items-center rounded-md py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                collapsed ? "h-10 justify-center px-0" : "gap-3 px-3",
                active && "bg-muted text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className={cn(collapsed && "hidden")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={cn("border-t p-4", collapsed && "hidden")}>
        <div className="rounded-md bg-background p-3">
          <p className="text-sm font-medium">Akun aktif</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Data pribadi akan dibatasi oleh Supabase Auth dan RLS.
          </p>
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
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />
          <div className="relative h-full w-72 max-w-[85vw]">
            <button
              aria-label="Tutup menu"
              onClick={onClose}
              className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md border bg-card"
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
