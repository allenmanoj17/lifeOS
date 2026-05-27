"use client";

import React, { createContext, useContext, useEffect, ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { DailyReview, Task, WeeklyReview } from "@/app/trackdaily/types";
import { useNotificationScheduler } from "@/hooks/useNotificationScheduler";

type TaskInput = Omit<Task, "id" | "createdAt" | "updatedAt">;
type TaskUpdate = Partial<Omit<Task, "id" | "createdAt" | "updatedAt">>;

interface TrackDailyContextType {
  allTasks: Task[];
  dailyReviews: DailyReview[];
  weeklyReviews: WeeklyReview[];
  isLoading: boolean;
  createTask: (taskData: TaskInput) => Promise<void>;
  updateTask: (id: string, fields: TaskUpdate) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  createDailyReview: (date: string, reflectionNote?: string) => Promise<void>;
  createWeeklyReview: (weekStart: string, reflectionNote?: string) => Promise<void>;
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

export function TrackDailyProvider({ children }: { children: ReactNode }) {
  const convexTasks = useQuery(api.tasks.getAllTasks);
  const convexDaily = useQuery(api.tasks.getAllDailyReviews);
  const convexWeekly = useQuery(api.tasks.getAllWeeklyReviews);

  const convexCreateTask = useMutation(api.tasks.createTask);
  const convexUpdateTask = useMutation(api.tasks.updateTask);
  const convexDeleteTask = useMutation(api.tasks.deleteTask);
  const convexCreateDaily = useMutation(api.tasks.createDailyReview);
  const convexCreateWeekly = useMutation(api.tasks.createWeeklyReview);
  const generateRecurringInstances = useMutation(api.tasks.generateRecurringInstances);

  useEffect(() => {
    void generateRecurringInstances();
  }, [generateRecurringInstances]);

  const tasks = convexTasks?.map(mapConvexTask) ?? [];
  const daily = convexDaily?.map(mapConvexDailyReview) ?? [];
  const weekly = convexWeekly?.map(mapConvexWeeklyReview) ?? [];
  const isLoading =
    convexTasks === undefined || convexDaily === undefined || convexWeekly === undefined;

  useNotificationScheduler(tasks);

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

  const refresh = () => {
    void generateRecurringInstances();
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
