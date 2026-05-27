"use client";

import React, { useMemo, useState } from "react";
import { 
  CalendarRange, 
  AlertTriangle, 
  Check, 
  Sparkles,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { useTrackDailyContext } from "@/context/TrackDailyContext";
import { formatDateString } from "../db";
import { Task } from "../types";

interface GCalEvent {
  id: string;
  title: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  color: string;
}

// Generate static mock Google Calendar events for days of the week to test conflict tagging
const MOCK_GCAL_EVENTS: { [dayOfWeek: number]: GCalEvent[] } = {
  1: [ // Monday
    { id: "gc-1", title: "Operational Sync", startTime: "09:00", endTime: "10:30", color: "#0ea5e9" },
    { id: "gc-2", title: "Project Alpha Review", startTime: "14:00", endTime: "15:00", color: "#0ea5e9" }
  ],
  2: [ // Tuesday
    { id: "gc-3", title: "Behavioral Design Sprint", startTime: "10:00", endTime: "12:00", color: "#0ea5e9" },
    { id: "gc-4", title: "System Arch Sync", startTime: "15:30", endTime: "17:00", color: "#0ea5e9" }
  ],
  3: [ // Wednesday
    { id: "gc-5", title: "Project planning", startTime: "09:30", endTime: "11:30", color: "#0ea5e9" },
    { id: "gc-6", title: "Daily review", startTime: "16:00", endTime: "17:30", color: "#0ea5e9" }
  ],
  4: [ // Thursday
    { id: "gc-7", title: "Team Retro", startTime: "11:00", endTime: "12:30", color: "#0ea5e9" },
    { id: "gc-8", title: "Focus Deep Dive", startTime: "14:30", endTime: "16:00", color: "#0ea5e9" }
  ],
  5: [ // Friday
    { id: "gc-9", title: "Product Launch Alignment", startTime: "10:30", endTime: "12:00", color: "#0ea5e9" },
    { id: "gc-10", title: "Weekly Retro Beer & Talk", startTime: "17:00", endTime: "18:30", color: "#0ea5e9" }
  ],
  6: [ // Saturday
    { id: "gc-11", title: "Personal Mentor Sync", startTime: "11:00", endTime: "12:00", color: "#0ea5e9" }
  ],
  0: [ // Sunday
    { id: "gc-12", title: "Weekly Reset Prep", startTime: "18:00", endTime: "19:30", color: "#0ea5e9" }
  ]
};

export default function CalendarPage() {
  const { allTasks } = useTrackDailyContext();
  
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
        dayOfWeek: d.getDay(),
      };
    });
  }, []);
  const [gcalConnected, setGcalConnected] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("lifeos_settings_gcal_connected") === "true"
  );
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleToggleGcal = () => {
    const nextVal = !gcalConnected;
    setGcalConnected(nextVal);
    localStorage.setItem("lifeos_settings_gcal_connected", String(nextVal));
    triggerToast(nextVal ? "Google Calendar mock synced!" : "Google Calendar disconnected");
  };

  // Get selected day object
  const activeDayObj = weekDays.find(d => d.dateStr === selectedDate);
  const activeDayOfWeek = activeDayObj ? activeDayObj.dayOfWeek : 1;

  // Get active day's GCal events
  const activeGCalEvents = gcalConnected ? (MOCK_GCAL_EVENTS[activeDayOfWeek] || []) : [];

  // Get active day's TrackDaily tasks
  const activeDayTasks = allTasks.filter(t => t.plannedDate === selectedDate && t.plannedTime);

  // Hour Blocks definition from 6:00 to 23:00
  const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 6 to 23

  // Helper: check if a task falls in a specific hour block
  const getTasksForHour = (hour: number): Task[] => {
    return activeDayTasks.filter(task => {
      if (!task.plannedTime) return false;
      const tHour = parseInt(task.plannedTime.split(":")[0]);
      return tHour === hour;
    });
  };

  // Helper: check if a GCal event overlaps this hour block
  const getGCalEventsForHour = (hour: number): GCalEvent[] => {
    return activeGCalEvents.filter(ev => {
      const startHour = parseInt(ev.startTime.split(":")[0]);
      const endHour = parseInt(ev.endTime.split(":")[0]);
      const endMinutes = parseInt(ev.endTime.split(":")[1]);
      
      const adjustEndHour = endMinutes === 0 ? endHour - 1 : endHour;
      
      return hour >= startHour && hour <= adjustEndHour;
    });
  };

  // Conflict Detection Logic:
  // Returns true if task time string overlaps with any active GCal event's interval
  const hasOverlapConflict = (task: Task): boolean => {
    if (!task.plannedTime || !gcalConnected) return false;
    
    // Parse task time to minutes since midnight
    const [tH, tM] = task.plannedTime.split(":").map(Number);
    const taskMinutes = tH * 60 + tM;

    // Check against all GCal events for this day
    return activeGCalEvents.some(ev => {
      const [sH, sM] = ev.startTime.split(":").map(Number);
      const [eH, eM] = ev.endTime.split(":").map(Number);
      
      const startMinutes = sH * 60 + sM;
      const endMinutes = eH * 60 + eM;

      // Conflict if task falls exactly in the event interval [startMinutes, endMinutes]
      return taskMinutes >= startMinutes && taskMinutes < endMinutes;
    });
  };

  return (
    <div className="flex flex-col gap-6 px-1 animate-slide-up relative text-slate-800">
      {/* Toast alert */}
      {showToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 glass-panel border-sky-500/20 px-4 py-2.5 rounded-xl shadow-md z-50 text-xs font-semibold text-sky-700 flex items-center gap-1.5 animate-slide-down">
          <Check className="h-3.5 w-3.5 text-sky-600" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Selector & Google Calendar Sync Toggle */}
      <div className="glass-panel p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-sky-600 animate-pulse-glow" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-900">Calendar sync</span>
            <span className="text-[9px] text-slate-500 font-mono">Status: {gcalConnected ? "connected" : "offline"}</span>
          </div>
        </div>
        
        <button
          onClick={handleToggleGcal}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest font-mono">Google Calendar</span>
          {gcalConnected ? (
            <ToggleRight className="w-6 h-6 text-sky-500" />
          ) : (
            <ToggleLeft className="w-6 h-6 text-slate-400" />
          )}
        </button>
      </div>

      {/* Week Calendar horizontal navigation */}
      <div className="flex justify-between gap-1.5">
        {weekDays.map(({ dateStr, dayName, dayNum }) => {
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === formatDateString(new Date());

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={`flex-1 py-2.5 rounded-xl flex flex-col items-center gap-1 transition-all duration-300 ${
                isSelected 
                  ? "bg-slate-900 text-white border border-slate-900 shadow-sm" 
                  : "bg-white/80 text-slate-500 border border-slate-200/40 hover:bg-white shadow-sm"
              }`}
            >
              <span className={`text-[8px] font-bold tracking-widest uppercase ${isSelected ? "text-white" : "text-slate-400"}`}>
                {dayName}
              </span>
              <span className={`text-xs w-7 h-7 flex items-center justify-center rounded-lg ${
                isSelected 
                  ? "bg-white/20" 
                  : isToday 
                    ? "border border-sky-500/30 text-sky-600 font-bold bg-sky-50/20" 
                    : ""
              }`}>
                {dayNum}
              </span>
            </button>
          );
        })}
      </div>

      {/* Timeline Schedule Frame */}
      <div className="glass-panel p-5 flex flex-col gap-4 relative overflow-hidden">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-sky-600">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            Daily timeline
          </span>
          <span className="text-[8px] font-mono text-slate-400">RANGE: 06:00 - 23:00</span>
        </div>

        {/* Scrollable vertical grid */}
        <div className="flex flex-col gap-3.5 max-h-[420px] overflow-y-auto pr-1">
          {hours.map(hour => {
            const hourLabel = `${hour.toString().padStart(2, "0")}:00`;
            const slotTasks = getTasksForHour(hour);
            const slotEvents = getGCalEventsForHour(hour);
            const hasData = slotTasks.length > 0 || slotEvents.length > 0;

            return (
              <div key={hour} className="flex gap-3 items-start min-h-12 group">
                {/* Time identifier */}
                <span className="mt-1 w-10 text-right font-mono text-[9px] font-black tracking-wider text-slate-500">
                  {hourLabel}
                </span>

                {/* Timeline Grid Slot block */}
                <div className={`flex-1 flex flex-col gap-2 p-2 rounded-lg border transition-colors ${
                  hasData 
                    ? "bg-white/60 border-slate-200/60 shadow-sm" 
                    : "border-dashed border-slate-200 hover:border-slate-300"
                }`}>
                  
                  {/* Rendering GCal Events */}
                  {slotEvents.map(ev => {
                    const eventStartHour = parseInt(ev.startTime.split(":")[0]);
                    const isStartSlot = eventStartHour === hour;

                    return (
                      <div 
                        key={ev.id}
                        className="relative flex flex-col gap-2 overflow-hidden rounded-lg border border-sky-500/20 bg-sky-500/5 p-2.5 animate-fade-in sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="absolute bottom-0 left-0 top-0 w-1 bg-sky-500"></div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-extrabold text-sky-700 uppercase tracking-wide">
                            {isStartSlot ? ev.title : `${ev.title} (Cont.)`}
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            {ev.startTime} - {ev.endTime}
                          </span>
                        </div>
                        <span className="w-fit rounded border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[8px] font-black uppercase tracking-widest text-sky-700">
                          CALENDAR
                        </span>
                      </div>
                    );
                  })}

                  {/* Rendering TrackDaily Tasks */}
                  {slotTasks.map(task => {
                    const hasConflict = hasOverlapConflict(task);
                    const isDone = task.status === "done" || task.status === "done_late";

                    return (
                      <div 
                        key={task.id}
                        className={`relative flex flex-col gap-2 overflow-hidden rounded-lg border p-2.5 transition-all duration-300 sm:flex-row sm:items-center sm:justify-between ${
                          hasConflict 
                            ? "bg-rose-500/5 border-rose-500/40 shadow-sm animate-pulse" 
                            : isDone
                              ? "bg-emerald-500/5 border-emerald-500/20 opacity-70"
                              : "bg-sky-500/5 border-sky-500/15"
                        }`}
                      >
                        {/* Glowing vertical bar */}
                        <div className={`absolute bottom-0 left-0 top-0 w-1 ${
                          hasConflict ? "bg-rose-500 animate-pulse" : isDone ? "bg-emerald-500" : "bg-sky-500"
                        }`}></div>
                        
                        <div className="flex flex-col gap-0.5 pl-1.5">
                          <span className={`text-[10px] font-bold ${isDone ? "text-slate-500 line-through" : "text-slate-800"}`}>
                            {task.title}
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            Scheduled: {task.plannedTime}
                          </span>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 pl-1.5 sm:justify-end sm:pl-0">
                          {hasConflict && (
                            <span className="text-[8px] bg-rose-500/10 border border-rose-500/20 text-rose-600 px-1.5 py-0.5 rounded font-black tracking-wider flex items-center gap-0.5 animate-pulse">
                              <AlertTriangle className="w-2.5 h-2.5 text-rose-500" />
                              OVERLAP
                            </span>
                          )}
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border ${
                            isDone 
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" 
                              : "bg-sky-500/10 border-sky-500/20 text-sky-600"
                          }`}>
                            {task.category}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {!hasData && (
                    <span className="text-[9px] text-slate-300 font-mono select-none pl-1 py-1">
                      Empty slot
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
