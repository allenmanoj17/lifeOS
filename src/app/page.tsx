"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  HeartPulse,
  Lock,
} from "lucide-react";
import { formatDateString } from "./trackdaily/db";
import { useTrackDailyContext } from "@/context/TrackDailyContext";

function getDateTimeState() {
  const now = new Date();
  const hour = now.getHours();

  return {
    time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }),
    dateStr: now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }),
    greeting: hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening",
    todayStr: formatDateString(now),
  };
}

export default function LifeOSHub() {
  const [dateTime, setDateTime] = useState(getDateTimeState);
  const { allTasks } = useTrackDailyContext();

  useEffect(() => {
    const interval = setInterval(() => setDateTime(getDateTimeState()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const tasks = allTasks.filter((task) => task.plannedDate === dateTime.todayStr);
  const completed = tasks.filter((task) => task.status === "done" || task.status === "done_late").length;
  const total = tasks.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const nextTask = tasks.find((task) => task.status === "planned");

  return (
    <div className="min-h-screen bg-background font-jakarta text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Epta LifeOS
            </p>
            <h1 className="text-base font-semibold text-slate-950">{dateTime.greeting}</h1>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-950">{dateTime.time}</p>
            <p className="text-xs text-slate-500">{dateTime.dateStr}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5">
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="glass-panel p-4">
            <p className="text-xs font-medium text-slate-500">Today</p>
            <div className="mt-2 flex items-end justify-between">
              <span className="text-2xl font-semibold text-slate-950">{completed}/{total}</span>
              <span className="text-xs font-semibold text-slate-500">{progressPct}% done</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="glass-panel p-4">
            <p className="text-xs font-medium text-slate-500">Next</p>
            <p className="mt-2 truncate text-sm font-semibold text-slate-950">
              {nextTask?.title ?? "No open task"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {nextTask?.plannedTime ? `Planned for ${nextTask.plannedTime}` : "Open TrackDaily to plan the day."}
            </p>
          </div>

          <div className="glass-panel p-4">
            <p className="text-xs font-medium text-slate-500">System</p>
            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-950">
              <span className="h-2 w-2 rounded-full bg-success" />
              Convex and Clerk
            </div>
            <p className="mt-1 text-xs text-slate-500">Primary data path enabled</p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Link href="/trackdaily" className="group glass-panel block p-5 transition-colors hover:border-slate-300">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">TrackDaily</h2>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
                    Plan tasks, close the day, and review completion patterns.
                  </p>
                </div>
              </div>
              <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-900" />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <p className="mt-2 text-xs font-medium text-slate-500">Completed</p>
                <p className="text-lg font-semibold text-slate-950">{completed}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <CalendarDays className="h-4 w-4 text-primary" />
                <p className="mt-2 text-xs font-medium text-slate-500">Planned</p>
                <p className="text-lg font-semibold text-slate-950">{total}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <Activity className="h-4 w-4 text-slate-700" />
                <p className="mt-2 text-xs font-medium text-slate-500">Progress</p>
                <p className="text-lg font-semibold text-slate-950">{progressPct}%</p>
              </div>
            </div>
          </Link>

          <div className="glass-panel p-5">
            <h2 className="text-sm font-semibold text-slate-950">Coming Next</h2>
            <div className="mt-4 flex flex-col gap-3">
              {[
                { icon: BookOpen, name: "MindJournal", desc: "Mood and reflection history" },
                { icon: DollarSign, name: "FinanceFlow", desc: "Budget and spending review" },
                { icon: HeartPulse, name: "HealthSync", desc: "Sleep and wellness tracking" },
              ].map(({ icon: Icon, name, desc }) => (
                <div key={name} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-600">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
                    <p className="truncate text-xs text-slate-500">{desc}</p>
                  </div>
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
