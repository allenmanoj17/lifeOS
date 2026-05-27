"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, 
  CheckCircle2, 
  Circle, 
  Clock, 
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Lightbulb
} from "lucide-react";
import { formatDateString } from "./db";
import { Task } from "./types";
import { useTrackDailyContext } from "@/context/TrackDailyContext";
import QuickAddDrawer from "@/components/tasks/QuickAddDrawer";
import TaskDetailDrawer from "@/components/tasks/TaskDetailDrawer";
import { useToast } from "@/components/Toast";

export default function TodayPage() {
  const [selectedDateStr, setSelectedDateStr] = useState(() => formatDateString(new Date()));
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { addToast } = useToast();
  
  // Use the shared context
  const { allTasks, updateTask, refresh } = useTrackDailyContext();
  const tasks = allTasks.filter(t => t.plannedDate === selectedDateStr);
  const todayDateStr = formatDateString(new Date());
  const dateList = useMemo(() => {
    const centerDate = new Date(`${selectedDateStr}T12:00:00`);
    return Array.from({ length: 5 }, (_, index) => {
      const d = new Date(centerDate);
      d.setDate(centerDate.getDate() + index - 2);
      return {
        dateStr: formatDateString(d),
        dayName: d.toLocaleDateString([], { weekday: "narrow" }),
        dayNum: d.getDate(),
      };
    });
  }, [selectedDateStr]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open quick add
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsQuickAddOpen(true);
        addToast("Quick Add opened", "info", 1500);
      }
      
      // Left arrow to go to previous day
      if (e.key === "ArrowLeft" && !isQuickAddOpen && !isDetailOpen) {
        const d = new Date(selectedDateStr + "T12:00:00");
        d.setDate(d.getDate() - 1);
        setSelectedDateStr(formatDateString(d));
      }
      
      // Right arrow to go to next day
      if (e.key === "ArrowRight" && !isQuickAddOpen && !isDetailOpen) {
        const d = new Date(selectedDateStr + "T12:00:00");
        d.setDate(d.getDate() + 1);
        setSelectedDateStr(formatDateString(d));
      }
      
      // Escape to close drawers
      if (e.key === "Escape") {
        setIsQuickAddOpen(false);
        setIsDetailOpen(false);
        setSelectedTask(null);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [selectedDateStr, isQuickAddOpen, isDetailOpen, addToast]);

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
      addToast(`"${task.title}" marked as planned`, "info", 2000);
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
        } catch {}
      }
      await updateTask(task.id, { status, completedAt: now.toISOString() });
      const message = status === "done_late" 
        ? `✓ "${task.title}" completed (late)` 
        : `✓ "${task.title}" completed`;
      addToast(message, "success", 2000);
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
    month: "long",
    day: "numeric",
    year: "numeric",
  }) : "";

  return (
    <div className="flex flex-col gap-6 select-none animate-fade-in relative">
      
      {/* Daily Progress */}
      <div className="glass-panel flex items-center justify-between p-5">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Today
          </span>
          <span className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            {completedCount} <span className="text-sm font-medium text-slate-500">/ {tasks.length} done</span>
          </span>
          <span className="mt-1 text-sm font-medium text-slate-500">
            {tasks.length > 0 ? `${progressPercent}% complete` : "No tasks planned"}
          </span>
        </div>

        <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <circle 
              cx="32" cy="32" r="26" 
              className="stroke-slate-100" 
              strokeWidth="4.5" 
              fill="transparent" 
            />
            <circle 
              cx="32" cy="32" r="26" 
              stroke="#0284c7" 
              strokeWidth="4.5" 
              fill="transparent" 
              strokeDasharray={163.36}
              strokeDashoffset={163.36 - (163.36 * progressPercent) / 100}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <span className="absolute text-[11px] font-semibold text-slate-800">
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* 5-Day Horizontal Date Navigation bar */}
      <div className="flex items-center justify-between px-1">
        <button 
          onClick={handlePrevDay}
          className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex justify-between flex-1 px-3 gap-2">
          {dateList.map(({ dateStr, dayName, dayNum }) => {
            const isSelected = dateStr === selectedDateStr;
            const isToday = dateStr === todayDateStr;
            
            return (
              <button
                key={dateStr}
                onClick={() => handleDaySelect(dateStr)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-10 flex-1 relative ${
                  isSelected 
                    ? "bg-slate-900 text-white font-bold border border-slate-900" 
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
                      ? "border border-sky-500/30 text-sky-600 font-bold bg-sky-500/5" 
                      : ""
                }`}>
                  {dayNum}
                </span>
              </button>
            );
          })}
        </div>

        <button 
          onClick={handleNextDay}
          className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Header date info label */}
      <div className="px-1 -mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-500">
          {headerDateLabel}
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
                <span className="text-xs font-semibold text-slate-500 px-1 flex items-center gap-1.5">
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
                        className={`glass-card relative flex cursor-pointer flex-col gap-3 overflow-hidden border p-4 sm:flex-row sm:items-center sm:justify-between ${
                          isDone 
                            ? "bg-emerald-500/5 border-emerald-500/20 shadow-none opacity-85" 
                            : isMissed 
                              ? "bg-rose-500/5 border-rose-500/20" 
                              : isSkipped 
                                ? "bg-slate-100/80 border-slate-200/50 opacity-60"
                                : "border-slate-200/40 hover:border-sky-500/20 shadow-sm"
                        }`}
                      >
                        {/* Status sidebars in light mode */}
                        {isDone && <div className="absolute bottom-0 left-0 top-0 w-1 bg-emerald-500"></div>}
                        {isMissed && <div className="absolute bottom-0 left-0 top-0 w-1 bg-rose-500"></div>}
                        {isSkipped && <div className="absolute bottom-0 left-0 top-0 w-1 bg-slate-400"></div>}

                        <div className="flex min-w-0 items-center gap-3.5">
                          {/* Checked Checkbox click triggers quick check done */}
                          <div 
                            onClick={(e) => handleQuickComplete(e, task)}
                            className="shrink-0 cursor-pointer rounded-lg p-1 transition-colors hover:bg-slate-100"
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            ) : isMissed ? (
                              <Circle className="h-5 w-5 fill-rose-500/5 text-rose-500" />
                            ) : isSkipped ? (
                              <Circle className="h-5 w-5 fill-slate-300/10 text-slate-400" />
                            ) : (
                              <Circle className="h-5 w-5 text-slate-400 transition-colors hover:text-sky-500" />
                            )}
                          </div>

                          <div className="flex min-w-0 flex-col gap-1">
                            <span className={`text-xs font-bold leading-normal truncate ${
                              isDone ? "font-normal text-slate-500 line-through" : "text-slate-800"
                            }`}>
                              {task.title}
                            </span>
                            {task.notes ? (
                              <span className="max-w-full truncate text-[10px] text-slate-500 sm:max-w-[260px]">
                                {task.notes}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2.5 pl-8 sm:justify-end sm:pl-0">
                          {task.plannedTime && (
                            <div className="flex items-center gap-1 rounded-lg border border-slate-200/50 bg-slate-100 px-2 py-1 font-mono text-[9px] font-bold text-slate-600">
                              <Clock className="w-3 h-3 text-sky-500" />
                              <span>{task.plannedTime}</span>
                            </div>
                          )}
                          {task.isRecurring && (
                            <div className="flex items-center gap-1 text-[8px] text-sky-700 font-bold bg-sky-50 px-2 py-1 rounded-lg border border-sky-200 whitespace-nowrap" title={`Repeats ${task.recurringRule?.frequency || "daily"}`}>
                              <span>🔄</span>
                              <span className="uppercase tracking-wider">{task.recurringRule?.frequency || "Daily"}</span>
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
                                  : "bg-sky-500/10 border-sky-500/20 text-sky-600"
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
          /* Empty State - Light Clean design with suggestions */
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-dashed border-slate-300 rounded-lg p-8 relative overflow-hidden">
            <ClipboardList className="w-14 h-14 text-sky-300 mb-5 relative z-10" />
            <h3 className="text-sm font-semibold text-slate-800 relative z-10">
              Day is clear for planning
            </h3>
            <p className="text-sm text-slate-500 mt-3 max-w-[280px] leading-relaxed relative z-10">
              No tasks scheduled for this day. Add focus items or plan ahead.
            </p>
            
            {/* Quick action suggestions */}
            <div className="mt-6 flex flex-col gap-2.5 w-full max-w-xs relative z-10">
              <button
                onClick={() => setIsQuickAddOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors active:bg-slate-950"
              >
                <Plus className="w-4 h-4" />
                Add Task (⌘K)
              </button>
              
              {/* Suggestion prompts */}
              <div className="text-[9px] text-slate-400 mt-2 space-y-1.5">
                <div className="flex items-center gap-2 justify-center opacity-70 hover:opacity-100 transition">
                  <Lightbulb className="w-3 h-3 text-amber-500" />
                  <span>Tip: Use arrow keys to browse other days</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) for Quick Add in light mode */}
      <button 
        onClick={() => setIsQuickAddOpen(true)}
        className="group fixed bottom-24 right-6 z-40 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition-colors hover:bg-slate-800 active:bg-slate-950 sm:bottom-6"
        title="Add Task — Press ⌘K"
      >
        <Plus className="w-6 h-6 text-white group-hover:rotate-90 transition-transform duration-300" />
        <div className="absolute bottom-full mb-2 px-2.5 py-1.5 bg-slate-800 text-white text-[9px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Add Task (⌘K)
        </div>
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
