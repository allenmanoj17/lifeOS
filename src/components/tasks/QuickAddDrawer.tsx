"use client";

import React, { useState } from "react";
import { X, Calendar, Clock, Plus, Repeat } from "lucide-react";
import { getCategories, createTask, formatDateString } from "@/app/trackdaily/db";
import { RecurringRule } from "@/app/trackdaily/types";

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
  const [categories] = useState<string[]>(() => getCategories());
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState(() => getCategories()[0] || "Other");
  const [plannedDate, setPlannedDate] = useState(() => prefilledDate || formatDateString(new Date()));
  const [plannedTime, setPlannedTime] = useState("");
  
  // Recurring state
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]); // 0=Sun, 1=Mon...
  const [recurringEndDate, setRecurringEndDate] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const toggleDayOfWeek = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter(d => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task title is required");
      return;
    }

    let recurringRule: RecurringRule | undefined = undefined;
    if (isRecurring) {
      recurringRule = {
        frequency,
        daysOfWeek: frequency === "weekly" ? daysOfWeek : undefined,
        endDate: recurringEndDate || undefined,
      };
    }

    createTask({
      title: title.trim(),
      notes: notes.trim() || undefined,
      category,
      plannedDate,
      plannedTime: plannedTime || undefined,
      status: "planned",
      isRecurring,
      recurringRule,
    });

    onTaskAdded();
    onClose();
  };

  const daysLabel = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      ></div>

      {/* Drawer Panel */}
      <div className="w-full max-w-md bg-zinc-950 border-t border-white/10 rounded-t-[2rem] z-50 p-6 flex flex-col gap-4 shadow-2xl relative max-h-[85vh] overflow-y-auto animate-slide-up">
        {/* Drag handle decoration */}
        <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-2 shrink-0"></div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-purple-400" />
            <span>Add Daily Task</span>
          </h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-zinc-900 rounded-lg text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <p className="text-xs text-rose-400 font-bold bg-rose-500/10 px-3 py-2 rounded-lg">{error}</p>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Task Title</label>
            <input 
              type="text" 
              placeholder="E.g., Read documentation, gym sessions..."
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError("");
              }}
              className="glass-input text-xs px-3.5 py-3 text-white placeholder:text-zinc-600 w-full"
              autoFocus
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                <Calendar className="w-3 h-3 text-purple-400" />
                <span>Planned Date</span>
              </label>
              <input 
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                <Clock className="w-3 h-3 text-purple-400" />
                <span>Planned Time</span>
              </label>
              <input 
                type="time"
                value={plannedTime}
                onChange={(e) => setPlannedTime(e.target.value)}
                className="bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
              />
            </div>
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50 cursor-pointer font-semibold"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Notes</label>
            <textarea 
              placeholder="Additional details (optional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="glass-input text-xs px-3.5 py-2.5 text-white placeholder:text-zinc-600 w-full resize-none"
            />
          </div>

          {/* Recurring Toggle */}
          <div className="pt-2 border-t border-white/5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-zinc-300 font-medium">Is this a recurring habit?</span>
              </div>
              <input 
                type="checkbox" 
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
              />
            </div>

            {/* Recurring Rule Panel */}
            {isRecurring && (
              <div className="p-3 bg-zinc-900/40 border border-white/5 rounded-xl flex flex-col gap-3.5 animate-fade-in">
                {/* Frequency */}
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Frequency</span>
                  <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-white/5">
                    {(["daily", "weekly", "monthly"] as const).map((freq) => (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => setFrequency(freq)}
                        className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md transition-colors ${
                          frequency === freq 
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/25" 
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {freq}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Days of Week (Weekly only) */}
                {frequency === "weekly" && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase">Repeat On</span>
                    <div className="flex justify-between">
                      {daysLabel.map((label, idx) => {
                        const active = daysOfWeek.includes(idx);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleDayOfWeek(idx)}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-black transition-all text-[10px] ${
                              active 
                                ? "bg-purple-500 text-black shadow-md shadow-purple-500/10" 
                                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* End Date */}
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">End Date (optional)</span>
                  <input 
                    type="date"
                    value={recurringEndDate}
                    onChange={(e) => setRecurringEndDate(e.target.value)}
                    className="bg-zinc-900 border border-white/5 rounded-lg px-2.5 py-1 text-white text-[11px] focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <button 
            type="submit"
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 transition-all text-xs tracking-wide uppercase mt-2"
          >
            Create Task
          </button>
        </form>
      </div>
    </div>
  );
}
