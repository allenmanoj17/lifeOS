import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";

const taskStatusValidator = v.union(
  v.literal("planned"),
  v.literal("done"),
  v.literal("done_late"),
  v.literal("missed"),
  v.literal("skipped")
);

const recurringRuleValidator = v.object({
  frequency: v.union(
    v.literal("daily"),
    v.literal("weekly"),
    v.literal("monthly")
  ),
  daysOfWeek: v.optional(v.array(v.number())),
  endDate: v.optional(v.string()),
});

const checklistValidator = v.array(
  v.object({
    id: v.string(),
    label: v.string(),
    checked: v.boolean(),
  })
);

type AuthInfo = {
  canonicalUserId: string;
  readableUserIds: string[];
};

async function getOptionalAuth(ctx: QueryCtx | MutationCtx): Promise<AuthInfo | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const readableUserIds = [identity.tokenIdentifier];
  if (identity.subject !== identity.tokenIdentifier) {
    readableUserIds.push(identity.subject);
  }

  return {
    canonicalUserId: identity.tokenIdentifier,
    readableUserIds,
  };
}

async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<AuthInfo> {
  const auth = await getOptionalAuth(ctx);
  if (!auth) throw new Error("Not authenticated");
  return auth;
}

function uniqueById<T extends { _id: Id<"tasks"> | Id<"dailyReviews"> | Id<"weeklyReviews"> }>(
  docs: T[]
): T[] {
  const seen = new Set<string>();
  return docs.filter((doc) => {
    if (seen.has(doc._id)) return false;
    seen.add(doc._id);
    return true;
  });
}

function dateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15);
}

function recurringMatchesDate(task: Doc<"tasks">, targetDate: Date, targetDateStr: string) {
  if (!task.recurringRule) return false;
  if (task.recurringRule.endDate && targetDateStr > task.recurringRule.endDate) return false;
  if (task.plannedDate > targetDateStr) return false;

  if (task.recurringRule.frequency === "daily") return true;

  if (task.recurringRule.frequency === "weekly") {
    return task.recurringRule.daysOfWeek?.includes(targetDate.getDay()) ?? false;
  }

  const templateDate = new Date(`${task.plannedDate}T00:00:00`);
  return templateDate.getDate() === targetDate.getDate();
}

async function getUserTasks(ctx: QueryCtx | MutationCtx, auth: AuthInfo) {
  const taskGroups = await Promise.all(
    auth.readableUserIds.map((userId) =>
      ctx.db.query("tasks").withIndex("by_userId", (q) => q.eq("userId", userId)).collect()
    )
  );

  return uniqueById(taskGroups.flat());
}

async function getUserTasksByDate(ctx: QueryCtx, auth: AuthInfo, date: string) {
  const taskGroups = await Promise.all(
    auth.readableUserIds.map((userId) =>
      ctx.db
        .query("tasks")
        .withIndex("by_userId_and_plannedDate", (q) =>
          q.eq("userId", userId).eq("plannedDate", date)
        )
        .collect()
    )
  );

  return uniqueById(taskGroups.flat());
}

async function getTaskForOwner(ctx: MutationCtx, id: Id<"tasks">, auth: AuthInfo) {
  const task = await ctx.db.get(id);
  if (!task || !auth.readableUserIds.includes(task.userId)) {
    throw new Error("Unauthorized: Task does not belong to user");
  }
  return task;
}

async function findDailyReview(ctx: QueryCtx | MutationCtx, auth: AuthInfo, date: string) {
  for (const userId of auth.readableUserIds) {
    const review = await ctx.db
      .query("dailyReviews")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", userId).eq("date", date))
      .unique();
    if (review) return review;
  }
  return null;
}

async function findWeeklyReview(ctx: QueryCtx | MutationCtx, auth: AuthInfo, weekStart: string) {
  for (const userId of auth.readableUserIds) {
    const review = await ctx.db
      .query("weeklyReviews")
      .withIndex("by_userId_and_weekStart", (q) =>
        q.eq("userId", userId).eq("weekStart", weekStart)
      )
      .unique();
    if (review) return review;
  }
  return null;
}

async function generateRecurringInstancesForUser(ctx: MutationCtx, auth: AuthInfo) {
  const allTasks = await getUserTasks(ctx, auth);
  const templates = allTasks.filter(
    (task) => task.isRecurring && !task.reminderId?.startsWith("instance_")
  );

  const today = new Date();
  const nowStr = new Date().toISOString();
  let created = 0;

  for (let i = 0; i < 30; i += 1) {
    const targetDate = addDays(today, i);
    const targetDateStr = dateString(targetDate);

    for (const template of templates) {
      if (!recurringMatchesDate(template, targetDate, targetDateStr)) continue;

      const reminderId = `instance_${template._id}_${targetDateStr}`;
      const existing = await Promise.all(
        auth.readableUserIds.map((userId) =>
          ctx.db
            .query("tasks")
            .withIndex("by_userId_and_reminderId", (q) =>
              q.eq("userId", userId).eq("reminderId", reminderId)
            )
            .unique()
        )
      );

      if (existing.some(Boolean)) continue;

      await ctx.db.insert("tasks", {
        userId: auth.canonicalUserId,
        title: template.title,
        notes: template.notes,
        category: template.category,
        plannedDate: targetDateStr,
        plannedTime: template.plannedTime,
        status: "planned",
        checklist: template.checklist?.map((item) => ({
          ...item,
          id: randomId(),
          checked: false,
        })),
        isRecurring: false,
        reminderId,
        createdAt: nowStr,
        updatedAt: nowStr,
      });
      created += 1;
    }
  }

  return created;
}

