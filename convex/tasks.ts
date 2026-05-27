import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all tasks for a specific plannedDate for the logged-in user
export const getTasksByDate = query({
  args: { date: v.string() },
  handler: async (ctx: any, args: any) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const userId = identity.subject;
    return await ctx.db
      .query("tasks")
      .withIndex("by_userId_plannedDate", (q: any) => 
        q.eq("userId", userId).eq("plannedDate", args.date)
      )
      .collect();
  },
});

// Get all tasks for the logged-in user (useful for global sync / export)
export const getAllTasks = query({
  args: {},
  handler: async (ctx: any) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userId = identity.subject;
    return await ctx.db
      .query("tasks")
      .withIndex("by_userId_plannedDate", (q: any) => q.eq("userId", userId))
      .collect();
  },
});

// Create a new task tied to the logged-in user
export const createTask = mutation({
  args: {
    title: v.string(),
    notes: v.optional(v.string()),
    category: v.string(),
    plannedDate: v.string(),
    plannedTime: v.optional(v.string()),
    status: v.string(),
    completedAt: v.optional(v.string()),
    delayReason: v.optional(v.string()),
    skipReason: v.optional(v.string()),
    checklist: v.optional(
      v.array(
        v.object({
          id: v.string(),
          label: v.string(),
          checked: v.boolean(),
        })
      )
    ),
    isRecurring: v.boolean(),
    recurringRule: v.optional(
      v.object({
        frequency: v.string(),
        daysOfWeek: v.optional(v.array(v.float64())),
        endDate: v.optional(v.string()),
      })
    ),
    reminderId: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const userId = identity.subject;
    const taskId = await ctx.db.insert("tasks", {
      ...args,
      userId,
    });
    return taskId;
  },
});

// Update a task with ownership verification
export const updateTask = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    notes: v.optional(v.string()),
    category: v.optional(v.string()),
    plannedDate: v.optional(v.string()),
    plannedTime: v.optional(v.string()),
    status: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    delayReason: v.optional(v.string()),
    skipReason: v.optional(v.string()),
    checklist: v.optional(
      v.array(
        v.object({
          id: v.string(),
          label: v.string(),
          checked: v.boolean(),
        })
      )
    ),
    isRecurring: v.optional(v.boolean()),
    recurringRule: v.optional(
      v.object({
        frequency: v.string(),
        daysOfWeek: v.optional(v.array(v.float64())),
        endDate: v.optional(v.string()),
      })
    ),
    reminderId: v.optional(v.string()),
    updatedAt: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const userId = identity.subject;
    
    // Verify ownership
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Unauthorized: Task does not belong to user");
    }

    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

// Delete a task with ownership verification
export const deleteTask = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx: any, args: any) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const userId = identity.subject;

    // Verify ownership
    const taskToDelete = await ctx.db.get(args.id);
    if (!taskToDelete || taskToDelete.userId !== userId) {
      throw new Error("Unauthorized: Task does not belong to user");
    }
    
    // Delete future recurring instances if it's a template
    if (taskToDelete.isRecurring) {
      const allTasks = await ctx.db.query("tasks").collect();
      const instancesToDelete = allTasks.filter((t: any) => 
        t.userId === userId &&
        t.reminderId?.startsWith(`instance_${args.id}_`) && 
        t.status === "planned"
      );
      for (const instance of instancesToDelete) {
        await ctx.db.delete(instance._id);
      }
    }
    
    await ctx.db.delete(args.id);
  },
});

// Daily Review Queries & Mutations tied to user
export const createDailyReview = mutation({
  args: {
    date: v.string(),
    reflectionNote: v.optional(v.string()),
    reviewedAt: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const userId = identity.subject;
    const existing = await ctx.db
      .query("dailyReviews")
      .withIndex("by_userId_date", (q: any) => 
        q.eq("userId", userId).eq("date", args.date)
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return await ctx.db.insert("dailyReviews", {
      ...args,
      userId,
    });
  },
});

export const getDailyReview = query({
  args: { date: v.string() },
  handler: async (ctx: any, args: any) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const userId = identity.subject;
    return await ctx.db
      .query("dailyReviews")
      .withIndex("by_userId_date", (q: any) => 
        q.eq("userId", userId).eq("date", args.date)
      )
      .unique();
  },
});

export const getAllDailyReviews = query({
  args: {},
  handler: async (ctx: any) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const userId = identity.subject;
    return await ctx.db
      .query("dailyReviews")
      .withIndex("by_userId_date", (q: any) => q.eq("userId", userId))
      .collect();
  },
});

// Weekly Review Queries & Mutations tied to user
export const createWeeklyReview = mutation({
  args: {
    weekStart: v.string(),
    reflectionNote: v.optional(v.string()),
    reviewedAt: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const userId = identity.subject;
    const existing = await ctx.db
      .query("weeklyReviews")
      .withIndex("by_userId_weekStart", (q: any) => 
        q.eq("userId", userId).eq("weekStart", args.weekStart)
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return await ctx.db.insert("weeklyReviews", {
      ...args,
      userId,
    });
  },
});

export const getWeeklyReview = query({
  args: { weekStart: v.string() },
  handler: async (ctx: any, args: any) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const userId = identity.subject;
    return await ctx.db
      .query("weeklyReviews")
      .withIndex("by_userId_weekStart", (q: any) => 
        q.eq("userId", userId).eq("weekStart", args.weekStart)
      )
      .unique();
  },
});

export const getAllWeeklyReviews = query({
  args: {},
  handler: async (ctx: any) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const userId = identity.subject;
    return await ctx.db
      .query("weeklyReviews")
      .withIndex("by_userId_weekStart", (q: any) => q.eq("userId", userId))
      .collect();
  },
});
