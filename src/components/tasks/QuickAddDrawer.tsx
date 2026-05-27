"use client";

import React, { useState } from "react";
import { Calendar, Clock, Plus, Repeat, X } from "lucide-react";
import { formatDateString, getCategories } from "@/app/trackdaily/db";
import { RecurringRule } from "@/app/trackdaily/types";
import { useToast } from "@/components/Toast";
import { useTrackDailyContext } from "@/context/TrackDailyContext";

interface QuickAddDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskAdded: () => void;
  prefilledDate?: string;
}

export default function QuickAddDrawer({
  isOpen,
  onClose,
  onTaskAdded,
  prefilledDate,
}: QuickAddDrawerProps) {
  const { addToast } = useToast();
  const { createTask } = useTrackDailyContext();
  const [categories] = useState<string[]>(() => getCategories());
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState(() => getCategories()[0] || "Other");
  const [plannedDate, setPlannedDate] = useState(() => prefilledDate || formatDateString(new Date()));
  const [plannedTime, setPlannedTime] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [recurringEndDate, setRecurringEndDate] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const toggleDayOfWeek = (day: number) => {
    setDaysOfWeek((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task title is required");
      addToast("Task title is required", "error", 2000);
      return;
    }

    let recurringRule: RecurringRule | undefined;
    if (isRecurring) {
      recurringRule = {
        frequency,
        daysOfWeek: frequency === "weekly" ? daysOfWeek : undefined,
        endDate: recurringEndDate || undefined,
      };
    }

    await createTask({
      title: title.trim(),
      notes: notes.trim() || undefined,
      category,
      plannedDate,
      plannedTime: plannedTime || undefined,
      status: "planned",
      isRecurring,
      recurringRule,
    });

    const timeStr = plannedTime ? ` at ${plannedTime}` : "";
    const recurringStr = isRecurring ? " (recurring)" : "";
    addToast(`Task "${title.trim()}" added${timeStr}${recurringStr}`, "success", 2500);

    onTaskAdded();
    onClose();
  };

  const daysLabel = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="fixed inset-0 bg-slate-950/35 animate-fade-in" onClick={onClose} />

      <div className="relative z-50 flex max-h-[86vh] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-t-xl border border-slate-200 bg-white p-5 shadow-2xl animate-slide-up sm:mb-6 sm:rounded-xl">
        <div className="mx-auto h-1 w-10 rounded-full bg-slate-200" />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">New task</p>
            <h3 className="text-lg font-semibold text-slate-950">Add to schedule</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-950"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">Task title</label>
            <input
              type="text"
              placeholder="What needs to get done?"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError("");
              }}
              className="glass-input w-full px-3.5 py-3 text-sm placeholder:text-slate-400"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                Date
              </label>
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="glass-input px-3 py-2.5 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                Time
              </label>
              <input
                type="time"
                value={plannedTime}
                onChange={(e) => setPlannedTime(e.target.value)}
                className="glass-input px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="glass-input px-3 py-2.5 text-sm font-medium"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">Notes</label>
            <textarea
              placeholder="Optional details"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="glass-input w-full resize-none px-3.5 py-2.5 text-sm placeholder:text-slate-400"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Repeat className="h-4 w-4 text-slate-500" />
                Recurring task
              </span>
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="h-4 w-4 accent-sky-700"
              />
            </label>

            {isRecurring ? (
              <div className="mt-3 flex flex-col gap-3 border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-600">Frequency</span>
                  <div className="flex rounded-lg border border-slate-200 bg-white p-1">
                    {(["daily", "weekly", "monthly"] as const).map((freq) => (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => setFrequency(freq)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                          frequency === freq ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {freq}
                      </button>
                    ))}
                  </div>
                </div>

                {frequency === "weekly" ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-slate-600">Repeat on</span>
                    <div className="flex justify-between gap-1.5">
                      {daysLabel.map((label, idx) => {
                        const active = daysOfWeek.includes(idx);
                        return (
                          <button
                            key={`${label}-${idx}`}
                            type="button"
                            onClick={() => toggleDayOfWeek(idx)}
                            className={`h-8 flex-1 rounded-lg text-xs font-semibold transition-colors ${
                              active ? "bg-sky-700 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                  <span className="text-xs font-semibold text-slate-600">End date</span>
                  <input
                    type="date"
                    value={recurringEndDate}
                    onChange={(e) => setRecurringEndDate(e.target.value)}
                    className="glass-input px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 active:bg-slate-950"
          >
            <Plus className="h-4 w-4" />
            Create task
          </button>
        </form>
      </div>
    </div>
  );
}