export const getTasksByDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const auth = await getOptionalAuth(ctx);
    if (!auth) return [];
    return await getUserTasksByDate(ctx, auth, args.date);
  },
});

export const getAllTasks = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getOptionalAuth(ctx);
    if (!auth) return [];
    return await getUserTasks(ctx, auth);
  },
});

export const generateRecurringInstances = mutation({
  args: {},
  handler: async (ctx) => {
    const auth = await requireAuth(ctx);
    return await generateRecurringInstancesForUser(ctx, auth);
  },
});

export const createTask = mutation({
  args: {
    title: v.string(),
    notes: v.optional(v.string()),
    category: v.string(),
    plannedDate: v.string(),
    plannedTime: v.optional(v.string()),
    status: taskStatusValidator,
    completedAt: v.optional(v.string()),
    delayReason: v.optional(v.string()),
    skipReason: v.optional(v.string()),
    checklist: v.optional(checklistValidator),
    isRecurring: v.boolean(),
    recurringRule: v.optional(recurringRuleValidator),
    reminderId: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    const taskId = await ctx.db.insert("tasks", {
      ...args,
      userId: auth.canonicalUserId,
    });
    await generateRecurringInstancesForUser(ctx, auth);
    return taskId;
  },
});

export const updateTask = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    notes: v.optional(v.string()),
    category: v.optional(v.string()),
    plannedDate: v.optional(v.string()),
    plannedTime: v.optional(v.string()),
    status: v.optional(taskStatusValidator),
    completedAt: v.optional(v.string()),
    delayReason: v.optional(v.string()),
    skipReason: v.optional(v.string()),
    checklist: v.optional(checklistValidator),
    isRecurring: v.optional(v.boolean()),
    recurringRule: v.optional(recurringRuleValidator),
    reminderId: v.optional(v.string()),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    await getTaskForOwner(ctx, args.id, auth);

    const { id, ...fields } = args;
    await ctx.db.patch(id, {
      ...fields,
      userId: auth.canonicalUserId,
    });

    if (fields.isRecurring || fields.recurringRule) {
      await generateRecurringInstancesForUser(ctx, auth);
    }
  },
});

export const deleteTask = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    const taskToDelete = await getTaskForOwner(ctx, args.id, auth);

    if (taskToDelete.isRecurring) {
      const allTasks = await getUserTasks(ctx, auth);
      const instancesToDelete = allTasks.filter(
        (task) =>
          task.reminderId?.startsWith(`instance_${args.id}_`) &&
          task.status === "planned"
      );

      for (const instance of instancesToDelete) {
        await ctx.db.delete(instance._id);
      }
    }

    await ctx.db.delete(args.id);
  },
});

export const createDailyReview = mutation({
  args: {
    date: v.string(),
    reflectionNote: v.optional(v.string()),
    reviewedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    const existing = await findDailyReview(ctx, auth, args.date);
    if (existing) await ctx.db.delete(existing._id);

    return await ctx.db.insert("dailyReviews", {
      ...args,
      userId: auth.canonicalUserId,
    });
  },
});

export const getDailyReview = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const auth = await getOptionalAuth(ctx);
    if (!auth) return null;
    return await findDailyReview(ctx, auth, args.date);
  },
});

export const getAllDailyReviews = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getOptionalAuth(ctx);
    if (!auth) return [];

    const reviewGroups = await Promise.all(
      auth.readableUserIds.map((userId) =>
        ctx.db.query("dailyReviews").withIndex("by_userId", (q) => q.eq("userId", userId)).collect()
      )
    );
    return uniqueById(reviewGroups.flat());
  },
});

export const createWeeklyReview = mutation({
  args: {
    weekStart: v.string(),
    reflectionNote: v.optional(v.string()),
    reviewedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    const existing = await findWeeklyReview(ctx, auth, args.weekStart);
    if (existing) await ctx.db.delete(existing._id);

    return await ctx.db.insert("weeklyReviews", {
      ...args,
      userId: auth.canonicalUserId,
    });
  },
});

export const getWeeklyReview = query({
  args: { weekStart: v.string() },
  handler: async (ctx, args) => {
    const auth = await getOptionalAuth(ctx);
    if (!auth) return null;
    return await findWeeklyReview(ctx, auth, args.weekStart);
  },
});

export const getAllWeeklyReviews = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getOptionalAuth(ctx);
    if (!auth) return [];

    const reviewGroups = await Promise.all(
      auth.readableUserIds.map((userId) =>
        ctx.db.query("weeklyReviews").withIndex("by_userId", (q) => q.eq("userId", userId)).collect()
      )
    );
    return uniqueById(reviewGroups.flat());
  },
});
