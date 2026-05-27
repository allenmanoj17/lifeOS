"use client";

import React, { useState } from "react";
import { 
  Check, 
  BookOpen, 
  TrendingUp,
  FileText,
  CalendarCheck
} from "lucide-react";
import { formatDateString } from "../db";
import { useTrackDailyContext } from "@/context/TrackDailyContext";

type Resolution = {
  action: "carry" | "reschedule" | "skip" | "missed";
  rescheduleDate?: string;
  reason?: string;
};

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return formatDateString(monday);
}

export default function ReviewPage() {
  const { allTasks, dailyReviews, weeklyReviews, createDailyReview, createWeeklyReview, updateTask } = useTrackDailyContext();

  const [activeTab, setActiveTab] = useState<"daily" | "weekly">("daily");
  
  // Date states
  const [selectedDate, setSelectedDate] = useState(() => formatDateString(new Date()));
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => getMonday(new Date()));
  
  // Reflection states
  const [reflectionDrafts, setReflectionDrafts] = useState<Record<string, string>>({});
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Unfinished task resolution states
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, Record<string, Resolution>>>({});

  const reviewKey = activeTab === "daily" ? `daily:${selectedDate}` : `weekly:${selectedWeekStart}`;
  const savedReflection =
    activeTab === "daily"
      ? dailyReviews.find((review) => review.date === selectedDate)?.reflectionNote
      : weeklyReviews.find((review) => review.weekStart === selectedWeekStart)?.reflectionNote;
  const reflectionNote = reflectionDrafts[reviewKey] ?? savedReflection ?? "";
  const resolutions = resolutionDrafts[selectedDate] ?? {};
  const setReflectionNote = (value: string) => {
    setReflectionDrafts((previous) => ({ ...previous, [reviewKey]: value }));
  };
  const updateResolutions = (
    updater: (previous: Record<string, Resolution>) => Record<string, Resolution>
  ) => {
    setResolutionDrafts((previous) => ({
      ...previous,
      [selectedDate]: updater(previous[selectedDate] ?? {}),
    }));
  };

  // Find tasks for the selected daily review date
  const dailyTasks = allTasks.filter(t => t.plannedDate === selectedDate);
  const unfinishedDailyTasks = dailyTasks.filter(t => t.status === "planned");
  const completedDailyTasks = dailyTasks.filter(t => t.status === "done" || t.status === "done_late");

  // Get start/end range of selected week
  const getWeekRange = () => {
    if (!selectedWeekStart) return { start: "", end: "" };
    const start = new Date(selectedWeekStart + "T12:00:00");
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      start: selectedWeekStart,
      end: formatDateString(end)
    };
  };

  const weekRange = getWeekRange();

  // Find weekly metrics
  const weeklyTasks = allTasks.filter(t => 
    t.plannedDate >= weekRange.start && t.plannedDate <= weekRange.end
  );
  const weeklyCompleted = weeklyTasks.filter(t => t.status === "done" || t.status === "done_late").length;
  const weeklyTotal = weeklyTasks.length;
  const weeklyRate = weeklyTotal > 0 ? Math.round((weeklyCompleted / weeklyTotal) * 100) : 0;

  // Find daily reflections logged in this week
  const weeklyDailyReviews = dailyReviews.filter(r => 
    r.date >= weekRange.start && r.date <= weekRange.end
  ).sort((a, b) => a.date.localeCompare(b.date));

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Handle resolutions input changes
  const handleResolutionAction = (taskId: string, action: "carry" | "reschedule" | "skip" | "missed") => {
    const tomorrow = new Date(selectedDate + "T12:00:00");
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDateString(tomorrow);

    updateResolutions(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        action,
        rescheduleDate: action === "carry" ? tomorrowStr : prev[taskId]?.rescheduleDate || tomorrowStr,
        reason: prev[taskId]?.reason || ""
      }
    }));
  };

  const handleResolutionDate = (taskId: string, date: string) => {
    updateResolutions(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        rescheduleDate: date
      }
    }));
  };

  const handleResolutionReason = (taskId: string, reason: string) => {
    updateResolutions(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        reason
      }
    }));
  };

  // Submit Daily Review
  const handleSubmitDaily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;

    for (const task of unfinishedDailyTasks) {
      const res = resolutions[task.id];
      if (!res) {
        triggerToast("Please choose an action for all unfinished items");
        return;
      }

      if (res.action === "carry" || res.action === "reschedule") {
        const targetDate = res.rescheduleDate || selectedDate;
        await updateTask(task.id, {
          plannedDate: targetDate,
          status: "planned",
          delayReason: res.reason || "Carried forward during End of Day review"
        });
      } else if (res.action === "skip") {
        if (!res.reason?.trim()) {
          triggerToast(`Please provide a skip reason for "${task.title}"`);
          return;
        }
        await updateTask(task.id, {
          status: "skipped",
          skipReason: res.reason
        });
      } else if (res.action === "missed") {
        await updateTask(task.id, {
          status: "missed",
          delayReason: res.reason || "Uncompleted task"
        });
      }
    }

    await createDailyReview(selectedDate, reflectionNote);
    triggerToast("Daily reflection submitted successfully!");
    setResolutionDrafts((previous) => ({ ...previous, [selectedDate]: {} }));
  };

  // Submit Weekly Review
  const handleSubmitWeekly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWeekStart) return;

    await createWeeklyReview(selectedWeekStart, reflectionNote);
    triggerToast("Weekly performance audit registered!");
  };

  return (
    <div className="flex flex-col gap-6 px-1 animate-slide-up relative text-slate-800">
      {/* Toast Alert */}
      {showToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 glass-panel border-sky-500/20 px-4 py-2.5 rounded-xl shadow-md z-50 text-xs font-semibold text-sky-700 flex items-center gap-1.5 animate-slide-down">
          <Check className="w-3.5 h-3.5 text-sky-500" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="glass-panel p-1 rounded-xl flex border border-slate-200/50 shadow-sm">
        <button
          onClick={() => setActiveTab("daily")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "daily"
              ? "bg-sky-500 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Daily Reflection
        </button>
        <button
          onClick={() => setActiveTab("weekly")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "weekly"
              ? "bg-sky-500 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Weekly Audit
        </button>
      </div>

      {activeTab === "daily" ? (
        /* DAILY REFLECTION LAYOUT */
        <form onSubmit={handleSubmitDaily} className="flex flex-col gap-5">
          {/* Header & Date Selector */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-200/50 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-sky-600 font-bold uppercase tracking-widest flex items-center gap-1">
                <CalendarCheck className="w-3.5 h-3.5 text-sky-600" />
                Reflection Target
              </span>
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-800 text-[11px] font-bold focus:outline-none focus:border-sky-400 font-mono"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-1 text-xs">
              <div className="bg-slate-100/50 p-3 rounded-xl border border-slate-200/55 shadow-inner">
                <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-wider">Completed</span>
                <span className="text-xl font-extrabold text-emerald-600 font-mono mt-0.5 block">{completedDailyTasks.length}</span>
              </div>
              <div className="bg-slate-100/50 p-3 rounded-xl border border-slate-200/55 shadow-inner">
                <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-wider">Unfinished</span>
                <span className={`text-xl font-extrabold font-mono mt-0.5 block ${unfinishedDailyTasks.length > 0 ? "text-rose-600" : "text-slate-400"}`}>
                  {unfinishedDailyTasks.length}
                </span>
              </div>
            </div>
          </div>

          {/* Unfinished Task Resolutions */}
          {unfinishedDailyTasks.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Resolve Unfinished Nodes ({unfinishedDailyTasks.length})
              </h3>
              
              <div className="flex flex-col gap-3.5">
                {unfinishedDailyTasks.map(task => {
                  const currentRes = resolutions[task.id] || { action: "carry" };
                  
                  return (
                    <div 
                      key={task.id} 
                      className="glass-panel relative flex flex-col gap-3.5 overflow-hidden rounded-lg border border-slate-200/50 p-4 shadow-sm"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-sky-500/40"></div>
                      
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-slate-800">{task.title}</span>
                        <span className="text-[10px] text-slate-500">Planned for: {task.plannedTime || "No specific time"}</span>
                      </div>

                      {/* Action selector */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { key: "carry", label: "Carry Fwd" },
                          { key: "reschedule", label: "Resched" },
                          { key: "skip", label: "Skip" },
                          { key: "missed", label: "Missed" }
                        ] as const).map(opt => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => handleResolutionAction(task.id, opt.key)}
                            className={`py-1.5 text-[9px] font-extrabold uppercase rounded-lg border transition-all cursor-pointer ${
                              currentRes.action === opt.key
                                ? "bg-sky-500/10 border-sky-500/20 text-sky-700 shadow-sm"
                                : "bg-slate-100/50 border-slate-200/50 text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* Custom Reschedule Calendar Picker */}
                      {currentRes.action === "reschedule" && (
                        <div className="flex items-center gap-2 animate-fade-in">
                          <span className="shrink-0 text-[9px] font-bold uppercase text-slate-600">New Date:</span>
                          <input 
                            type="date"
                            value={currentRes.rescheduleDate || ""}
                            onChange={(e) => handleResolutionDate(task.id, e.target.value)}
                            className="bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-800 text-[10px] font-bold focus:outline-none focus:border-sky-400 font-mono flex-1"
                          />
                        </div>
                      )}

                      {/* Reason Inputs */}
                      {(currentRes.action === "skip" || currentRes.action === "reschedule" || currentRes.action === "carry" || currentRes.action === "missed") && (
                        <input 
                          type="text"
                          placeholder={currentRes.action === "skip" ? "Required skip reason..." : "Reason / notes (optional)..."}
                          value={currentRes.reason || ""}
                          onChange={(e) => handleResolutionReason(task.id, e.target.value)}
                          className="glass-input text-[11px] px-3 py-2 text-slate-800 placeholder:text-slate-400 w-full"
                          required={currentRes.action === "skip"}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* If everything is done - congratulate */}
          {dailyTasks.length > 0 && unfinishedDailyTasks.length === 0 && (
            <div className="glass-panel p-5 border border-emerald-200 bg-emerald-50 text-center flex flex-col items-center gap-2">
              <Check className="w-8 h-8 text-emerald-600 animate-pulse" />
              <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Day complete</h4>
              <p className="text-[10px] text-slate-500 max-w-[240px] leading-relaxed font-medium">
                All scheduled tasks for this day have been marked complete.
              </p>
            </div>
          )}

          {/* Reflection notes journaling */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-200/50 flex flex-col gap-3.5 shadow-sm">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-500" />
              <h3 className="text-sm font-bold text-slate-800 tracking-wide">Daily reflection</h3>
            </div>
            
            <textarea
              placeholder="What worked, what slipped, and what should change tomorrow?"
              value={reflectionNote}
              onChange={(e) => setReflectionNote(e.target.value)}
              className="glass-input text-xs px-3 py-2.5 h-28 resize-none leading-relaxed placeholder:text-slate-400"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-widest rounded-lg transition-colors cursor-pointer"
          >
            Submit Daily Reflection
          </button>
        </form>
      ) : (
        /* WEEKLY PERFORMANCE AUDIT LAYOUT */
        <form onSubmit={handleSubmitWeekly} className="flex flex-col gap-5">
          {/* Week Start Selector */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-200/50 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-sky-600 font-bold uppercase tracking-widest flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-sky-500" />
                Week start
              </span>
              <input 
                type="date"
                value={selectedWeekStart}
                onChange={(e) => setSelectedWeekStart(getMonday(new Date(e.target.value)))}
                className="bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-800 text-[11px] font-bold focus:outline-none focus:border-sky-400 font-mono"
              />
            </div>
            
            <p className="text-[10px] text-slate-500 tracking-wider font-semibold uppercase mt-1">
              Range: {weekRange.start} <span className="text-slate-400">to</span> {weekRange.end}
            </p>

            {/* Weekly performance statistics widgets */}
            <div className="grid grid-cols-2 gap-3 mt-2 text-xs">
              <div className="bg-slate-100/50 p-3 rounded-xl border border-slate-200/55 shadow-inner">
                <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-wider">Completion Rate</span>
                <span className="text-xl font-extrabold text-sky-500 font-mono mt-0.5 block">{weeklyRate}%</span>
              </div>
              <div className="bg-slate-100/50 p-3 rounded-xl border border-slate-200/55 shadow-inner">
                <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-wider">Completed tasks</span>
                <span className="mt-0.5 block font-mono text-xl font-extrabold text-slate-900">{weeklyCompleted} <span className="text-xs font-normal text-slate-500">/ {weeklyTotal}</span></span>
              </div>
            </div>
          </div>

          {/* Daily Reflections Feed - Collapsible scroll container */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-200/50 flex flex-col gap-3.5 shadow-sm">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-500" />
              <h3 className="text-sm font-bold text-slate-800 tracking-wide">Daily reflections</h3>
            </div>
            
            {weeklyDailyReviews.length > 0 ? (
              <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto pr-1">
                {weeklyDailyReviews.map(review => (
                  <div key={review.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200/50 flex flex-col gap-1.5 shadow-inner">
                    <div className="flex items-center justify-between text-[9px] font-bold tracking-widest text-sky-600 font-mono uppercase">
                      <span>{review.date}</span>
                      <span className="text-slate-400">NOTE</span>
                    </div>
                    <p className="text-[11px] italic leading-relaxed text-slate-600">
                      {review.reflectionNote || "No note recorded for this day."}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50/50 border border-dashed border-slate-200 p-4 rounded-xl text-center text-slate-400 text-xs shadow-inner">
                No daily reflections recorded in this week.
              </div>
            )}
          </div>

          {/* Weekly reflection note */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-200/50 flex flex-col gap-3.5 shadow-sm">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-500" />
              <h3 className="text-sm font-bold text-slate-800 tracking-wide">Weekly reflection</h3>
            </div>
            
            <textarea
              placeholder="What patterns should carry into next week, and what needs adjusting?"
              value={reflectionNote}
              onChange={(e) => setReflectionNote(e.target.value)}
              className="glass-input text-xs px-3 py-2.5 h-28 resize-none leading-relaxed placeholder:text-slate-400"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-widest rounded-lg transition-colors cursor-pointer"
          >
            Submit Weekly Audit
          </button>
        </form>
      )}
    </div>
  );
}
