"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, CalendarRange, RefreshCcw, Sparkles } from "lucide-react";
import { useTrackDailyContext } from "@/context/TrackDailyContext";
import { formatDateString } from "../db";
import { CalendarEvent, Task } from "../types";
import Link from "next/link";

function eventTimeLabel(event: CalendarEvent) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (event.isAllDay) return "All day";
  return `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function eventOverlapsHour(event: CalendarEvent, dateStr: string, hour: number) {
  const slotStart = new Date(`${dateStr}T${hour.toString().padStart(2, "0")}:00:00`);
  const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
  return new Date(event.start) < slotEnd && new Date(event.end) > slotStart;
}

function taskConflicts(task: Task, events: CalendarEvent[]) {
  if (!task.plannedTime) return false;
  const taskTime = new Date(`${task.plannedDate}T${task.plannedTime}:00`);
  return events.some((event) => new Date(event.start) <= taskTime && taskTime < new Date(event.end));
}

export default function CalendarPage() {
  const { allTasks, calendarEvents, calendarState } = useTrackDailyContext();
  const [selectedDate, setSelectedDate] = useState(() => formatDateString(new Date()));
  const weekDays = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const mondayDate = new Date(today);
    mondayDate.setDate(today.getDate() + distanceToMonday);

    return Array.from({ length: 7 }, (_, index) => {
      const d = new Date(mondayDate);
      d.setDate(mondayDate.getDate() + index);
      return {
        dateStr: formatDateString(d),
        dayName: d.toLocaleDateString([], { weekday: "short" }).slice(0, 3),
        dayNum: d.getDate(),
      };
    });
  }, []);

  const activeEvents = calendarEvents.filter((event) => event.start.slice(0, 10) === selectedDate);
  const activeTasks = allTasks.filter((task) => task.plannedDate === selectedDate && task.plannedTime);
  const hours = Array.from({ length: 18 }, (_, i) => i + 6);

  const statusCopy = {
    not_connected: "Connect Google Calendar in Settings to replace mock events with real busy blocks.",
    connecting: "Google Calendar authorization is in progress.",
    synced: calendarState.lastSyncedAt
      ? `Last synced ${new Date(calendarState.lastSyncedAt).toLocaleString()}.`
      : "Google Calendar is synced.",
    failed: calendarState.error || "Google Calendar sync failed. Retry from Settings.",
    permission_missing: "Calendar read-only permission is missing. Reconnect from Settings.",
  }[calendarState.status];

  return (
    <div className="flex flex-col gap-6 px-1 text-foreground animate-slide-up">
      <div className="glass-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CalendarRange className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest">Calendar sync</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{statusCopy}</p>
          </div>
        </div>
        <Link href="/trackdaily/settings" className="btn-secondary justify-center">
          <RefreshCcw className="h-4 w-4" />
          <span>{calendarState.status === "synced" ? "Resync" : "Connect"}</span>
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {weekDays.map(({ dateStr, dayName, dayNum }) => {
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === formatDateString(new Date());

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-lg border py-2.5 transition-colors ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <span className="text-[8px] font-bold uppercase tracking-widest">{dayName}</span>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs ${
                  isToday && !isSelected ? "border border-primary/30 bg-primary/10 text-primary" : ""
                }`}
              >
                {dayNum}
              </span>
            </button>
          );
        })}
      </div>

      <div className="glass-panel flex flex-col gap-4 overflow-hidden p-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Daily timeline
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">06:00 - 23:00</span>
        </div>

        <div className="flex max-h-[520px] flex-col gap-3 overflow-y-auto pr-1">
          {hours.map((hour) => {
            const slotTasks = activeTasks.filter((task) => Number(task.plannedTime?.split(":")[0]) === hour);
            const slotEvents = activeEvents.filter((event) => eventOverlapsHour(event, selectedDate, hour));
            const hasData = slotTasks.length > 0 || slotEvents.length > 0;

            return (
              <div key={hour} className="flex min-h-12 items-start gap-3">
                <span className="mt-1 w-10 text-right font-mono text-[10px] font-bold text-muted-foreground">
                  {hour.toString().padStart(2, "0")}:00
                </span>
                <div
                  className={`flex flex-1 flex-col gap-2 rounded-lg border p-2 ${
                    hasData ? "border-border bg-white" : "border-dashed border-border bg-transparent"
                  }`}
                >
                  {slotEvents.map((event) => (
                    <div key={event.id} className="relative overflow-hidden rounded-lg border border-primary/20 bg-primary/10 p-2.5 pl-4">
                      <div className="absolute bottom-0 left-0 top-0 w-1 bg-primary" />
                      <p className="truncate text-xs font-semibold text-primary">{event.title}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{eventTimeLabel(event)}</p>
                    </div>
                  ))}

                  {slotTasks.map((task) => {
                    const conflict = taskConflicts(task, activeEvents);
                    const done = task.status === "done" || task.status === "done_late";
                    return (
                      <div
                        key={task.id}
                        className={`relative overflow-hidden rounded-lg border p-2.5 pl-4 ${
                          conflict
                            ? "border-destructive/35 bg-destructive/10"
                            : done
                              ? "border-success/25 bg-success/10 opacity-75"
                              : "border-primary/15 bg-primary/5"
                        }`}
                      >
                        <div className={`absolute bottom-0 left-0 top-0 w-1 ${conflict ? "bg-destructive" : done ? "bg-success" : "bg-primary"}`} />
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className={`truncate text-xs font-semibold ${done ? "text-muted-foreground line-through" : ""}`}>{task.title}</p>
                            <p className="mt-1 text-[10px] text-muted-foreground">Scheduled: {task.plannedTime}</p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {conflict && (
                              <span className="badge-destructive">
                                <AlertTriangle className="h-3 w-3" />
                                Overlap
                              </span>
                            )}
                            <span className={done ? "badge-success" : "badge-primary"}>{task.category}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {!hasData && <span className="py-1 pl-1 font-mono text-[10px] text-muted-foreground/60">Empty slot</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

