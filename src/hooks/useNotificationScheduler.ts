"use client";

import { useEffect } from "react";
import { Task } from "@/app/trackdaily/types";
import { formatDateString } from "@/app/trackdaily/db";

export function useNotificationScheduler(allTasks: Task[]) {
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const checkAndTriggerNotifications = () => {
      if (Notification.permission !== "granted") return;

      const now = new Date();
      const todayStr = formatDateString(now);
      const currentHours = now.getHours().toString().padStart(2, "0");
      const currentMinutes = now.getMinutes().toString().padStart(2, "0");
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      
      // Get settings from localstorage
      const eveningTime = localStorage.getItem("lifeos_settings_evening_time") || "21:00";
      const weeklyDay = localStorage.getItem("lifeos_settings_weekly_day") || "Sunday";
      const weeklyTime = localStorage.getItem("lifeos_settings_weekly_time") || "19:00";
      const reminderOffset = parseInt(localStorage.getItem("lifeos_settings_reminder_offset") || "10", 10);

      // --- 1. EVENING REFLECTION REMINDER ---
      if (currentTimeStr >= eveningTime) {
        const lastEveningNotif = localStorage.getItem("lifeos_last_notif_evening");
        if (lastEveningNotif !== todayStr) {
          new Notification("EOD Review Open", {
            body: "Time to log your daily reflection and plan for tomorrow!",
            icon: "/icon-192.png",
            tag: "evening-reflection",
          });
          localStorage.setItem("lifeos_last_notif_evening", todayStr);
        }
      }

      // --- 2. WEEKLY REVIEW REMINDER ---
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const currentDayName = dayNames[now.getDay()];
      if (currentDayName === weeklyDay && currentTimeStr >= weeklyTime) {
        const lastWeeklyNotif = localStorage.getItem("lifeos_last_notif_weekly");
        // We use the current date string as the trigger guard for the weekly check
        if (lastWeeklyNotif !== todayStr) {
          new Notification("Weekly Performance Review", {
            body: "Close out your weekly matrix and audit your behavior scores!",
            icon: "/icon-192.png",
            tag: "weekly-review",
          });
          localStorage.setItem("lifeos_last_notif_weekly", todayStr);
        }
      }

      // --- 3. TASK-SPECIFIC REMINDERS ---
      // Filter tasks planned for today that have a planned time and are not yet completed
      const todayPlannedTasks = allTasks.filter(
        (task) =>
          task.plannedDate === todayStr &&
          task.plannedTime &&
          task.status === "planned"
      );

      todayPlannedTasks.forEach((task) => {
        if (!task.plannedTime) return;

        const [tHours, tMinutes] = task.plannedTime.split(":").map(Number);
        const taskDateTime = new Date(now);
        taskDateTime.setHours(tHours, tMinutes, 0, 0);

        // Compute reminder trigger time (task time minus offset minutes)
        const triggerTime = new Date(taskDateTime.getTime() - reminderOffset * 60000);
        
        // If we are at or past the trigger time, but not past the task time itself
        if (now >= triggerTime && now < taskDateTime) {
          const firedKey = `lifeos_last_notif_task_${task.id}`;
          const hasFired = localStorage.getItem(firedKey);
          
          if (!hasFired) {
            new Notification(`Upcoming Task: ${task.title}`, {
              body: `Scheduled for ${task.plannedTime} (${task.category})`,
              icon: "/icon-192.png",
              tag: `task-${task.id}`,
            });
            localStorage.setItem(firedKey, "true");
          }
        }
      });
    };

    // Initial check
    checkAndTriggerNotifications();

    // Check every 60 seconds
    const interval = setInterval(checkAndTriggerNotifications, 60000);

    return () => clearInterval(interval);
  }, [allTasks]);
}
