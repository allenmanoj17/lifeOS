"use client";

import React, { useState } from "react";
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
import { getCategories, saveCategories } from "../db";
import type { Task } from "../types";
import { useTrackDailyContext } from "@/context/TrackDailyContext";

type ImportedTask = Partial<Task>;
type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

function readLocalSetting(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) || fallback;
}

function readBooleanSetting(key: string) {
  return typeof window !== "undefined" && localStorage.getItem(key) === "true";
}

function detectTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "System Default";
  }
}

function readNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

// Separate sub-component to use Clerk hooks safely only when provider is mounted
function ClerkProfileCard() {
  const { user } = useUser();
  const { signOut } = useClerk();

  if (!user) {
    return (
      <div className="glass-panel p-5 rounded-2xl border border-slate-200/40 flex items-center justify-center">
        <div className="w-5 h-5 border border-sky-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-5 rounded-2xl border border-sky-500/10 shadow-sm flex items-center justify-between gap-4 relative overflow-hidden scanline">
      <div className="flex items-center gap-3">
        {user.imageUrl ? (
          <div
            aria-label="User avatar"
            className="w-10 h-10 rounded-full border border-sky-500/20 shadow-sm bg-cover bg-center"
            style={{ backgroundImage: `url(${user.imageUrl})` }}
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-sky-500/5 border border-sky-500/20 flex items-center justify-center font-bold text-xs text-sky-600">
            {user.firstName?.slice(0, 1) || "U"}
          </div>
        )}
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-800 leading-tight">
            {user.fullName || user.primaryEmailAddress?.emailAddress.split("@")[0]}
          </span>
          <span className="text-[10px] text-sky-600/70 font-mono mt-0.5">
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
  const { allTasks, createTask } = useTrackDailyContext();
  const [categories, setCategories] = useState<string[]>(getCategories);
  const [newCategory, setNewCategory] = useState("");
  const [eveningTime, setEveningTime] = useState(() => readLocalSetting("lifeos_settings_evening_time", "21:00"));
  const [weeklyDay, setWeeklyDay] = useState(() => readLocalSetting("lifeos_settings_weekly_day", "Sunday"));
  const [weeklyTime, setWeeklyTime] = useState(() => readLocalSetting("lifeos_settings_weekly_time", "19:00"));
  const [reminderOffset, setReminderOffset] = useState(() => readLocalSetting("lifeos_settings_reminder_offset", "10"));
  const [gcalConnected, setGcalConnected] = useState(() => readBooleanSetting("lifeos_settings_gcal_connected"));
  const [timezone] = useState(detectTimezone);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>(readNotificationPermission);

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
    } catch {
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
    const dataStr = JSON.stringify({
      version: "1.0",
      exportDate: new Date().toISOString(),
      tasks: allTasks,
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
      void (async () => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.tasks && Array.isArray(parsed.tasks)) {
          let importCount = 0;
          for (const imported of parsed.tasks as ImportedTask[]) {
            if (!imported.title || !imported.category || !imported.plannedDate) {
              continue;
            }

            const isDuplicate = allTasks.some(
              (task) =>
                task.title === imported.title &&
                task.plannedDate === imported.plannedDate &&
                task.plannedTime === imported.plannedTime
            );
            if (isDuplicate) continue;

            await createTask({
              title: imported.title,
              notes: imported.notes,
              category: imported.category,
              plannedDate: imported.plannedDate,
              plannedTime: imported.plannedTime,
              status: imported.status ?? "planned",
              completedAt: imported.completedAt,
              delayReason: imported.delayReason,
              skipReason: imported.skipReason,
              checklist: imported.checklist,
              isRecurring: imported.isRecurring ?? false,
              recurringRule: imported.recurringRule,
              reminderId: imported.reminderId,
            });
            importCount++;
          }
          
          if (parsed.categories && Array.isArray(parsed.categories)) {
            const importedCategories = parsed.categories.filter(
              (category: unknown): category is string => typeof category === "string"
            );
            const mergedCategories = Array.from(new Set([...categories, ...importedCategories]));
            setCategories(mergedCategories);
            saveCategories(mergedCategories);
          }

          triggerToast(`Imported ${importCount} new tasks`);
        } else {
          triggerToast("Invalid backup file format");
        }
      } catch {
        triggerToast("Failed to parse JSON backup");
      }
      })();
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col gap-6 px-1 animate-slide-up relative text-slate-800">
      {/* Toast Alert */}
      {showToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 glass-panel border-sky-500/20 px-4 py-2.5 rounded-xl shadow-md z-50 text-xs font-semibold text-sky-700 flex items-center gap-1.5 animate-slide-down">
          <Check className="w-3.5 h-3.5 text-sky-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      <ClerkProfileCard />

      {/* Category Editor */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-200/50 flex flex-col gap-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 tracking-wide">Task Categories</h3>
        
        {/* Current list */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <div 
              key={cat} 
              className="flex items-center gap-2 text-xs bg-white border border-slate-200/60 text-slate-700 px-3 py-1.5 rounded-xl shadow-inner transition-all hover:border-sky-500/20"
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
            className="bg-sky-500/5 hover:bg-sky-500/10 border border-sky-500/15 hover:border-sky-500/30 text-sky-600 text-xs px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
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
            <BellRing className="w-4 h-4 text-sky-500 animate-pulse" />
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
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200/50 bg-slate-100/50 p-4 shadow-inner sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                {notifPermission === "denied" ? (
                  <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                ) : (
                  <ShieldQuestion className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
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
                  className="bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-extrabold uppercase px-3.5 py-2 rounded-lg transition-all shrink-0 shadow-md cursor-pointer"
                >
                  Enable
                </button>
              )}
            </div>
          )}

          {/* Evening reminder */}
          <div className="flex flex-col gap-2 border-b border-slate-100 py-1 pb-2 sm:flex-row sm:items-center sm:justify-between">
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
                className="bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-800 text-[11px] font-bold focus:outline-none focus:border-sky-400 font-mono"
              />
            </div>
          </div>

          {/* Weekly review reminder */}
          <div className="flex flex-col gap-2 border-b border-slate-100 py-1 pb-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-600">Weekly review reminder</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={weeklyDay}
                onChange={(e) => {
                  setWeeklyDay(e.target.value);
                  saveSetting("lifeos_settings_weekly_day", e.target.value);
                }}
                className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 text-[11px] font-bold focus:outline-none focus:border-sky-400"
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
                className="bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-800 text-[11px] font-bold focus:outline-none focus:border-sky-400 font-mono"
              />
            </div>
          </div>

          {/* Default offset */}
          <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-600">Default task reminder offset</span>
            <select
              value={reminderOffset}
              onChange={(e) => {
                setReminderOffset(e.target.value);
                saveSetting("lifeos_settings_reminder_offset", e.target.value);
              }}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 text-[11px] font-bold focus:outline-none focus:border-sky-400"
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
            <Calendar className="h-4 w-4 text-sky-600" />
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
              : "bg-sky-500/10 border-sky-500/20 text-sky-600 hover:bg-sky-500/20 hover:border-sky-500/30"
          }`}
        >
          {gcalConnected ? "Connected (Disable)" : "Sync Google Calendar"}
        </button>
      </div>

      {/* Import / Export & Storage info */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-200/50 flex flex-col gap-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-sky-500" />
          <h3 className="text-sm font-bold text-slate-800 tracking-wide">Data Core Portability</h3>
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={handleExportData}
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
          >
            <Download className="w-4 h-4 text-sky-500" />
            <span>Export backup</span>
          </button>

          <label className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-center text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50">
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
      <div className="mt-2 flex flex-col gap-2 px-1 font-mono text-[9px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          <Globe className="w-3 h-3 text-slate-500" />
          <span>ZONE: {timezone}</span>
        </div>
        <span>CORE STORAGE: CONVEX REALTIME</span>
      </div>
    </div>
  );
}
