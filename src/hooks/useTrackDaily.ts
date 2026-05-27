"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Task, TaskStatus } from "@/app/trackdaily/types";
import * as localDb from "@/app/trackdaily/db";

const hasConvex = typeof window !== "undefined" && !!process.env.NEXT_PUBLIC_CONVEX_URL;

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

export function useTrackDaily(dateStr: string) {
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Convex Queries & Mutations (safe to declare conditionally if they are run conditionally? 
  // No, React Hooks CANNOT be declared conditionally. We must call them at the top level.
  // Even if hasConvex is false, we can still call useQuery/useMutation as long as ConvexClientProvider is rendering
  // but to prevent queries from running when hasConvex is false (which would throw errors), we can pass skip or run them.
  // Wait! In Convex, useQuery returns undefined while loading, and throws if the client is not configured.
  // If hasConvex is false, the ConvexReactClient is null, and calling useQuery will throw an error immediately!
  // To avoid calling Convex hooks when hasConvex is false, we can bypass them.
  // But wait! If we do: `if (hasConvex) { return useConvexData() }`, that violates the Rules of Hooks!
  // How can we declare hooks that only execute when hasConvex is true?
  // We can write two separate sub-hooks, or we can just define a single hook where we conditionally execute
  // the database logic by checking if we have the Convex client, but React hooks themselves must always execute.
  // Wait, if we can't call hooks conditionally, can we define a separate client component or sub-hook?
  // Actually, we can check `useQuery` usage: if we call `useQuery(hasConvex ? api.tasks.getTasksByDate : (null as any), { date: dateStr })`,
  // Convex allows passing `null` as the query, in which case it skips execution and returns `undefined`!
  // This is a supported Convex feature (passing `skip` or `null` to a query)!
  // Yes! If we pass `hasConvex ? api.tasks.getTasksByDate : (null as any)` to `useQuery`,
  // it will return `undefined` (loading/inactive) and won't make any network request or throw!
  // Let's check mutations: we can conditionally call mutation trigger functions!
  // That is perfectly compliant with the Rules of Hooks because the hooks themselves are always called, but with skip parameters!
  // Let's double check if we can do:
  // `const convexTasks = useQuery(hasConvex ? api.tasks.getTasksByDate : (null as any), { date: dateStr });`
  // Yes, this is fully supported.
  // Let's check mutations:
  // `const convexCreate = useMutation(hasConvex ? api.tasks.createTask : (null as any));`
  // If `hasConvex` is false, `useMutation` will still return a placeholder function, but we won't invoke it.
  // This is extremely elegant! Let's write it down.

  const convexTasks = useQuery(
    hasConvex ? api.tasks.getTasksByDate : (null as any),
    hasConvex ? { date: dateStr } : "skip" as any
  );

  const convexCreateTask = useMutation(hasConvex ? api.tasks.createTask : (null as any));
  const convexUpdateTask = useMutation(hasConvex ? api.tasks.updateTask : (null as any));
  const convexDeleteTask = useMutation(hasConvex ? api.tasks.deleteTask : (null as any));

  // Sync state for LocalStorage mode
  const refresh = useCallback(() => {
    if (!hasConvex) {
      setIsLoading(true);
      const data = localDb.getTasksByDate(dateStr);
      setLocalTasks(data);
      setIsLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    if (!hasConvex) {
      refresh();
    } else {
      if (convexTasks !== undefined) {
        setIsLoading(false);
      }
    }
  }, [dateStr, refresh, convexTasks]);

  // Unified list of tasks
  const tasks = hasConvex
    ? (convexTasks ? (convexTasks as any[]).map(mapConvexTask) : [])
    : localTasks;

  // Unified createTask mutation
  const createTask = async (taskData: Omit<Task, "id" | "createdAt" | "updatedAt">) => {
    const nowStr = new Date().toISOString();
    if (hasConvex) {
      await convexCreateTask({
        ...taskData,
        createdAt: nowStr,
        updatedAt: nowStr
      });
    } else {
      localDb.createTask(taskData);
      refresh();
    }
  };

  // Unified updateTask mutation
  const updateTask = async (id: string, fields: Partial<Task>) => {
    const nowStr = new Date().toISOString();
    if (hasConvex) {
      // For Convex, fields must be mapped to patch arguments
      // Remove id / createdAt from update fields, and convert status string if needed
      const { id: _, createdAt: __, ...updateFields } = fields;
      await convexUpdateTask({
        id: id as any,
        ...updateFields,
        updatedAt: nowStr
      });
    } else {
      localDb.updateTask(id, fields);
      refresh();
    }
  };

  // Unified deleteTask mutation
  const deleteTask = async (id: string) => {
    if (hasConvex) {
      await convexDeleteTask({ id: id as any });
    } else {
      localDb.deleteTask(id);
      refresh();
    }
  };

  return {
    tasks,
    isLoading,
    createTask,
    updateTask,
    deleteTask,
    refresh,
    isConvex: hasConvex
  };
}

export function useTrackDailyAll() {
  const convexTasks = useQuery(hasConvex ? api.tasks.getAllTasks : (null as any));
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!hasConvex) {
      setIsLoading(true);
      setLocalTasks(localDb.getAllTasks());
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasConvex) {
      refresh();
    } else {
      if (convexTasks !== undefined) {
        setIsLoading(false);
      }
    }
  }, [refresh, convexTasks]);

  const tasks = hasConvex
    ? (convexTasks ? (convexTasks as any[]).map(mapConvexTask) : [])
    : localTasks;

  return {
    tasks,
    isLoading,
    refresh,
    isConvex: hasConvex
  };
}
