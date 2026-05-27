"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import {
  CalendarAccountState,
  CalendarEvent,
  DailyReview,
  ReminderSettings,
  Task,
  WeeklyReview,
} from "@/app/trackdaily/types";
import { useNotificationScheduler } from "@/hooks/useNotificationScheduler";

type TaskInput = Omit<Task, "id" | "createdAt" | "updatedAt">;
type TaskUpdate = Partial<Omit<Task, "id" | "createdAt" | "updatedAt">>;

interface TrackDailyContextType {
  allTasks: Task[];
  dailyReviews: DailyReview[];
  weeklyReviews: WeeklyReview[];
  calendarState: CalendarAccountState;
  calendarEvents: CalendarEvent[];
  reminderSettings: ReminderSettings | null;
  pushSubscriptionsCount: number;
  isLoading: boolean;
  createTask: (taskData: TaskInput) => Promise<void>;
  updateTask: (id: string, fields: TaskUpdate) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  createDailyReview: (date: string, reflectionNote?: string) => Promise<void>;
  createWeeklyReview: (weekStart: string, reflectionNote?: string) => Promise<void>;
  setGoogleCalendarStatus: (state: Partial<CalendarAccountState> & { status: CalendarAccountState["status"] }) => Promise<void>;
  replaceGoogleEvents: (args: {
    rangeStart: string;
    rangeEnd: string;
    events: Omit<CalendarEvent, "id">[];
    providerAccountId?: string;
    approvedScopes?: string;
  }) => Promise<void>;
  saveReminderSettings: (settings: ReminderSettings) => Promise<void>;
  registerPushSubscription: (subscription: PushSubscription) => Promise<void>;
  unregisterPushSubscription: (endpoint: string) => Promise<void>;
  refresh: () => void;
  isConvex: true;
}

const TrackDailyContext = createContext<TrackDailyContextType | undefined>(undefined);

function mapConvexTask(convexTask: Doc<"tasks">): Task {
  return {
    id: convexTask._id,
    title: convexTask.title,
    notes: convexTask.notes,
    category: convexTask.category,
    plannedDate: convexTask.plannedDate,
    plannedTime: convexTask.plannedTime,
    status: convexTask.status,
    completedAt: convexTask.completedAt,
    delayReason: convexTask.delayReason,
    skipReason: convexTask.skipReason,
    checklist: convexTask.checklist,
    isRecurring: convexTask.isRecurring,
    recurringRule: convexTask.recurringRule,
    reminderId: convexTask.reminderId,
    createdAt: convexTask.createdAt || new Date(convexTask._creationTime).toISOString(),
    updatedAt: convexTask.updatedAt || new Date(convexTask._creationTime).toISOString(),
  };
}

function mapConvexDailyReview(review: Doc<"dailyReviews">): DailyReview {
  return {
    id: review._id,
    date: review.date,
    reflectionNote: review.reflectionNote,
    reviewedAt: review.reviewedAt || new Date(review._creationTime).toISOString(),
  };
}

function mapConvexWeeklyReview(review: Doc<"weeklyReviews">): WeeklyReview {
  return {
    id: review._id,
    weekStart: review.weekStart,
    reflectionNote: review.reflectionNote,
    reviewedAt: review.reviewedAt || new Date(review._creationTime).toISOString(),
  };
}

function mapCalendarEvent(event: Doc<"calendarEvents">): CalendarEvent {
  return {
    id: event._id,
    externalId: event.externalId,
    title: event.title,
    description: event.description,
    start: event.start,
    end: event.end,
    isAllDay: event.isAllDay,
    location: event.location,
  };
}

function mapReminderSettings(settings: ReminderSettings | null): ReminderSettings | null {
  if (!settings) return null;
  return {
    taskReminderOffsetMinutes: settings.taskReminderOffsetMinutes,
    eveningReviewEnabled: settings.eveningReviewEnabled,
    eveningReviewTime: settings.eveningReviewTime,
    weeklyReviewEnabled: settings.weeklyReviewEnabled,
    weeklyReviewDay: settings.weeklyReviewDay,
    weeklyReviewTime: settings.weeklyReviewTime,
    timezone: settings.timezone,
  };
}

