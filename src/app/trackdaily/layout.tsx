"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Home,
  Plus,
  Settings,
} from "lucide-react";
import { KeyboardShortcutsHint } from "@/components/KeyboardShortcutsHint";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: "Today", href: "/trackdaily", icon: CheckSquare },
  { label: "Plan", href: "/trackdaily/plan", icon: Plus },
  { label: "Calendar", href: "/trackdaily/calendar", icon: CalendarDays },
  { label: "Analytics", href: "/trackdaily/analytics", icon: BarChart3 },
  { label: "Review", href: "/trackdaily/review", icon: ClipboardCheck },
  { label: "Settings", href: "/trackdaily/settings", icon: Settings },
];

function sectionLabel(pathname: string) {
  if (pathname === "/trackdaily") return "Today";
  if (pathname.startsWith("/trackdaily/plan")) return "Plan";
  if (pathname.startsWith("/trackdaily/calendar")) return "Calendar";
  if (pathname.startsWith("/trackdaily/analytics")) return "Analytics";
  if (pathname.startsWith("/trackdaily/review")) return "Review";
  if (pathname.startsWith("/trackdaily/settings")) return "Settings";
  return "TrackDaily";
}

export default function TrackDailyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/trackdaily") return pathname === "/trackdaily";
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <KeyboardShortcutsHint />

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
              title="Go to Epta LifeOS"
            >
              <Home className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Epta LifeOS
              </p>
              <h1 className="truncate text-sm font-semibold text-slate-950">
                {sectionLabel(pathname)}
              </h1>
            </div>
          </div>

          <div className="hidden items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 lg:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 lg:pb-10">
        {children}
      </main>

      <nav className="fixed bottom-3 left-1/2 z-50 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center justify-between rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1.5 py-2 text-[10px] font-semibold transition-colors ${
                active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
