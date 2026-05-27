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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T/;

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

function assertDate(value: string, field: string) {
  if (!DATE_RE.test(value)) throw new Error(`${field} must be YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} must be a valid calendar date`);
  }
}

function assertTime(value: string | undefined, field: string) {
  if (value !== undefined && !TIME_RE.test(value)) {
    throw new Error(`${field} must be HH:MM in 24-hour time`);
  }
}

function assertIso(value: string | undefined, field: string) {
  if (value !== undefined && (!ISO_RE.test(value) || Number.isNaN(Date.parse(value)))) {
    throw new Error(`${field} must be an ISO datetime`);
  }
}

function assertNonEmpty(value: string | undefined, field: string) {
  if (value !== undefined && value.trim().length === 0) {
    throw new Error(`${field} cannot be empty`);
  }
}

function assertRecurringRule(rule: Doc<"tasks">["recurringRule"] | undefined, plannedDate?: string) {
  if (!rule) return;
  if (rule.frequency === "weekly") {
    if (!rule.daysOfWeek?.length) throw new Error("Weekly recurring tasks require daysOfWeek");
    if (rule.daysOfWeek.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      throw new Error("daysOfWeek values must be integers from 0 to 6");
    }
  }
  if (rule.endDate) {
    assertDate(rule.endDate, "recurringRule.endDate");
    if (plannedDate && rule.endDate < plannedDate) {
      throw new Error("recurringRule.endDate cannot be before plannedDate");
    }
  }
}

function assertTaskWrite(args: {
  title?: string;
  category?: string;
  plannedDate?: string;
  plannedTime?: string;
  completedAt?: string;
  status?: Doc<"tasks">["status"];
  recurringRule?: Doc<"tasks">["recurringRule"];
  isRecurring?: boolean;
}) {
  assertNonEmpty(args.title, "title");
  assertNonEmpty(args.category, "category");
  if (args.plannedDate) assertDate(args.plannedDate, "plannedDate");
  assertTime(args.plannedTime, "plannedTime");
  assertIso(args.completedAt, "completedAt");
  assertRecurringRule(args.recurringRule, args.plannedDate);
  if (args.isRecurring === false && args.recurringRule) {
    throw new Error("recurringRule is only valid for recurring tasks");
  }
  if ((args.status === "done" || args.status === "done_late") && !args.completedAt) {
    throw new Error("Completed tasks require completedAt");
  }
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

async function scheduleTaskReminder(ctx: MutationCtx, auth: AuthInfo, task: Doc<"tasks">) {
  const existing = await ctx.db
    .query("taskReminderSchedules")
    .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
    .unique();

  if (!task.plannedTime || task.status !== "planned") {
    if (existing && auth.readableUserIds.includes(existing.userId)) {
      await ctx.db.patch(existing._id, {
        status: "cancelled",
        updatedAt: new Date().toISOString(),
      });
    }
    return;
  }

  const settings = await ctx.db
    .query("reminderSettings")
    .withIndex("by_userId", (q) => q.eq("userId", auth.canonicalUserId))
    .unique();
  const offsetMinutes = settings?.taskReminderOffsetMinutes ?? 10;
  const plannedFor = new Date(`${task.plannedDate}T${task.plannedTime}:00`);
  if (Number.isNaN(plannedFor.getTime())) return;

  const scheduledFor = new Date(plannedFor.getTime() - offsetMinutes * 60_000).toISOString();
  const now = new Date().toISOString();

  if (existing && auth.readableUserIds.includes(existing.userId)) {
    await ctx.db.patch(existing._id, {
      scheduledFor,
      status: "scheduled",
      snoozedUntil: undefined,
      updatedAt: now,
    });
    return;
  }

  await ctx.db.insert("taskReminderSchedules", {
    userId: auth.canonicalUserId,
    taskId: task._id,
    scheduledFor,
    status: "scheduled",
    createdAt: now,
    updatedAt: now,
  });
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

      const instanceId = await ctx.db.insert("tasks", {
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
      const instance = await ctx.db.get(instanceId);
      if (instance) await scheduleTaskReminder(ctx, auth, instance);
      created += 1;
    }
  }

  return created;
}

export const getTasksByDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    assertDate(args.date, "date");
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
    assertTaskWrite(args);
    const taskId = await ctx.db.insert("tasks", {
      ...args,
      userId: auth.canonicalUserId,
    });
    const task = await ctx.db.get(taskId);
    if (task) await scheduleTaskReminder(ctx, auth, task);
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
    const existing = await getTaskForOwner(ctx, args.id, auth);

    const { id, ...fields } = args;
    assertTaskWrite({
      ...existing,
      ...fields,
      plannedTime: fields.plannedTime === undefined ? existing.plannedTime : fields.plannedTime,
      completedAt: fields.completedAt === undefined ? existing.completedAt : fields.completedAt,
      recurringRule: fields.recurringRule === undefined ? existing.recurringRule : fields.recurringRule,
    });
    await ctx.db.patch(id, {
      ...fields,
      userId: auth.canonicalUserId,
    });
    const updatedTask = await ctx.db.get(id);
    if (updatedTask) await scheduleTaskReminder(ctx, auth, updatedTask);

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
    assertDate(args.date, "date");
    assertIso(args.reviewedAt, "reviewedAt");
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
    assertDate(args.date, "date");
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
    assertDate(args.weekStart, "weekStart");
    assertIso(args.reviewedAt, "reviewedAt");
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
    assertDate(args.weekStart, "weekStart");
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