export function TrackDailyProvider({ children }: { children: ReactNode }) {
  const [calendarRange] = useState(() => {
    const now = Date.now();
    return {
      start: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date(now + 45 * 24 * 60 * 60 * 1000).toISOString(),
    };
  });
  const convexTasks = useQuery(api.tasks.getAllTasks);
  const convexDaily = useQuery(api.tasks.getAllDailyReviews);
  const convexWeekly = useQuery(api.tasks.getAllWeeklyReviews);
  const convexCalendarState = useQuery(api.calendar.getGoogleCalendarState);
  const convexCalendarEvents = useQuery(api.calendar.getEventsInRange, calendarRange);
  const convexReminderSettings = useQuery(api.reminders.getReminderSettings);
  const convexPushSubscriptions = useQuery(api.reminders.listPushSubscriptions);

  const convexCreateTask = useMutation(api.tasks.createTask);
  const convexUpdateTask = useMutation(api.tasks.updateTask);
  const convexDeleteTask = useMutation(api.tasks.deleteTask);
  const convexCreateDaily = useMutation(api.tasks.createDailyReview);
  const convexCreateWeekly = useMutation(api.tasks.createWeeklyReview);
  const generateRecurringInstances = useMutation(api.tasks.generateRecurringInstances);
  const convexSetGoogleCalendarStatus = useMutation(api.calendar.setGoogleCalendarStatus);
  const convexReplaceGoogleEvents = useMutation(api.calendar.replaceGoogleEvents);
  const convexSaveReminderSettings = useMutation(api.reminders.saveReminderSettings);
  const convexRegisterPushSubscription = useMutation(api.reminders.registerPushSubscription);
  const convexUnregisterPushSubscription = useMutation(api.reminders.unregisterPushSubscription);
  const convexApplyNotificationAction = useMutation(api.reminders.applyNotificationAction);

  useEffect(() => {
    void generateRecurringInstances();
  }, [generateRecurringInstances]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "EPTA_NOTIFICATION_ACTION" || !event.data.taskId) return;
      void convexApplyNotificationAction({
        taskId: event.data.taskId as Id<"tasks">,
        action: event.data.action,
        actedAt: new Date().toISOString(),
      });
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [convexApplyNotificationAction]);

  const tasks = convexTasks?.map(mapConvexTask) ?? [];
  const daily = convexDaily?.map(mapConvexDailyReview) ?? [];
  const weekly = convexWeekly?.map(mapConvexWeeklyReview) ?? [];
  const calendarState: CalendarAccountState = convexCalendarState
    ? {
        status: convexCalendarState.status,
        email: convexCalendarState.email,
        providerAccountId: convexCalendarState.providerAccountId,
        approvedScopes: convexCalendarState.approvedScopes,
        lastSyncedAt: convexCalendarState.lastSyncedAt,
        syncRangeStart: convexCalendarState.syncRangeStart,
        syncRangeEnd: convexCalendarState.syncRangeEnd,
        error: convexCalendarState.error,
      }
    : { status: "not_connected" };
  const calendarEvents = convexCalendarEvents?.map(mapCalendarEvent) ?? [];
  const reminderSettings = mapReminderSettings(convexReminderSettings ?? null);
  const pushSubscriptionsCount = convexPushSubscriptions?.filter((sub) => sub.enabled).length ?? 0;
  const isLoading =
    convexTasks === undefined || convexDaily === undefined || convexWeekly === undefined;

  useNotificationScheduler(tasks, reminderSettings);

  const createTask = async (taskData: TaskInput) => {
    const nowStr = new Date().toISOString();
    await convexCreateTask({
      ...taskData,
      createdAt: nowStr,
      updatedAt: nowStr,
    });
  };

  const updateTask = async (id: string, fields: TaskUpdate) => {
    const nowStr = new Date().toISOString();
    await convexUpdateTask({
      id: id as Id<"tasks">,
      ...fields,
      updatedAt: nowStr,
    });
  };

  const deleteTask = async (id: string) => {
    await convexDeleteTask({ id: id as Id<"tasks"> });
  };

  const createDailyReview = async (date: string, reflectionNote?: string) => {
    await convexCreateDaily({
      date,
      reflectionNote,
      reviewedAt: new Date().toISOString(),
    });
  };

  const createWeeklyReview = async (weekStart: string, reflectionNote?: string) => {
    await convexCreateWeekly({
      weekStart,
      reflectionNote,
      reviewedAt: new Date().toISOString(),
    });
  };

  const setGoogleCalendarStatus: TrackDailyContextType["setGoogleCalendarStatus"] = async (state) => {
    await convexSetGoogleCalendarStatus(state);
  };

  const replaceGoogleEvents: TrackDailyContextType["replaceGoogleEvents"] = async (args) => {
    await convexReplaceGoogleEvents({
      rangeStart: args.rangeStart,
      rangeEnd: args.rangeEnd,
      providerAccountId: args.providerAccountId,
      approvedScopes: args.approvedScopes,
      events: args.events.map(({ externalId, title, description, start, end, isAllDay, location }) => ({
        externalId,
        calendarId: "primary",
        title,
        description,
        start,
        end,
        isAllDay,
        location,
        updatedAt: new Date().toISOString(),
      })),
    });
  };

  const saveReminderSettings = async (settings: ReminderSettings) => {
    await convexSaveReminderSettings(settings);
  };

  const registerPushSubscription = async (subscription: PushSubscription) => {
    const json = subscription.toJSON();
    await convexRegisterPushSubscription({
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
      userAgent: typeof navigator === "undefined" ? undefined : navigator.userAgent,
    });
  };

  const unregisterPushSubscription = async (endpoint: string) => {
    await convexUnregisterPushSubscription({ endpoint });
  };

  const refresh = () => {
    void generateRecurringInstances();
  };

  return (
    <TrackDailyContext.Provider
      value={{
        allTasks: tasks,
        dailyReviews: daily,
        weeklyReviews: weekly,
        calendarState,
        calendarEvents,
        reminderSettings,
        pushSubscriptionsCount,
        isLoading,
        createTask,
        updateTask,
        deleteTask,
        createDailyReview,
        createWeeklyReview,
        setGoogleCalendarStatus,
        replaceGoogleEvents,
        saveReminderSettings,
        registerPushSubscription,
        unregisterPushSubscription,
        refresh,
        isConvex: true,
      }}
    >
      {children}
    </TrackDailyContext.Provider>
  );
}

export function useTrackDailyContext() {
  const context = useContext(TrackDailyContext);
  if (context === undefined) {
    throw new Error("useTrackDailyContext must be used within a TrackDailyProvider");
  }
  return context;
}
