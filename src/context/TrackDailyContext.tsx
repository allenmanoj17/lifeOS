"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Task, TaskStatus, DailyReview, WeeklyReview } from "@/app/trackdaily/types";
import * as localDb from "@/app/trackdaily/db";
import { useNotificationScheduler } from "@/hooks/useNotificationScheduler";

const hasConvex = typeof window !== "undefined" && !!process.env.NEXT_PUBLIC_CONVEX_URL;

interface TrackDailyContextType {
  allTasks: Task[];
  dailyReviews: DailyReview[];
  weeklyReviews: WeeklyReview[];
  isLoading: boolean;
  createTask: (taskData: Omit<Task, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateTask: (id: string, fields: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  createDailyReview: (date: string, reflectionNote?: string) => Promise<void>;
  createWeeklyReview: (weekStart: string, reflectionNote?: string) => Promise<void>;
  refresh: () => void;
  isConvex: boolean;
}

const TrackDailyContext = createContext<TrackDailyContextType | undefined>(undefined);

// Helper to map Convex record structure to frontend Task type
function mapConvexTask(convexTask: any): Task {
  return {
    id: convexTask._id,
    title: convexTask.title,
    notes: convexTask.notes,
    category: convexTask.category,
    plannedDate: convexTask.plannedDate,
    plannedTime: convexTask.plannedTime,
    status: convexTask.status as TaskStatus,
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

// Helper to map Convex daily reviews
function mapConvexDailyReview(r: any): DailyReview {
  return {
    id: r._id,
    date: r.date,
    reflectionNote: r.reflectionNote,
    reviewedAt: r.reviewedAt || new Date(r._creationTime).toISOString(),
  };
}

// Helper to map Convex weekly reviews
function mapConvexWeeklyReview(r: any): WeeklyReview {
  return {
    id: r._id,
    weekStart: r.weekStart,
    reflectionNote: r.reflectionNote,
    reviewedAt: r.reviewedAt || new Date(r._creationTime).toISOString(),
  };
}

// 1. Local Storage Implementation Provider
function LocalTrackDailyProvider({ children }: { children: ReactNode }) {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [dailyReviews, setDailyReviews] = useState<DailyReview[]>([]);
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useNotificationScheduler(allTasks);

  const refresh = useCallback(() => {
    setIsLoading(true);
    localDb.generateRecurringInstances();
    setAllTasks(localDb.getAllTasks());
    
    // Load reviews
    const localDaily = JSON.parse(localStorage.getItem("lifeos_daily_reviews") || "[]");
    const localWeekly = JSON.parse(localStorage.getItem("lifeos_weekly_reviews") || "[]");
    setDailyReviews(localDaily);
    setWeeklyReviews(localWeekly);
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createTask = async (taskData: Omit<Task, "id" | "createdAt" | "updatedAt">) => {
    localDb.createTask(taskData);
    refresh();
  };

  const updateTask = async (id: string, fields: Partial<Task>) => {
    localDb.updateTask(id, fields);
    refresh();
  };

  const deleteTask = async (id: string) => {
    localDb.deleteTask(id);
    refresh();
  };

  const createDailyReview = async (date: string, reflectionNote?: string) => {
    const reviews = JSON.parse(localStorage.getItem("lifeos_daily_reviews") || "[]");
    const filtered = reviews.filter((r: any) => r.date !== date);
    filtered.push({
      id: Math.random().toString(36).substring(2, 9),
      date,
      reflectionNote,
      reviewedAt: new Date().toISOString(),
    });
    localStorage.setItem("lifeos_daily_reviews", JSON.stringify(filtered));
    refresh();
  };

  const createWeeklyReview = async (weekStart: string, reflectionNote?: string) => {
    const reviews = JSON.parse(localStorage.getItem("lifeos_weekly_reviews") || "[]");
    const filtered = reviews.filter((r: any) => r.weekStart !== weekStart);
    filtered.push({
      id: Math.random().toString(36).substring(2, 9),
      weekStart,
      reflectionNote,
      reviewedAt: new Date().toISOString(),
    });
    localStorage.setItem("lifeos_weekly_reviews", JSON.stringify(filtered));
    refresh();
  };

  return (
    <TrackDailyContext.Provider 
      value={{
        allTasks,
        dailyReviews,
        weeklyReviews,
        isLoading,
        createTask,
        updateTask,
        deleteTask,
        createDailyReview,
        createWeeklyReview,
        refresh,
        isConvex: false
      }}
    >
      {children}
    </TrackDailyContext.Provider>
  );
}

// 2. Convex Implementation Provider (Only instantiated when hasConvex is true)
function ConvexTrackDailyProviderInner({ children }: { children: ReactNode }) {
  const convexTasks = useQuery(api.tasks.getAllTasks);
  const convexDaily = useQuery(api.tasks.getAllDailyReviews);
  const convexWeekly = useQuery(api.tasks.getAllWeeklyReviews);

  const convexCreateTask = useMutation(api.tasks.createTask);
  const convexUpdateTask = useMutation(api.tasks.updateTask);
  const convexDeleteTask = useMutation(api.tasks.deleteTask);
  const convexCreateDaily = useMutation(api.tasks.createDailyReview);
  const convexCreateWeekly = useMutation(api.tasks.createWeeklyReview);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (convexTasks !== undefined && convexDaily !== undefined && convexWeekly !== undefined) {
      setIsLoading(false);
    }
  }, [convexTasks, convexDaily, convexWeekly]);

  const tasks = convexTasks ? (convexTasks as any[]).map(mapConvexTask) : [];
  const daily = convexDaily ? (convexDaily as any[]).map(mapConvexDailyReview) : [];
  const weekly = convexWeekly ? (convexWeekly as any[]).map(mapConvexWeeklyReview) : [];

  useNotificationScheduler(tasks);

  const createTask = async (taskData: Omit<Task, "id" | "createdAt" | "updatedAt">) => {
    const nowStr = new Date().toISOString();
    await convexCreateTask({
      ...taskData,
      createdAt: nowStr,
      updatedAt: nowStr
    });
  };

  const updateTask = async (id: string, fields: Partial<Task>) => {
    const nowStr = new Date().toISOString();
    const { id: _, createdAt: __, ...updateFields } = fields;
    await convexUpdateTask({
      id: id as any,
      ...updateFields,
      updatedAt: nowStr
    });
  };

  const deleteTask = async (id: string) => {
    await convexDeleteTask({ id: id as any });
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

  const refresh = () => {
    // Convex is live/real-time, no manual refresh needed!
  };

  return (
    <TrackDailyContext.Provider 
      value={{
        allTasks: tasks,
        dailyReviews: daily,
        weeklyReviews: weekly,
        isLoading,
        createTask,
        updateTask,
        deleteTask,
        createDailyReview,
        createWeeklyReview,
        refresh,
        isConvex: true
      }}
    >
      {children}
    </TrackDailyContext.Provider>
  );
}

export function TrackDailyProvider({ children }: { children: ReactNode }) {
  if (hasConvex) {
    return <ConvexTrackDailyProviderInner>{children}</ConvexTrackDailyProviderInner>;
  }
  return <LocalTrackDailyProvider>{children}</LocalTrackDailyProvider>;
}

export function useTrackDailyContext() {
  const context = useContext(TrackDailyContext);
  if (context === undefined) {
    throw new Error("useTrackDailyContext must be used within a TrackDailyProvider");
  }
  return context;
}
