"use client";

import React, { useState } from "react";
import { 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  Zap, 
  PieChart, 
  CheckCircle,
  BarChart3,
  Lightbulb,
  XCircle,
  HelpCircle
} from "lucide-react";
import { useTrackDailyContext } from "@/context/TrackDailyContext";
import { formatDateString } from "../db";

export default function AnalyticsPage() {
  const { allTasks } = useTrackDailyContext();
  const [timeframe, setTimeframe] = useState<7 | 30>(7);

  // --- DATA COMPUTATIONS ---
  const now = new Date();
  
  // 1. Get dates in the selected timeframe
  const targetDates: string[] = [];
  for (let i = timeframe - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    targetDates.push(formatDateString(d));
  }

  // Filter tasks in this timeframe
  const timeframeTasks = allTasks.filter(t => targetDates.includes(t.plannedDate));

  // Basic stats
  const totalCount = timeframeTasks.length;
  const completedTasks = timeframeTasks.filter(t => t.status === "done" || t.status === "done_late");
  const completedCount = completedTasks.length;
  const lateCount = timeframeTasks.filter(t => t.status === "done_late").length;
  const missedCount = timeframeTasks.filter(t => t.status === "missed").length;
  const skippedCount = timeframeTasks.filter(t => t.status === "skipped").length;

  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const lateRate = completedCount > 0 ? Math.round((lateCount / completedCount) * 100) : 0;
  const missedRate = totalCount > 0 ? Math.round((missedCount / totalCount) * 100) : 0;
  const skippedRate = totalCount > 0 ? Math.round((skippedCount / totalCount) * 100) : 0;

  // 2. Bar Chart Data (Daily Completion Percentage)
  const dailyChartData = targetDates.map(dateStr => {
    const dayTasks = allTasks.filter(t => t.plannedDate === dateStr);
    const dayDone = dayTasks.filter(t => t.status === "done" || t.status === "done_late").length;
    const dayTotal = dayTasks.length;
    const pct = dayTotal > 0 ? Math.round((dayDone / dayTotal) * 100) : 0;
    
    // Day label: "Mon", "Tue" etc.
    const dateObj = new Date(dateStr + "T12:00:00");
    const label = dateObj.toLocaleDateString([], { weekday: "short" }).slice(0, 3);
    const dateLabel = dateObj.toLocaleDateString([], { month: "short", day: "numeric" });
    
    return { dateStr, label, dateLabel, pct, total: dayTotal, done: dayDone };
  });

  // 3. Category Distribution (Pie / Donut chart)
  const categoryCounts: { [cat: string]: number } = {};
  timeframeTasks.forEach(task => {
    categoryCounts[task.category] = (categoryCounts[task.category] || 0) + 1;
  });

  const categories = Object.keys(categoryCounts);
  const totalCatCount = categories.reduce((sum, cat) => sum + categoryCounts[cat], 0);

  // Define colors for categories (optimized for light theme)
  const catColors: { [cat: string]: string } = {
    Work: "#6366f1",      // Indigo
    Health: "#10b981",    // Emerald
    Personal: "#06b6d4",  // Cyan
    Other: "#64748b",     // Slate
  };

  const getCatColor = (cat: string) => catColors[cat] || "#f59e0b"; // Amber default

  // Calculate SVG stroke parameters for donut chart segments
  let cumulativePercentage = 0;
  const donutSegments = categories.map(cat => {
    const count = categoryCounts[cat];
    const percentage = totalCatCount > 0 ? (count / totalCatCount) * 100 : 0;
    const startAngle = cumulativePercentage;
    cumulativePercentage += percentage;
    return {
      category: cat,
      count,
      percentage: Math.round(percentage),
      startAngle,
      color: getCatColor(cat)
    };
  });

  // 4. Behavioral insights
  const uniqueDaysPlanned = Array.from(new Set(allTasks.map(t => t.plannedDate)));
  const totalTasksPlanned = allTasks.length;
  const avgPlannedPerDay = uniqueDaysPlanned.length > 0 ? (totalTasksPlanned / uniqueDaysPlanned.length) : 0;
  const isOverplanning = avgPlannedPerDay > 7;

  const blockers: { reason: string; count: number } = { reason: "", count: 0 };
  const blockerCounts: { [reason: string]: number } = {};

  allTasks.forEach(t => {
    if (t.delayReason && t.delayReason.trim().toLowerCase() !== "carried forward during end of day review") {
      blockerCounts[t.delayReason] = (blockerCounts[t.delayReason] || 0) + 1;
    }
    if (t.skipReason && t.skipReason.trim()) {
      blockerCounts[t.skipReason] = (blockerCounts[t.skipReason] || 0) + 1;
    }
  });

  Object.keys(blockerCounts).forEach(reason => {
    if (blockerCounts[reason] > blockers.count) {
      blockers.reason = reason;
      blockers.count = blockerCounts[reason];
    }
  });

  return (
    <div className="flex flex-col gap-6 px-1 animate-slide-up relative text-slate-800">
      {/* Header and timeframe selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-sky-600" />
          <h2 className="text-sm font-semibold text-slate-950 tracking-wide">Analytics</h2>
        </div>

        {/* Timeframe switch */}
        <div className="bg-slate-200/60 p-0.5 rounded-lg border border-slate-300/40 flex shadow-inner">
          <button
            onClick={() => setTimeframe(7)}
            className={`px-3 py-1 text-[10px] font-black uppercase rounded transition-all ${
              timeframe === 7
                ? "bg-white border border-slate-200 text-sky-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeframe(30)}
            className={`px-3 py-1 text-[10px] font-black uppercase rounded transition-all ${
              timeframe === 30
                ? "bg-white border border-slate-200 text-sky-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* Metrics Panel Grid */}
      <div className="grid grid-cols-2 gap-3.5">
        <div className="glass-panel p-4 rounded-2xl border border-slate-200/50 flex flex-col gap-1 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-sky-500/20 rounded-bl-md"></div>
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            Completed
          </span>
          <span className="text-2xl font-black text-slate-800 font-mono mt-1 tracking-tight">{completionRate}%</span>
          <span className="text-[10px] text-slate-500 mt-1">{completedCount} of {totalCount} tasks</span>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-200/50 flex flex-col gap-1 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-sky-500/20 rounded-bl-md"></div>
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Done Late
          </span>
          <span className="text-2xl font-black text-slate-800 font-mono mt-1 tracking-tight">{lateRate}%</span>
          <span className="text-[10px] text-slate-500 mt-1">{lateCount} tasks delayed</span>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-200/50 flex flex-col gap-1 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-rose-500/20 rounded-bl-md"></div>
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            Missed Rate
          </span>
          <span className="text-2xl font-black text-slate-800 font-mono mt-1 tracking-tight">{missedRate}%</span>
          <span className="text-[10px] text-slate-500 mt-1">{missedCount} tasks missed</span>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-200/50 flex flex-col gap-1 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-slate-500/20 rounded-bl-md"></div>
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            Skipped Rate
          </span>
          <span className="text-2xl font-black text-slate-800 font-mono mt-1 tracking-tight">{skippedRate}%</span>
          <span className="text-[10px] text-slate-500 mt-1">{skippedCount} bypassed</span>
        </div>
      </div>

      {/* SVG Bar Chart: Weekly Performance History */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-200/50 flex flex-col gap-4 relative overflow-hidden shadow-sm scanline">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-sky-600">
            <BarChart3 className="h-3.5 w-3.5 text-sky-600" />
            Completion trend
          </span>
          <span className="font-mono text-[8px] text-slate-500">UNIT: % COMPLETED</span>
        </div>

        {totalCount > 0 ? (
          <div className="h-36 flex items-end justify-between px-2 pt-6 relative border-b border-slate-100">
            {dailyChartData.map((d) => (
              <div key={d.dateStr} className="flex flex-col items-center gap-2 w-full group relative">
                
                {/* Value tooltip on hover */}
                <div className="absolute -top-6 bg-sky-50/90 border border-sky-200/60 text-sky-700 text-[8px] font-mono px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  {d.done}/{d.total} Done ({d.pct}%)
                </div>

                {/* Cyber glass bar */}
                <div className="w-6 sm:w-8 bg-slate-100/80 border border-slate-200/40 rounded-t-lg relative h-28 flex items-end overflow-hidden shadow-inner">
                  <div 
                    className="bg-sky-600 w-full rounded-t-md transition-all duration-700 ease-out" 
                    style={{ height: `${d.pct}%` }}
                  ></div>
                </div>
                
                {/* Horizontal label */}
                <div className="flex flex-col items-center">
                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">{d.label}</span>
                  <span className="text-[7px] text-slate-500 font-semibold font-mono mt-0.5">{d.dateLabel.split(" ")[1]}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-slate-200/80 text-xs text-slate-500">
            No task data recorded in this range.
          </div>
        )}
      </div>

      {/* SVG Donut Chart: Category Distribution */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-200/50 flex flex-col gap-4 relative overflow-hidden shadow-sm">
        <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-sky-600">
          <PieChart className="h-3.5 w-3.5 text-sky-600" />
          Category distribution
        </span>

        {totalCatCount > 0 ? (
          <div className="flex flex-col gap-5 py-2 sm:flex-row sm:items-center sm:gap-6">
            {/* SVG circle rendering */}
            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
              <svg width="96" height="96" viewBox="0 0 36 36" className="transform -rotate-90">
                {/* Donut Background */}
                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="3" />
                
                {/* Donut segments */}
                {donutSegments.map((segment) => {
                  const strokeDash = `${segment.percentage} ${100 - segment.percentage}`;
                  return (
                    <circle
                      key={segment.category}
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="transparent"
                      stroke={segment.color}
                      strokeWidth="3.2"
                      strokeDasharray={strokeDash}
                      strokeDashoffset={100 - segment.startAngle}
                      className="transition-all duration-500 hover:stroke-[3.8]"
                    />
                  );
                })}
              </svg>
              <div className="absolute flex flex-col items-center text-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Total</span>
                <span className="text-sm font-black text-slate-800 font-mono">{totalCatCount}</span>
              </div>
            </div>

            {/* Custom Legend */}
            <div className="flex flex-1 flex-col gap-2">
              {donutSegments.map(seg => (
                <div key={seg.category} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-md border border-white/50 shrink-0" style={{ backgroundColor: seg.color }}></span>
                    <span className="font-bold text-slate-700">{seg.category}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-500">{seg.percentage}% <span className="font-sans text-[8px] font-normal">({seg.count})</span></span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200/80 py-8 text-center text-xs text-slate-500">
            No categories logged.
          </div>
        )}
      </div>

      {/* Behavioral insights */}
      <div className="glass-panel p-5 rounded-2xl border border-sky-500/10 flex flex-col gap-4 relative overflow-hidden shadow-sm scanline">
        <span className="text-[9px] text-sky-600 font-bold uppercase tracking-widest flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-sky-600" />
          Behavioral insights
        </span>

        <div className="flex flex-col gap-4">
          {/* Overplanning Alarm Notification */}
          {isOverplanning ? (
            <div className="bg-rose-500/5 border border-rose-500/20 p-3.5 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wide">Overplanning risk</span>
                <p className="text-[10px] text-slate-600 leading-normal">
                  You are scheduling an average of <span className="font-bold text-slate-800 font-mono">{avgPlannedPerDay.toFixed(1)}</span> tasks/day. Consider reducing the daily load when it rises above 7 tasks.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-500/5 border border-emerald-500/20 p-3.5 rounded-xl flex items-start gap-2.5">
              <Zap className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wide">Workload Calibrated</span>
                <p className="text-[10px] text-slate-600 leading-normal">
                  You are scheduling an average of <span className="font-bold text-slate-800 font-mono">{avgPlannedPerDay.toFixed(1)}</span> tasks/day. Workload is currently within a manageable range.
                </p>
              </div>
            </div>
          )}

          {/* Blocker Analysis Notification */}
          {blockers.count > 0 ? (
            <div className="bg-slate-100/50 border border-slate-200/50 p-3.5 rounded-xl flex items-start gap-2.5 shadow-inner">
              <TrendingUp className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-sky-600">Flow Bottleneck Detected</span>
                <p className="text-[10px] text-slate-600 leading-normal">
                  The blocker <span className="font-bold text-sky-700 italic">&quot;{blockers.reason}&quot;</span> was logged <span className="font-bold text-slate-800 font-mono">{blockers.count}</span> times. Address it to improve completion.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-100/50 border border-slate-200/50 p-3.5 rounded-xl flex items-start gap-2.5 shadow-inner">
              <TrendingUp className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">No recurring blocker</span>
                <p className="text-[10px] text-slate-400 leading-normal">
                  No repeating delay reasons detected in this range.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
