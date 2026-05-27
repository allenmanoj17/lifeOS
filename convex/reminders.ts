import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";

const DEFAULT_SETTINGS = {
  taskReminderOffsetMinutes: 10,
  eveningReviewEnabled: true,
  eveningReviewTime: "21:00",
  weeklyReviewEnabled: true,
  weeklyReviewDay: 0,
  weeklyReviewTime: "19:00",
};

type AuthInfo = {
  canonicalUserId: string;
  readableUserIds: string[];
};

const notificationKindValidator = v.union(
  v.literal("task"),
  v.literal("evening_review"),
  v.literal("weekly_review")
);

async function getOptionalAuth(ctx: QueryCtx | MutationCtx): Promise<AuthInfo | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const readableUserIds = [identity.tokenIdentifier];
  if (identity.subject !== identity.tokenIdentifier) readableUserIds.push(identity.subject);

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

function assertTime(value: string, field: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error(`${field} must be HH:MM in 24-hour time`);
  }
}

function assertIso(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be an ISO datetime`);
  }
}

async function getTaskForOwner(ctx: MutationCtx, id: Id<"tasks">, auth: AuthInfo): Promise<Doc<"tasks">> {
  const task = await ctx.db.get(id);
  if (!task || !auth.readableUserIds.includes(task.userId)) {
    throw new Error("Unauthorized: Task does not belong to user");
  }
  return task;
}

export const getReminderSettings = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getOptionalAuth(ctx);
    if (!auth) return null;

    for (const userId of auth.readableUserIds) {
      const settings = await ctx.db
        .query("reminderSettings")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();
      if (settings) return settings;
    }

    return {
      _id: null,
      _creationTime: 0,
      userId: auth.canonicalUserId,
      ...DEFAULT_SETTINGS,
      timezone: "UTC",
      createdAt: "",
      updatedAt: "",
    };
  },
});

export const saveReminderSettings = mutation({
  args: {
    taskReminderOffsetMinutes: v.number(),
    eveningReviewEnabled: v.boolean(),
    eveningReviewTime: v.string(),
    weeklyReviewEnabled: v.boolean(),
    weeklyReviewDay: v.number(),
    weeklyReviewTime: v.string(),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    if (![0, 5, 10, 15, 30, 60].includes(args.taskReminderOffsetMinutes)) {
      throw new Error("Unsupported task reminder offset");
    }
    assertTime(args.eveningReviewTime, "eveningReviewTime");
    assertTime(args.weeklyReviewTime, "weeklyReviewTime");
    if (!Number.isInteger(args.weeklyReviewDay) || args.weeklyReviewDay < 0 || args.weeklyReviewDay > 6) {
      throw new Error("weeklyReviewDay must be an integer from 0 to 6");
    }
    if (!args.timezone.trim()) throw new Error("timezone cannot be empty");

    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("reminderSettings")
      .withIndex("by_userId", (q) => q.eq("userId", auth.canonicalUserId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert("reminderSettings", {
      ...args,
      userId: auth.canonicalUserId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listPushSubscriptions = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getOptionalAuth(ctx);
    if (!auth) return [];
    const groups = await Promise.all(
      auth.readableUserIds.map((userId) =>
        ctx.db.query("pushSubscriptions").withIndex("by_userId", (q) => q.eq("userId", userId)).collect()
      )
    );
    return groups.flat();
  },
});

async function enabledSubscriptionsForUser(ctx: QueryCtx | MutationCtx, userId: string) {
  return await ctx.db
    .query("pushSubscriptions")
    .withIndex("by_userId_and_enabled", (q) => q.eq("userId", userId).eq("enabled", true))
    .take(20);
}

export const registerPushSubscription = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userAuth = await requireAuth(ctx);
    if (!args.endpoint.startsWith("https://")) throw new Error("Push endpoint must be HTTPS");
    if (!args.p256dh.trim() || !args.auth.trim()) throw new Error("Push subscription keys are required");

    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId_and_endpoint", (q) =>
        q.eq("userId", userAuth.canonicalUserId).eq("endpoint", args.endpoint)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        p256dh: args.p256dh,
        auth: args.auth,
        userAgent: args.userAgent,
        enabled: true,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("pushSubscriptions", {
      ...args,
      userId: userAuth.canonicalUserId,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const unregisterPushSubscription = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    for (const userId of auth.readableUserIds) {
      const existing = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_userId_and_endpoint", (q) => q.eq("userId", userId).eq("endpoint", args.endpoint))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { enabled: false, updatedAt: new Date().toISOString() });
      }
    }
  },
});

export const upsertTaskReminderSchedule = mutation({
  args: {
    taskId: v.id("tasks"),
    scheduledFor: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    await getTaskForOwner(ctx, args.taskId, auth);
    assertIso(args.scheduledFor, "scheduledFor");
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("taskReminderSchedules")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .unique();

    if (existing) {
      if (!auth.readableUserIds.includes(existing.userId)) throw new Error("Unauthorized reminder schedule");
      await ctx.db.patch(existing._id, {
        scheduledFor: args.scheduledFor,
        status: "scheduled",
        snoozedUntil: undefined,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("taskReminderSchedules", {
      userId: auth.canonicalUserId,
      taskId: args.taskId,
      scheduledFor: args.scheduledFor,
      status: "scheduled",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const recordDelivery = mutation({
  args: {
    kind: v.union(v.literal("task"), v.literal("evening_review"), v.literal("weekly_review")),
    taskId: v.optional(v.id("tasks")),
    subscriptionId: v.optional(v.id("pushSubscriptions")),
    status: v.union(v.literal("queued"), v.literal("delivered"), v.literal("failed")),
    title: v.string(),
    body: v.string(),
    error: v.optional(v.string()),
    deliveredAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    if (args.taskId) await getTaskForOwner(ctx, args.taskId, auth);
    if (!args.title.trim() || !args.body.trim()) throw new Error("Notification title and body are required");
    if (args.deliveredAt) assertIso(args.deliveredAt, "deliveredAt");
    return await ctx.db.insert("notificationLogs", {
      ...args,
      userId: auth.canonicalUserId,
      createdAt: new Date().toISOString(),
    });
  },
});

export const applyNotificationAction = mutation({
  args: {
    taskId: v.id("tasks"),
    action: v.union(v.literal("done"), v.literal("snooze_15"), v.literal("skip")),
    actedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    const task = await getTaskForOwner(ctx, args.taskId, auth);
    assertIso(args.actedAt, "actedAt");
    const now = new Date().toISOString();

    if (args.action === "done") {
      await ctx.db.patch(task._id, { status: "done", completedAt: args.actedAt, updatedAt: now });
    } else if (args.action === "skip") {
      await ctx.db.patch(task._id, { status: "skipped", skipReason: "Skipped from notification", updatedAt: now });
    } else {
      const snoozedUntil = new Date(Date.parse(args.actedAt) + 15 * 60 * 1000).toISOString();
      const existing = await ctx.db
        .query("taskReminderSchedules")
        .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
        .unique();
      if (existing && auth.readableUserIds.includes(existing.userId)) {
        await ctx.db.patch(existing._id, {
          status: "scheduled",
          scheduledFor: snoozedUntil,
          snoozedUntil,
          updatedAt: now,
        });
      }
    }

    return await ctx.db.insert("notificationLogs", {
      userId: auth.canonicalUserId,
      kind: "task",
      taskId: task._id,
      status: args.action === "done" ? "done" : args.action === "skip" ? "skipped" : "snoozed",
      title: task.title,
      body: task.plannedTime ? `Scheduled for ${task.plannedTime}` : "Task reminder",
      action: args.action,
      createdAt: now,
    });
  },
});

export const listDuePushDeliveries = internalQuery({
  args: { now: v.string() },
  handler: async (ctx, args) => {
    assertIso(args.now, "now");
    const schedules = await ctx.db
      .query("taskReminderSchedules")
      .withIndex("by_status_and_scheduledFor", (q) =>
        q.eq("status", "scheduled").lte("scheduledFor", args.now)
      )
      .take(25);

    const deliveries = [];
    for (const schedule of schedules) {
      const task = await ctx.db.get(schedule.taskId);
      if (!task || task.status !== "planned") continue;

      const subscriptions = await enabledSubscriptionsForUser(ctx, schedule.userId);
      for (const subscription of subscriptions) {
        deliveries.push({
          kind: "task" as const,
          scheduleId: schedule._id,
          taskId: task._id,
          userId: schedule.userId,
          subscriptionId: subscription._id,
          subscription: {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload: {
            title: `Upcoming Task: ${task.title}`,
            body: task.plannedTime
              ? `Scheduled for ${task.plannedTime} (${task.category})`
              : `Scheduled task (${task.category})`,
            icon: "/icon-192.png",
            tag: `task-${task._id}`,
            data: { taskId: task._id, url: "/trackdaily" },
            actions: [
              { action: "done", title: "Done" },
              { action: "snooze_15", title: "Snooze 15 min" },
              { action: "skip", title: "Skip" },
            ],
          },
        });
      }
    }

    return deliveries;
  },
});

export const listDueReviewDeliveries = internalQuery({
  args: { now: v.string() },
  handler: async (ctx, args) => {
    assertIso(args.now, "now");
    const now = new Date(args.now);
    const settingsRows = await ctx.db.query("reminderSettings").take(100);
    const deliveries = [];

    for (const settings of settingsRows) {
      const localParts = new Intl.DateTimeFormat("en-US", {
        timeZone: settings.timezone,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      const part = (type: string) => localParts.find((item) => item.type === type)?.value ?? "";
      const localTime = `${part("hour").padStart(2, "0")}:${part("minute").padStart(2, "0")}`;
      const localDate = `${part("year")}-${part("month")}-${part("day")}`;
      const localWeekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(part("weekday"));

      const dueKinds: Array<"evening_review" | "weekly_review"> = [];
      if (settings.eveningReviewEnabled && localTime >= settings.eveningReviewTime) {
        dueKinds.push("evening_review");
      }
      if (
        settings.weeklyReviewEnabled &&
        localWeekday === settings.weeklyReviewDay &&
        localTime >= settings.weeklyReviewTime
      ) {
        dueKinds.push("weekly_review");
      }

      const subscriptions = await enabledSubscriptionsForUser(ctx, settings.userId);
      for (const kind of dueKinds) {
        const dayKey = `${localDate}:${kind}`;
        const existing = await ctx.db
          .query("notificationLogs")
          .withIndex("by_userId_and_kind_and_createdAt", (q) =>
            q.eq("userId", settings.userId).eq("kind", kind).gte("createdAt", localDate)
          )
          .take(10);
        if (existing.some((log) => log.action === dayKey || log.status === "delivered")) continue;

        for (const subscription of subscriptions) {
          deliveries.push({
            kind,
            userId: settings.userId,
            subscriptionId: subscription._id,
            actionKey: dayKey,
            subscription: {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            payload: {
              title: kind === "evening_review" ? "Evening review" : "Weekly review",
              body:
                kind === "evening_review"
                  ? "Close the day with a short reflection and plan tomorrow."
                  : "Review the week and choose the next focus.",
              icon: "/icon-192.png",
              tag: kind,
              data: { url: "/trackdaily/review" },
            },
          });
        }
      }
    }

    return deliveries;
  },
});

export const recordPushDispatch = internalMutation({
  args: {
    userId: v.string(),
    kind: notificationKindValidator,
    taskId: v.optional(v.id("tasks")),
    scheduleId: v.optional(v.id("taskReminderSchedules")),
    subscriptionId: v.id("pushSubscriptions"),
    title: v.string(),
    body: v.string(),
    status: v.union(v.literal("delivered"), v.literal("failed")),
    error: v.optional(v.string()),
    actionKey: v.optional(v.string()),
    disableSubscription: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    if (args.disableSubscription) {
      await ctx.db.patch(args.subscriptionId, {
        enabled: false,
        updatedAt: now,
      });
    }

    if (args.scheduleId && args.status === "delivered") {
      await ctx.db.patch(args.scheduleId, {
        status: "sent",
        updatedAt: now,
      });
    }

    await ctx.db.insert("notificationLogs", {
      userId: args.userId,
      kind: args.kind,
      taskId: args.taskId,
      subscriptionId: args.subscriptionId,
      status: args.status,
      title: args.title,
      body: args.body,
      action: args.actionKey,
      error: args.error,
      deliveredAt: args.status === "delivered" ? now : undefined,
      createdAt: now,
    });
  },
});
