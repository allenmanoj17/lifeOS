"use client";

import React, { useMemo, useState } from "react";
import {
  BellRing,
  Calendar,
  Check,
  Database,
  Download,
  Globe,
  Plus,
  ShieldAlert,
  ShieldQuestion,
  Trash2,
  Upload,
} from "lucide-react";
import { useClerk, useUser } from "@clerk/nextjs";
import { getCategories, saveCategories } from "../db";
import type { CalendarEvent, ReminderSettings, Task } from "../types";
import { useTrackDailyContext } from "@/context/TrackDailyContext";

type ImportedTask = Partial<Task>;
type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

function detectTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function readNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

const defaultSettings = (timezone: string): ReminderSettings => ({
  taskReminderOffsetMinutes: 10,
  eveningReviewEnabled: true,
  eveningReviewTime: "21:00",
  weeklyReviewEnabled: true,
  weeklyReviewDay: 0,
  weeklyReviewTime: "19:00",
  timezone,
});

function ClerkProfileCard() {
  const { user } = useUser();
  const { signOut } = useClerk();

  if (!user) {
    return (
      <div className="glass-panel p-5 flex items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="glass-panel flex items-center justify-between gap-4 p-5">
      <div className="flex min-w-0 items-center gap-3">
        {user.imageUrl ? (
          <div
            aria-label="User avatar"
            className="h-10 w-10 rounded-full border border-border bg-cover bg-center"
            style={{ backgroundImage: `url(${user.imageUrl})` }}
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {user.firstName?.slice(0, 1) || "U"}
          </div>
        )}
        <div className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">
            {user.fullName || user.primaryEmailAddress?.emailAddress.split("@")[0]}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {user.primaryEmailAddress?.emailAddress}
          </span>
        </div>
      </div>
      <button
        onClick={() => signOut()}
        className="rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-destructive transition-colors hover:bg-destructive/15"
      >
        Sign Out
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const {
    allTasks,
    calendarState,
    createTask,
    pushSubscriptionsCount,
    registerPushSubscription,
    reminderSettings,
    replaceGoogleEvents,
    saveReminderSettings,
    setGoogleCalendarStatus,
  } = useTrackDailyContext();
  const { user } = useUser();
  const [categories, setCategories] = useState<string[]>(getCategories);
  const [newCategory, setNewCategory] = useState("");
  const timezone = useMemo(() => detectTimezone(), []);
  const [draftSettings, setDraftSettings] = useState<ReminderSettings>(
    () => reminderSettings ?? defaultSettings(timezone)
  );
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>(readNotificationPermission);
  const [toastMessage, setToastMessage] = useState("");
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);

  const settings = reminderSettings ?? draftSettings;

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const persistSettings = async (next: ReminderSettings) => {
    setDraftSettings(next);
    await saveReminderSettings(next);
    triggerToast("Settings saved");
  };

  const requestNotifPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
    if (permission !== "granted") {
      triggerToast(permission === "denied" ? "Notifications are blocked" : "Notification permission not granted");
      return;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      triggerToast("Web Push is not supported in this browser");
      return;
    }
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      triggerToast("NEXT_PUBLIC_VAPID_PUBLIC_KEY is required for device push");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      }));
    await registerPushSubscription(subscription);
    triggerToast("This device is subscribed");
  };

  const syncGoogleCalendar = async () => {
    if (!user) return;
    setIsSyncingCalendar(true);
    await setGoogleCalendarStatus({ status: "connecting" });

    try {
      const googleAccount = user.externalAccounts.find((account) => account.provider === "google");
      if (!googleAccount) {
        await user.createExternalAccount({
          strategy: "oauth_google",
          redirectUrl: `${window.location.origin}/trackdaily/settings`,
          additionalScopes: [CALENDAR_SCOPE],
        });
        return;
      }
      if (!googleAccount.approvedScopes.split(" ").includes(CALENDAR_SCOPE)) {
        await googleAccount.reauthorize({
          redirectUrl: `${window.location.origin}/trackdaily/settings`,
          additionalScopes: [CALENDAR_SCOPE],
          oidcPrompt: "consent",
        });
        return;
      }

      const rangeStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const rangeEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const response = await fetch(
        `/api/google-calendar/events?timeMin=${encodeURIComponent(rangeStart)}&timeMax=${encodeURIComponent(rangeEnd)}`
      );
      const payload = await response.json();
      if (!response.ok) {
        await setGoogleCalendarStatus({
          status: payload.status ?? "failed",
          error: payload.error ?? "Google Calendar sync failed",
        });
        triggerToast(payload.error ?? "Google Calendar sync failed");
        return;
      }

      await replaceGoogleEvents({
        rangeStart,
        rangeEnd,
        providerAccountId: payload.providerAccountId,
        approvedScopes: payload.approvedScopes,
        events: payload.events as Omit<CalendarEvent, "id">[],
      });
      triggerToast(`Synced ${payload.events.length} calendar events`);
    } catch (error) {
      await setGoogleCalendarStatus({
        status: "failed",
        error: error instanceof Error ? error.message : "Google Calendar sync failed",
      });
      triggerToast("Google Calendar sync failed");
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      triggerToast("Category already exists");
      return;
    }
    const updated = [...categories, trimmed];
    setCategories(updated);
    saveCategories(updated);
    setNewCategory("");
    triggerToast("Category added");
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(
      {
        version: "2.0",
        product: "Epta LifeOS",
        exportDate: new Date().toISOString(),
        tasks: allTasks,
        categories,
        reminderSettings: settings,
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `epta_lifeos_trackdaily_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast("Data exported");
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      void (async () => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (!Array.isArray(parsed.tasks)) {
            triggerToast("Invalid backup file");
            return;
          }

          let importCount = 0;
          for (const imported of parsed.tasks as ImportedTask[]) {
            if (!imported.title || !imported.category || !imported.plannedDate) continue;
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
            importCount += 1;
          }
          triggerToast(`Imported ${importCount} tasks`);
        } catch {
          triggerToast("Failed to parse backup");
        }
      })();
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col gap-6 px-1 text-foreground animate-slide-up">
      {toastMessage && (
        <div className="glass-panel fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-primary animate-slide-down">
          <Check className="h-3.5 w-3.5" />
          <span>{toastMessage}</span>
        </div>
      )}

      <ClerkProfileCard />

      <div className="glass-panel flex flex-col gap-4 p-5">
        <h3 className="text-sm font-semibold">Task Categories</h3>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <div key={cat} className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-xs">
              <span>{cat}</span>
              <button
                onClick={() => {
                  if (categories.length <= 1) return triggerToast("Keep at least one category");
                  const updated = categories.filter((item) => item !== cat);
                  setCategories(updated);
                  saveCategories(updated);
                }}
                className="p-0.5 text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${cat}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={handleAddCategory} className="flex gap-2">
          <input
            type="text"
            placeholder="New category"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="glass-input flex-1 px-3.5 py-2.5 text-sm"
            maxLength={18}
          />
          <button type="submit" className="btn-secondary">
            <Plus className="h-4 w-4" />
            <span>Add</span>
          </button>
        </form>
      </div>

      <div className="glass-panel flex flex-col gap-5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Reminder Preferences</h3>
          </div>
          <span className="badge-success">{pushSubscriptionsCount} device{pushSubscriptionsCount === 1 ? "" : "s"}</span>
        </div>

        {notifPermission !== "granted" && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              {notifPermission === "denied" ? (
                <ShieldAlert className="mt-0.5 h-4 w-4 text-destructive" />
              ) : (
                <ShieldQuestion className="mt-0.5 h-4 w-4 text-primary" />
              )}
              <div>
                <p className="text-xs font-semibold">
                  {notifPermission === "denied" ? "Permission blocked" : "Enable Web Push"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Production reminders require browser permission and a VAPID public key.
                </p>
              </div>
            </div>
            {notifPermission !== "denied" && notifPermission !== "unsupported" && (
              <button onClick={requestNotifPermission} className="btn-primary">
                Enable
              </button>
            )}
          </div>
        )}

        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Evening review</span>
            <input
              type="time"
              value={settings.eveningReviewTime}
              onChange={(e) => persistSettings({ ...settings, eveningReviewTime: e.target.value, timezone })}
              className="glass-input px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Weekly review</span>
            <div className="flex gap-2">
              <select
                value={settings.weeklyReviewDay}
                onChange={(e) => persistSettings({ ...settings, weeklyReviewDay: Number(e.target.value), timezone })}
                className="glass-input min-w-0 flex-1 px-3 py-2"
              >
                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={settings.weeklyReviewTime}
                onChange={(e) => persistSettings({ ...settings, weeklyReviewTime: e.target.value, timezone })}
                className="glass-input w-28 px-3 py-2"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Task reminder offset</span>
            <select
              value={settings.taskReminderOffsetMinutes}
              onChange={(e) =>
                persistSettings({ ...settings, taskReminderOffsetMinutes: Number(e.target.value), timezone })
              }
              className="glass-input px-3 py-2"
            >
              {[0, 5, 10, 15, 30, 60].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} min before
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="glass-panel flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Google Calendar</h3>
          </div>
          <span className={calendarState.status === "synced" ? "badge-success" : "badge-warning"}>
            {calendarState.status.replace("_", " ")}
          </span>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Syncs read-only Google Calendar events through Clerk OAuth and stores the cached busy blocks in Convex for overlap detection.
        </p>
        {calendarState.error && <p className="text-xs text-destructive">{calendarState.error}</p>}
        <button onClick={syncGoogleCalendar} disabled={isSyncingCalendar} className="btn-primary w-full">
          {isSyncingCalendar ? "Syncing..." : "Sync Google Calendar"}
        </button>
      </div>

      <div className="glass-panel flex flex-col gap-4 p-5">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Data Portability</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={handleExportData} className="btn-secondary justify-center">
            <Download className="h-4 w-4" />
            <span>Export backup</span>
          </button>
          <label className="btn-secondary justify-center">
            <Upload className="h-4 w-4" />
            <span>Import backup</span>
            <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between px-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-1">
          <Globe className="h-3 w-3" />
          {timezone}
        </span>
        <span>Convex realtime</span>
      </div>
    </div>
  );
}
