import { mutation } from "./_generated/server";
import { v } from "convex/values";

function requireSeedSecret(seedSecret: string) {
  const expected = process.env.TRACKDAILY_TEST_SEED_SECRET;
  if (!expected || seedSecret !== expected) {
    throw new Error("Seed helpers are disabled for this deployment");
  }
}

function isoDaysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export const resetAndSeedTrackDaily = mutation({
  args: {
    seedSecret: v.string(),
    testUserKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireSeedSecret(args.seedSecret);
    if (!/^[a-zA-Z0-9_-]{3,64}$/.test(args.testUserKey)) {
      throw new Error("testUserKey must be 3-64 URL-safe characters");
    }

    const userId = `test:${args.testUserKey}`;
    const now = new Date().toISOString();

    const taskRows = await ctx.db
      .query("tasks")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(200);
    for (const row of taskRows) await ctx.db.delete(row._id);

    const dailyRows = await ctx.db
      .query("dailyReviews")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(200);
    for (const row of dailyRows) await ctx.db.delete(row._id);

    const weeklyRows = await ctx.db
      .query("weeklyReviews")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(200);
    for (const row of weeklyRows) await ctx.db.delete(row._id);

    const calendarRows = await ctx.db
      .query("calendarEvents")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(200);
    for (const row of calendarRows) await ctx.db.delete(row._id);

    const reminderRows = await ctx.db
      .query("reminderSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(20);
    for (const row of reminderRows) await ctx.db.delete(row._id);

    const today = isoDaysFromNow(0);
    const tomorrow = isoDaysFromNow(1);
    const taskIds = [];
    taskIds.push(
      await ctx.db.insert("tasks", {
        userId,
        title: "Seeded focus block",
        notes: "Deterministic E2E task",
        category: "Work",
        plannedDate: today,
        plannedTime: "09:00",
        status: "planned",
        isRecurring: false,
        createdAt: now,
        updatedAt: now,
      })
    );
    taskIds.push(
      await ctx.db.insert("tasks", {
        userId,
        title: "Seeded daily walk",
        category: "Health",
        plannedDate: today,
        plannedTime: "17:30",
        status: "done",
        completedAt: now,
        isRecurring: true,
        recurringRule: { frequency: "daily" },
        createdAt: now,
        updatedAt: now,
      })
    );
    taskIds.push(
      await ctx.db.insert("tasks", {
        userId,
        title: "Seeded plan tomorrow",
        category: "Personal",
        plannedDate: tomorrow,
        status: "planned",
        isRecurring: false,
        createdAt: now,
        updatedAt: now,
      })
    );

    await ctx.db.insert("calendarAccounts", {
      userId,
      provider: "google",
      status: "synced",
      approvedScopes: "https://www.googleapis.com/auth/calendar.readonly",
      lastSyncedAt: now,
      syncRangeStart: `${today}T00:00:00.000Z`,
      syncRangeEnd: `${tomorrow}T23:59:59.000Z`,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("calendarEvents", {
      userId,
      provider: "google",
      externalId: "seed-calendar-1",
      calendarId: "primary",
      title: "Seeded calendar conflict",
      start: `${today}T09:00:00.000Z`,
      end: `${today}T10:00:00.000Z`,
      isAllDay: false,
      updatedAt: now,
      syncedAt: now,
    });
    await ctx.db.insert("reminderSettings", {
      userId,
      taskReminderOffsetMinutes: 10,
      eveningReviewEnabled: true,
      eveningReviewTime: "21:00",
      weeklyReviewEnabled: true,
      weeklyReviewDay: 0,
      weeklyReviewTime: "19:00",
      timezone: "UTC",
      createdAt: now,
      updatedAt: now,
    });

    return { userId, taskIds };
  },
});

