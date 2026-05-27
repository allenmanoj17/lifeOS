"use client";

import React, { useState, useEffect } from "react";
import { 
  CalendarDays, 
  Plus, 
  CheckCircle2, 
  Circle
} from "lucide-react";
import { formatDateString } from "../db";
import { Task } from "../types";
import { useTrackDailyContext } from "@/context/TrackDailyContext";
import QuickAddDrawer from "@/components/tasks/QuickAddDrawer";
import TaskDetailDrawer from "@/components/tasks/TaskDetailDrawer";

export default function PlanPage() {
  const [days, setDays] = useState<{ dateStr: string; label: string; tasks: Task[] }[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { allTasks, refresh } = useTrackDailyContext();

  useEffect(() => {
    const today = new Date();
    const list = [];
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = formatDateString(d);
      
      let label = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      if (i === 0) label = "Today";
      else if (i === 1) label = "Tomorrow";

      // Filter tasks from allTasks matching this date
      const tasksForDay = allTasks.filter(t => t.plannedDate === dateStr);
      list.push({ dateStr, label, tasks: tasksForDay });
    }
    
    setDays(list);
  }, [allTasks]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleAddTaskClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setIsQuickAddOpen(true);
  };

  const triggerRefresh = () => {
    refresh();
  };

  // Helper to render task icon based on status
  const renderStatusIcon = (status: Task["status"]) => {
    switch (status) {
      case "done":
      case "done_late":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case "missed":
        return <Circle className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20 shrink-0" />;
      case "skipped":
        return <Circle className="w-3.5 h-3.5 text-zinc-500 fill-zinc-500/10 shrink-0" />;
      default:
        return <Circle className="w-3.5 h-3.5 text-zinc-600 shrink-0" />;
    }
  };

  return (
    <div className="flex flex-col gap-5 px-1 animate-slide-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-bold text-white tracking-wide">7-Day Planning Horizon</h2>
        </div>
        <span className="text-[10px] text-zinc-500 font-semibold">
          Select date to plan
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {days.map(({ dateStr, label, tasks }) => (
          <div 
            key={dateStr}
            className="glass-panel p-4.5 rounded-2xl border border-white/5 flex flex-col gap-3 relative"
          >
            {/* Day Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <h3 className="text-sm font-bold text-white">{label}</h3>
                <span className="text-[10px] text-zinc-500 font-medium">
                  {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
                </span>
              </div>
              <button 
                onClick={() => handleAddTaskClick(dateStr)}
                className="p-1.5 bg-purple-500/15 border border-purple-500/25 text-purple-300 rounded-lg hover:bg-purple-500/20 hover:text-purple-200 transition-all"
                title={`Plan task for ${label}`}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tasks scheduled */}
            {tasks.length > 0 ? (
              <div className="flex flex-col gap-2">
                {tasks.map((task) => (
                  <div 
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className="flex items-center justify-between p-2.5 bg-zinc-900/60 hover:bg-zinc-900 border border-white/5 rounded-xl cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {renderStatusIcon(task.status)}
                      <span className={`text-xs font-semibold text-zinc-200 truncate ${
                        (task.status === "done" || task.status === "done_late") ? "line-through opacity-50" : ""
                      }`}>
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {task.plannedTime && (
                        <span className="text-[9px] text-zinc-500 font-bold bg-zinc-800 px-1.5 py-0.5 rounded">
                          {task.plannedTime}
                        </span>
                      )}
                      <span className="text-[9px] uppercase font-bold tracking-wider text-purple-400 bg-purple-500/5 border border-purple-500/10 px-1.5 py-0.5 rounded">
                        {task.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-zinc-600 italic">No tasks planned. Tap '+' to schedule one.</p>
            )}
          </div>
        ))}
      </div>

      {/* Modals & Dialogs */}
      {isQuickAddOpen && (
        <QuickAddDrawer 
          key={selectedDate}
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
          onTaskAdded={triggerRefresh}
          prefilledDate={selectedDate}
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
