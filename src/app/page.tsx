"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Activity, 
  Lock, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  BookOpen, 
  DollarSign, 
  Heart,
  ChevronRight
} from "lucide-react";
import { formatDateString } from "./trackdaily/db";
import { useTrackDailyContext } from "@/context/TrackDailyContext";

export default function LifeOSHub() {
  const [time, setTime] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [greeting, setGreeting] = useState("Welcome");
  const [mounted, setMounted] = useState(false);

  // Dynamically query today's date tasks from shared context
  const todayStr = formatDateString(new Date());
  const { allTasks } = useTrackDailyContext();
  const tasks = allTasks.filter(t => t.plannedDate === todayStr);

  useEffect(() => {
    setMounted(true);
    
    // Live Clock & Greeting
    const updateDateTime = () => {
      const now = new Date();
      
      // Formatting time
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
      
      // Formatting date
      setDateStr(now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }));
      
      // Dynamic Greeting
      const hr = now.getHours();
      if (hr < 12) setGreeting("Good morning");
      else if (hr < 17) setGreeting("Good afternoon");
      else setGreeting("Good evening");
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  const completed = tasks.filter(t => t.status === "done" || t.status === "done_late").length;
  const total = tasks.length;
  const stats = { completed, total };

  if (!mounted) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center text-slate-400">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pt-8 pb-12 animate-fade-in relative">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Cyber Header Widget */}
      <div className="flex flex-col mb-8 glass-panel p-6 rounded-2xl relative overflow-hidden shadow-md border border-indigo-500/15 scanline">
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none"></div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-bold tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse-glow" />
            <span className="glow-purple">LifeOS Mainframe</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600 text-xs font-semibold bg-white/60 px-2.5 py-1 rounded-lg border border-slate-200/50">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-mono text-[11px] tracking-wider text-indigo-600">{time}</span>
          </div>
        </div>
        
        <h1 className="text-3xl font-black tracking-tight mt-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent">
          {greeting}, Commander
        </h1>
        <p className="text-xs text-indigo-600/70 font-bold tracking-wider uppercase mt-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping"></span>
          {dateStr}
        </p>
      </div>

      {/* Main Apps Sections */}
      <div className="flex-1 flex flex-col gap-5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Operational Modules</h2>
          <span className="text-[9px] bg-indigo-500/5 border border-indigo-500/15 text-indigo-600 px-2 py-0.5 rounded-md font-bold tracking-wider uppercase">
            SYS ONLINE
          </span>
        </div>

        {/* TrackDaily Module Card (Active) */}
        <Link href="/trackdaily" className="block focus:outline-none">
          <div className="glass-card p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between group cursor-pointer border border-indigo-500/10 hover:border-indigo-500/25 shadow-sm hover:shadow-md">
            {/* Cyberpunk corner details */}
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-indigo-500/30 rounded-tr-md"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-indigo-500/30 rounded-bl-md"></div>
            
            {/* Hover visual gradient flare */}
            <div className="absolute right-0 top-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-sky-500/5 rounded-bl-full opacity-40 group-hover:scale-110 transition-transform duration-500 pointer-events-none blur-md"></div>
            
            <div className="flex items-start justify-between">
              <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-indigo-600 group-hover:bg-indigo-500/10 group-hover:text-indigo-700 transition-colors shadow-inner">
                <Activity className="w-6 h-6 animate-pulse-glow" />
              </div>
              <span className="text-[9px] bg-sky-500/10 border border-sky-500/15 text-sky-600 px-2 py-0.5 rounded-md font-black tracking-widest">
                CORE LOADED
              </span>
            </div>

            <div className="mt-5">
              <h3 className="text-xl font-bold text-slate-800 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                TrackDaily
                <ChevronRight className="w-4 h-4 text-indigo-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Autonomous daily tracking console. Sync goals with a real-time Convex DB, evaluate habits, and review insights.
              </p>
            </div>

            {/* Quick Stats display */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-500">
                <CheckCircle2 className="w-4 h-4 text-sky-500" />
                <span className="font-semibold text-slate-500">Daily Cortex Progress</span>
              </div>
              <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/55">
                {stats.total > 0 ? `${stats.completed}/${stats.total} Tasks` : "No plans logged"}
              </span>
            </div>
            
            {stats.total > 0 && (
              <div className="w-full bg-slate-200/60 h-2 rounded-full mt-4 overflow-hidden border border-slate-200/20">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-sky-400 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(99,102,241,0.2)]" 
                  style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                ></div>
              </div>
            )}
          </div>
        </Link>

        {/* Future Modules section */}
        <div className="flex items-center mt-6 px-1">
          <h2 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Encrypted Subsystems</h2>
        </div>

        {/* Inactive Module: Journal */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200/40 opacity-70 relative overflow-hidden select-none">
          <div className="absolute right-4 top-4 flex items-center gap-1.5 text-slate-400 font-mono text-[9px]">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>ENCRYPTED</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-slate-100 border border-slate-200/50 rounded-xl text-slate-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-600">MindJournal</h4>
              <p className="text-xs text-slate-500 mt-1">Reflective thoughts, mood maps & morning reviews.</p>
            </div>
          </div>
        </div>

        {/* Inactive Module: Finance */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200/40 opacity-70 relative overflow-hidden select-none">
          <div className="absolute right-4 top-4 flex items-center gap-1.5 text-slate-400 font-mono text-[9px]">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>ENCRYPTED</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-slate-100 border border-slate-200/50 rounded-xl text-slate-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-600">FinanceFlow</h4>
              <p className="text-xs text-slate-500 mt-1">Autonomous wallet mapper, spending triggers & target pools.</p>
            </div>
          </div>
        </div>

        {/* Inactive Module: Health */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200/40 opacity-70 relative overflow-hidden select-none">
          <div className="absolute right-4 top-4 flex items-center gap-1.5 text-slate-400 font-mono text-[9px]">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>ENCRYPTED</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-slate-100 border border-slate-200/50 rounded-xl text-slate-400">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-600">HealthSync</h4>
              <p className="text-xs text-slate-500 mt-1">Sleep analysis matrix, biometric indicators & fitness logs.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
