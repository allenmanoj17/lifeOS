"use client";

import React, { useState, useEffect } from "react";
import { 
  Trash2, 
  Plus, 
  Clock, 
  Calendar, 
  Download, 
  Upload, 
  Check, 
  Database,
  Globe,
  BellRing,
  ShieldAlert,
  ShieldQuestion
} from "lucide-react";
import { useUser, useClerk } from "@clerk/nextjs";
import { 
  getCategories, 
  saveCategories, 
  getAllTasks, 
  saveAllTasks 
} from "../db";
import { useTrackDailyContext } from "@/context/TrackDailyContext";

const hasClerk = typeof window !== "undefined" && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Separate sub-component to use Clerk hooks safely only when provider is mounted
function ClerkProfileCard() {
  const { user } = useUser();
  const { signOut } = useClerk();

  if (!user) {
    return (
      <div className="glass-panel p-5 rounded-2xl border border-slate-200/40 flex items-center justify-center">
        <div className="w-5 h-5 border border-indigo-650 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-5 rounded-2xl border border-indigo-500/10 shadow-sm flex items-center justify-between gap-4 relative overflow-hidden scanline">
      <div className="flex items-center gap-3">
        {user.imageUrl ? (
          <img 
            src={user.imageUrl} 
            alt="User avatar" 
            className="w-10 h-10 rounded-full border border-indigo-500/20 shadow-sm" 
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-indigo-500/5 border border-indigo-500/20 flex items-center justify-center font-bold text-xs text-indigo-650">
            {user.firstName?.slice(0, 1) || "U"}
          </div>
        )}
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-800 leading-tight">
            {user.fullName || user.primaryEmailAddress?.emailAddress.split("@")[0]}
          </span>
          <span className="text-[10px] text-indigo-650/70 font-mono mt-0.5">
            {user.primaryEmailAddress?.emailAddress}
          </span>
        </div>
      </div>
      <button
        onClick={() => signOut()}
        className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/35 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer shadow-sm"
      >
        Sign Out
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { allTasks, isConvex } = useTrackDailyContext();
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [eveningTime, setEveningTime] = useState("21:00");
  const [weeklyDay, setWeeklyDay] = useState("Sunday");
  const [weeklyTime, setWeeklyTime] = useState("19:00");
  const [reminderOffset, setReminderOffset] = useState("10");
  const [gcalConnected, setGcalConnected] = useState(false);
  const [timezone, setTimezone] = useState("Auto");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Notification permission state
  const [notifPermission, setNotifPermission] = useState<"default" | "granted" | "denied" | "unsupported">("default");

  useEffect(() => {
    // Load configurations from localStorage on mount
    setCategories(getCategories());
    
    setEveningTime(localStorage.getItem("lifeos_settings_evening_time") || "21:00");
    setWeeklyDay(localStorage.getItem("lifeos_settings_weekly_day") || "Sunday");
    setWeeklyTime(localStorage.getItem("lifeos_settings_weekly_time") || "19:00");
    setReminderOffset(localStorage.getItem("lifeos_settings_reminder_offset") || "10");
    setGcalConnected(localStorage.getItem("lifeos_settings_gcal_connected") === "true");
    
    // Auto-detect timezone
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch (e) {
      setTimezone("System Default");
    }

    // Check notification support & permission
    if (typeof window !== "undefined") {
      if (!("Notification" in window)) {
        setNotifPermission("unsupported");
      } else {
        setNotifPermission(Notification.permission);
      }
    }
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const requestNotifPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    
    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission === "granted") {
        triggerToast("Notification permission granted!");
        new Notification("Notifications Enabled", {
          body: "You will receive evening and weekly review notifications.",
          icon: "/icon-192.png"
        });
      } else {
        triggerToast("Notification permission denied");
      }
    } catch (err) {
      triggerToast("Failed to request permission");
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      triggerToast("Category already exists");
      return;
    }
    const updated = [...categories, trimmed];
    setCategories(updated);
    saveCategories(updated);
    setNewCategory("");
    triggerToast("Category added successfully");
  };

  const handleDeleteCategory = (catToDelete: string) => {
    if (categories.length <= 1) {
      triggerToast("You must keep at least one category");
      return;
    }
    const updated = categories.filter(c => c !== catToDelete);
    setCategories(updated);
    saveCategories(updated);
    triggerToast("Category deleted");
  };

  const saveSetting = (key: string, val: string) => {
    localStorage.setItem(key, val);
    triggerToast("Setting updated");
  };

  // Export Data
  const handleExportData = () => {
    const tasksToExport = isConvex ? allTasks : getAllTasks();
    const dataStr = JSON.stringify({
      version: "1.0",
      exportDate: new Date().toISOString(),
      tasks: tasksToExport,
      categories: categories,
      settings: {
        eveningTime,
        weeklyDay,
        weeklyTime,
        reminderOffset
      }
    }, null, 2);

    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lifeos_trackdaily_export_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast("Data exported successfully");
  };

  // Import Data
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.tasks && Array.isArray(parsed.tasks)) {
          // Merge tasks avoiding duplicates
          const currentTasks = getAllTasks();
          const mergedTasks = [...currentTasks];
          
          let importCount = 0;
          parsed.tasks.forEach((impTask: any) => {
            if (!mergedTasks.some(t => t.id === impTask.id)) {
              mergedTasks.push(impTask);
              importCount++;
            }
          });
          
          saveAllTasks(mergedTasks);
          
          if (parsed.categories && Array.isArray(parsed.categories)) {
            const mergedCategories = Array.from(new Set([...categories, ...parsed.categories]));
            setCategories(mergedCategories);
            saveCategories(mergedCategories);
          }

          triggerToast(`Imported ${importCount} new tasks`);
        } else {
          triggerToast("Invalid backup file format");
        }
      } catch (err) {
        triggerToast("Failed to parse JSON backup");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col gap-6 px-1 animate-slide-up relative text-slate-800">
      {/* Toast Alert */}
      {showToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 glass-panel border-indigo-500/20 px-4 py-2.5 rounded-xl shadow-md z-50 text-xs font-semibold text-indigo-700 flex items-center gap-1.5 animate-slide-down">
          <Check className="w-3.5 h-3.5 text-indigo-650" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Profile Card Section */}
      {isConvex && hasClerk ? (
        <ClerkProfileCard />
      ) : (
        /* Static Offline Profile for Local Storage mode */
        <div className="glass-panel p-5 rounded-2xl border border-slate-200/50 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-500 font-mono tracking-tighter">
              LOC
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-700 leading-tight">Local Commander</span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5">Offline Local Profile</span>
            </div>
          </div>
          <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-500 px-3 py-1 rounded-lg font-bold tracking-widest font-mono uppercase">
            LOCAL
          </span>
        </div>
      )}

      {/* Category Editor */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-200/50 flex flex-col gap-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 tracking-wide">Task Categories</h3>
        
        {/* Current list */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <div 
              key={cat} 
              className="flex items-center gap-2 text-xs bg-white border border-slate-200/60 text-slate-700 px-3 py-1.5 rounded-xl shadow-inner transition-all hover:border-indigo-500/20"
            >
              <span>{cat}</span>
              <button 
                onClick={() => handleDeleteCategory(cat)}
                className="text-slate-400 hover:text-rose-500 transition-colors p-0.5"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Add new */}
        <form onSubmit={handleAddCategory} className="flex gap-2 mt-2">
          <input 
            type="text" 
            placeholder="New category..." 
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="flex-1 glass-input text-xs px-3 py-2.5 text-slate-800 placeholder:text-slate-400"
            maxLength={18}
          />
          <button 
            type="submit"
            className="bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/15 hover:border-indigo-500/30 text-indigo-650 text-xs px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </form>
      </div>

      {/* Reminders Preferences */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-200/50 flex flex-col gap-5 shadow-sm">
        <div className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-indigo-600 animate-pulse" />
            <h3 className="text-sm font-bold text-slate-800 tracking-wide">Reminder Preferences</h3>
          </div>
          {notifPermission === "granted" && (
            <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping"></span>
              ENABLED
            </span>
          )}
        </div>

        <div className="flex flex-col gap-4 text-xs">
          {/* Permission Requester Button */}
          {notifPermission !== "granted" && (
            <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200/50 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-2">
                {notifPermission === "denied" ? (
                  <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                ) : (
                  <ShieldQuestion className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    {notifPermission === "denied" ? "Permission Denied" : "Enable Push Notifications"}
                  </span>
                  <span className="text-[10px] text-slate-500 leading-normal">
                    {notifPermission === "denied" 
                      ? "Notifications are blocked by your browser settings." 
                      : "Request runtime permission to sync PWA system reminders."}
                  </span>
                </div>
              </div>
              
              {notifPermission !== "denied" && notifPermission !== "unsupported" && (
                <button
                  onClick={requestNotifPermission}
                  className="bg-indigo-650 hover:bg-indigo-700 text-white text-[10px] font-extrabold uppercase px-3.5 py-2 rounded-lg transition-all shrink-0 shadow-md cursor-pointer"
                >
                  Enable
                </button>
              )}
            </div>
          )}

          {/* Evening reminder */}
          <div className="flex items-center justify-between py-1 border-b border-slate-100 pb-2">
            <span className="text-slate-600">Evening planning reminder</span>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <input 
                type="time" 
                value={eveningTime}
                onChange={(e) => {
                  setEveningTime(e.target.value);
                  saveSetting("lifeos_settings_evening_time", e.target.value);
                }}
                className="bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-800 text-[11px] font-bold focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Weekly review reminder */}
          <div className="flex items-center justify-between py-1 border-b border-slate-100 pb-2">
            <span className="text-slate-600">Weekly review reminder</span>
            <div className="flex items-center gap-1.5">
              <select
                value={weeklyDay}
                onChange={(e) => {
                  setWeeklyDay(e.target.value);
                  saveSetting("lifeos_settings_weekly_day", e.target.value);
                }}
                className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 text-[11px] font-bold focus:outline-none focus:border-indigo-500"
              >
                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
              <input 
                type="time" 
                value={weeklyTime}
                onChange={(e) => {
                  setWeeklyTime(e.target.value);
                  saveSetting("lifeos_settings_weekly_time", e.target.value);
                }}
                className="bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-800 text-[11px] font-bold focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Default offset */}
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-600">Default task reminder offset</span>
            <select
              value={reminderOffset}
              onChange={(e) => {
                setReminderOffset(e.target.value);
                saveSetting("lifeos_settings_reminder_offset", e.target.value);
              }}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 text-[11px] font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="0">0 min before</option>
              <option value="5">5 min before</option>
              <option value="10">10 min before</option>
              <option value="15">15 min before</option>
              <option value="30">30 min before</option>
            </select>
          </div>
        </div>
      </div>

      {/* Google Calendar Sync Card */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-200/50 flex flex-col gap-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-650" />
            <h3 className="text-sm font-bold text-slate-800 tracking-wide">Google Calendar Integration</h3>
          </div>
          <span className="text-[9px] bg-sky-500/10 border border-sky-500/20 text-sky-600 px-2 py-0.5 rounded-md font-bold tracking-widest uppercase">
            SYNC MATRIX
          </span>
        </div>
        
        <p className="text-xs text-slate-500 leading-relaxed">
          Embed Google Calendar read-only timeline data alongside TrackDaily scheduler blocks to automatically alert and tag time-slice overlaps.
        </p>

        <button 
          onClick={() => {
            const next = !gcalConnected;
            setGcalConnected(next);
            saveSetting("lifeos_settings_gcal_connected", String(next));
            triggerToast(next ? "Google Calendar Synced (Mock)" : "Google Calendar Sync Disconnected");
          }}
          className={`w-full py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            gcalConnected 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/20" 
              : "bg-indigo-500/10 border-indigo-500/20 text-indigo-650 hover:bg-indigo-500/20 hover:border-indigo-500/30"
          }`}
        >
          {gcalConnected ? "Connected (Disable)" : "Sync Google Calendar"}
        </button>
      </div>

      {/* Import / Export & Storage info */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-200/50 flex flex-col gap-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-800 tracking-wide">Data Core Portability</h3>
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={handleExportData}
            className="w-full py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-750 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4 text-indigo-600" />
            <span>Export Cortex Backup</span>
          </button>

          <label className="w-full py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-755 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center shadow-sm">
            <Upload className="w-4 h-4 text-sky-600" />
            <span>Import Backup Stream</span>
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImportData}
              className="hidden" 
            />
          </label>
        </div>
      </div>

      {/* System Status info */}
      <div className="flex items-center justify-between text-[9px] font-mono text-slate-450 px-1 mt-2">
        <div className="flex items-center gap-1">
          <Globe className="w-3 h-3 text-slate-500" />
          <span>ZONE: {timezone}</span>
        </div>
        <span>CORE STORAGE: {isConvex ? "CONVEX REALTIME" : "LOCAL CACHE"}</span>
      </div>
    </div>
  );
}
