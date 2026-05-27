"use client";

import React, { useState, useEffect } from "react";
import { 
  Plus, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Sparkles, 
  ChevronLeft,
  ChevronRight,
  ClipboardList
} from "lucide-react";
import { formatDateString } from "./db";
import { Task } from "./types";
import { useTrackDailyContext } from "@/context/TrackDailyContext";
import QuickAddDrawer from "@/components/tasks/QuickAddDrawer";
import TaskDetailDrawer from "@/components/tasks/TaskDetailDrawer";

export default function TodayPage() {
  const [selectedDateStr, setSelectedDateStr] = useState("");
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // Date nav array
  const [dateList, setDateList] = useState<{ dateStr: string; dayName: string; dayNum: number }[]>([]);

  // Use the shared context
  const { allTasks, isLoading, updateTask, refresh } = useTrackDailyContext();
  const tasks = allTasks.filter(t => t.plannedDate === selectedDateStr);

  useEffect(() => {
    // Set default date to today on mount
    const today = new Date();
    const todayStr = formatDateString(today);
    setSelectedDateStr(todayStr);
  }, []);

  useEffect(() => {
    if (!selectedDateStr) return;

    // Generate 5-day array around selected date
    const centerDate = new Date(selectedDateStr + "T12:00:00"); // avoid timezone shifting
    const list = [];
    for (let i = -2; i <= 2; i++) {
      const d = new Date(centerDate);
      d.setDate(centerDate.getDate() + i);
      const dateStr = formatDateString(d);
      
      const dayName = d.toLocaleDateString([], { weekday: 'narrow' }); // M, T, W...
      const dayNum = d.getDate();
      list.push({ dateStr, dayName, dayNum });
    }
    setDateList(list);
  }, [selectedDateStr]);

  const triggerRefresh = () => {
    refresh();
  };

  const handleDaySelect = (dateStr: string) => {
    setSelectedDateStr(dateStr);
  };

  const handlePrevDay = () => {
    const d = new Date(selectedDateStr + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setSelectedDateStr(formatDateString(d));
  };

  const handleNextDay = () => {
    const d = new Date(selectedDateStr + "T12:00:00");
    d.setDate(d.getDate() + 1);
    setSelectedDateStr(formatDateString(d));
  };

  // Mark task done directly from list
  const handleQuickComplete = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation(); // don't open details drawer
    
    if (task.status === "done" || task.status === "done_late") {
      // Toggle back to planned
      await updateTask(task.id, { status: "planned", completedAt: undefined });
    } else {
      // Mark done (check late)
      const now = new Date();
      let status: Task["status"] = "done";
      if (task.plannedTime) {
        try {
          const plannedDateTime = new Date(`${task.plannedDate}T${task.plannedTime}`);
          if (now > plannedDateTime) {
            status = "done_late";
          }
        } catch (err) {}
      }
      await updateTask(task.id, { status, completedAt: now.toISOString() });
    }
  };

  // Grouping tasks by time blocks
  const getGroupedTasks = () => {
    const groups: { [key: string]: Task[] } = {
      Morning: [],
      Afternoon: [],
      Evening: [],
      Night: [],
      Unscheduled: []
    };

    tasks.forEach(task => {
      if (!task.plannedTime) {
        groups.Unscheduled.push(task);
        return;
      }

      const hour = parseInt(task.plannedTime.split(":")[0]);
      if (hour >= 5 && hour < 12) {
        groups.Morning.push(task);
      } else if (hour >= 12 && hour < 17) {
        groups.Afternoon.push(task);
      } else if (hour >= 17 && hour < 22) {
        groups.Evening.push(task);
      } else {
        groups.Night.push(task);
      }
    });

    // Sort each group by time
    Object.keys(groups).forEach(key => {
      if (key !== "Unscheduled") {
        groups[key].sort((a, b) => (a.plannedTime || "").localeCompare(b.plannedTime || ""));
      }
    });

    return groups;
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const completedCount = tasks.filter(t => t.status === "done" || t.status === "done_late").length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const groupedTasks = getGroupedTasks();
  const hasAnyTasks = tasks.length > 0;

  // Formatting date for header
  const headerDateLabel = selectedDateStr ? new Date(selectedDateStr + "T12:00:00").toLocaleDateString([], { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  }) : "";

  return (
    <div className="flex flex-col gap-6 select-none animate-fade-in relative">
      
      {/* Daily Progress Widget - Light Cognitive Panel */}
      <div className="glass-panel p-5 rounded-2xl border border-indigo-500/10 flex items-center justify-between shadow-sm relative overflow-hidden scanline">
        <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="flex flex-col gap-1">
          <span className="text-[9px] text-indigo-600 font-bold uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            Sync Core Status
          </span>
          <span className="text-2xl font-black text-slate-800 tracking-tight mt-1">
            {completedCount} <span className="text-slate-500 text-sm font-medium">/ {tasks.length} Done</span>
          </span>
          <span className="text-xs text-slate-500 font-semibold mt-1">
            {tasks.length > 0 ? `${progressPercent}% of nodes processed` : "Zero nodes committed"}
          </span>
        </div>

        {/* Circular progress loader in light mode */}
        <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <defs>
              <linearGradient id="lightCyberGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            <circle 
              cx="32" cy="32" r="26" 
              className="stroke-slate-100" 
              strokeWidth="4.5" 
              fill="transparent" 
            />
            <circle 
              cx="32" cy="32" r="26" 
              stroke="url(#lightCyberGradient)" 
              strokeWidth="4.5" 
              fill="transparent" 
              strokeDasharray={163.36}
              strokeDashoffset={163.36 - (163.36 * progressPercent) / 100}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <span className="absolute text-[11px] font-black text-slate-800 font-mono tracking-tighter">
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* 5-Day Horizontal Date Navigation bar */}
      <div className="flex items-center justify-between px-1">
        <button 
          onClick={handlePrevDay}
          className="p-2 bg-white/70 hover:bg-slate-100 border border-slate-200/60 rounded-xl text-slate-500 hover:text-slate-800 transition-all shrink-0 shadow-sm"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex justify-between flex-1 px-3 gap-2">
          {dateList.map(({ dateStr, dayName, dayNum }) => {
            const isSelected = dateStr === selectedDateStr;
            const isToday = dateStr === formatDateString(new Date());
            
            return (
              <button
                key={dateStr}
                onClick={() => handleDaySelect(dateStr)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 min-w-10 flex-1 relative ${
                  isSelected 
                    ? "bg-gradient-to-br from-indigo-500 to-indigo-650 text-white font-bold shadow-md shadow-indigo-500/10 scale-105 border border-indigo-400/20" 
                    : "text-slate-500 hover:bg-white/80 border border-transparent"
                }`}
              >
                <span className={`text-[8px] font-bold tracking-widest uppercase ${isSelected ? "text-white" : "text-slate-400"}`}>
                  {dayName}
                </span>
                <span className={`text-xs w-7 h-7 flex items-center justify-center rounded-lg ${
                  isSelected 
                    ? "bg-white/20" 
                    : isToday 
                      ? "border border-indigo-500/30 text-indigo-600 font-bold bg-indigo-500/5" 
                      : ""
                }`}>
                  {dayNum}
                </span>
                {/* Active indicator dot */}
                {isSelected && (
                  <span className="absolute -bottom-1 w-1.5 h-1.5 bg-sky-400 rounded-full"></span>
                )}
              </button>
            );
          })}
        </div>

        <button 
          onClick={handleNextDay}
          className="p-2 bg-white/70 hover:bg-slate-100 border border-slate-200/60 rounded-xl text-slate-500 hover:text-slate-800 transition-all shrink-0 shadow-sm"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Header date info label */}
      <div className="px-1 -mb-2 flex items-center justify-between">
        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
          // {headerDateLabel}
        </h2>
      </div>

      {/* Task List container */}
      <div className="flex flex-col gap-6 pb-12">
        {hasAnyTasks ? (
          (Object.keys(groupedTasks) as Array<keyof typeof groupedTasks>).map(block => {
            const blockTasks = groupedTasks[block];
            if (blockTasks.length === 0) return null;

            return (
              <div key={block} className="flex flex-col gap-3">
                <span className="text-[9px] font-bold tracking-widest text-indigo-500/70 uppercase px-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-indigo-500/40 rounded-full"></span>
                  {block} ({blockTasks.length})
                </span>
                
                <div className="flex flex-col gap-2.5">
                  {blockTasks.map((task) => {
                    const isDone = task.status === "done" || task.status === "done_late";
                    const isDoneLate = task.status === "done_late";
                    const isMissed = task.status === "missed";
                    const isSkipped = task.status === "skipped";

                    return (
                      <div
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        className={`glass-card p-4 rounded-2xl flex items-center justify-between border cursor-pointer transition-all duration-300 relative overflow-hidden ${
                          isDone 
                            ? "bg-emerald-500/5 border-emerald-500/20 shadow-none opacity-85" 
                            : isMissed 
                              ? "bg-rose-500/5 border-rose-500/20" 
                              : isSkipped 
                                ? "bg-slate-100/80 border-slate-200/50 opacity-60"
                                : "border-slate-200/40 hover:border-indigo-500/20 shadow-sm"
                        }`}
                      >
                        {/* Status sidebars in light mode */}
                        {isDone && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>}
                        {isMissed && <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500"></div>}
                        {isSkipped && <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-450"></div>}

                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Checked Checkbox click triggers quick check done */}
                          <div 
                            onClick={(e) => handleQuickComplete(e, task)}
                            className="p-1 hover:bg-slate-100 rounded-lg transition-colors shrink-0 cursor-pointer"
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-5.5 h-5.5 text-emerald-550" />
                            ) : isMissed ? (
                              <Circle className="w-5.5 h-5.5 text-rose-500 fill-rose-500/5" />
                            ) : isSkipped ? (
                              <Circle className="w-5.5 h-5.5 text-slate-400 fill-slate-300/10" />
                            ) : (
                              <Circle className="w-5.5 h-5.5 text-slate-350 hover:text-indigo-650 transition-colors" />
                            )}
                          </div>

                          <div className="flex flex-col gap-1 min-w-0">
                            <span className={`text-xs font-bold leading-normal truncate ${
                              isDone ? "line-through text-slate-450 font-normal" : "text-slate-800"
                            }`}>
                              {task.title}
                            </span>
                            {task.notes ? (
                              <span className="text-[10px] text-slate-500 truncate max-w-[200px]">
                                {task.notes}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          {task.plannedTime && (
                            <div className="flex items-center gap-1 text-[9px] text-slate-650 font-bold bg-slate-100 px-2 py-1 rounded-lg border border-slate-200/50 font-mono">
                              <Clock className="w-3 h-3 text-indigo-500" />
                              <span>{task.plannedTime}</span>
                            </div>
                          )}
                          <span className={`text-[9px] uppercase font-black tracking-widest px-2 py-1 rounded-md border ${
                            isDone 
                              ? isDoneLate 
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-700"
                                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" 
                              : isMissed 
                                ? "bg-rose-500/10 border-rose-500/20 text-rose-700"
                                : isSkipped
                                  ? "bg-slate-200/40 border-slate-300/35 text-slate-500"
                                  : "bg-indigo-500/10 border-indigo-500/20 text-indigo-600"
                          }`}>
                            {isDoneLate ? "LATE" : task.category}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          /* Empty State - Light Clean design */
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white/40 border border-dashed border-slate-200/80 rounded-3xl p-6 relative overflow-hidden scanline">
            <ClipboardList className="w-12 h-12 text-slate-200 mb-4" />
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Empty Planning Cortex</h3>
            <p className="text-[10px] text-slate-400 mt-2 max-w-[200px] leading-normal font-semibold">
              No tasks planned for this timestamp. Initialize new node by clicking the anchor below.
            </p>
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) for Quick Add in light mode */}
      <button 
        onClick={() => setIsQuickAddOpen(true)}
        className="fixed bottom-24 right-6 w-13 h-13 bg-gradient-to-r from-indigo-500 via-indigo-650 to-sky-500 text-white rounded-full flex items-center justify-center shadow-[0_4px_15px_rgba(99,102,241,0.25)] hover:scale-105 active:scale-95 transition-all z-40 border border-indigo-400/20 cursor-pointer"
        title="Initialize Task Module"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      {/* Drawers */}
      {isQuickAddOpen && (
        <QuickAddDrawer 
          key={selectedDateStr}
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
          onTaskAdded={triggerRefresh}
          prefilledDate={selectedDateStr}
        />
      )}

      {isDetailOpen && selectedTask && (
        <TaskDetailDrawer 
          key={selectedTask.id}
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedTask(null);
          }}
          task={selectedTask}
          onTaskUpdated={triggerRefresh}
        />
      )}
    </div>
  );
}
