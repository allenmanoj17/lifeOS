"use client";

import { useEffect } from "react";
import { ReminderSettings, Task } from "@/app/trackdaily/types";
import { formatDateString } from "@/app/trackdaily/db";

export function useNotificationScheduler(allTasks: Task[], settings: ReminderSettings | null) {
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window) || !settings) return;

    const checkAndTriggerNotifications = () => {
      if (Notification.permission !== "granted") return;

      const now = new Date();
      const todayStr = formatDateString(now);
      const currentTimeStr = `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
      if (settings.eveningReviewEnabled && currentTimeStr >= settings.eveningReviewTime) {
        const lastEveningNotif = sessionStorage.getItem("epta_last_notif_evening");
        if (lastEveningNotif !== todayStr) {
          new Notification("Evening review", {
            body: "Close the day with a short reflection and plan tomorrow.",
            icon: "/icon-192.png",
            tag: "evening-reflection",
            data: { url: "/trackdaily/review" },
          });
          sessionStorage.setItem("epta_last_notif_evening", todayStr);
        }
      }

      if (
        settings.weeklyReviewEnabled &&
        now.getDay() === settings.weeklyReviewDay &&
        currentTimeStr >= settings.weeklyReviewTime
      ) {
        const lastWeeklyNotif = sessionStorage.getItem("epta_last_notif_weekly");
        if (lastWeeklyNotif !== todayStr) {
          new Notification("Weekly review", {
            body: "Review the week and choose the next focus.",
            icon: "/icon-192.png",
            tag: "weekly-review",
            data: { url: "/trackdaily/review" },
          });
          sessionStorage.setItem("epta_last_notif_weekly", todayStr);
        }
      }

      allTasks
        .filter((task) => task.plannedDate === todayStr && task.plannedTime && task.status === "planned")
        .forEach((task) => {
          if (!task.plannedTime) return;
          const [hours, minutes] = task.plannedTime.split(":").map(Number);
          const taskDateTime = new Date(now);
          taskDateTime.setHours(hours, minutes, 0, 0);

          const triggerTime = new Date(
            taskDateTime.getTime() - settings.taskReminderOffsetMinutes * 60_000
          );
          if (now < triggerTime || now >= taskDateTime) return;

          const firedKey = `epta_last_notif_task_${task.id}`;
          if (sessionStorage.getItem(firedKey)) return;

          new Notification(`Upcoming Task: ${task.title}`, {
            body: `Scheduled for ${task.plannedTime} (${task.category})`,
            icon: "/icon-192.png",
            tag: `task-${task.id}`,
            data: { taskId: task.id, url: "/trackdaily" },
          });
          sessionStorage.setItem(firedKey, "true");
        });
    };

    checkAndTriggerNotifications();
    const interval = setInterval(checkAndTriggerNotifications, 60_000);
    return () => clearInterval(interval);
  }, [allTasks, settings]);
}
