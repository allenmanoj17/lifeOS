import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    userId: v.string(),
    title: v.string(),
    notes: v.optional(v.string()),
    category: v.string(),
    plannedDate: v.string(), // "YYYY-MM-DD"
    plannedTime: v.optional(v.string()), // "HH:MM"
    status: v.union(
      v.literal("planned"),
      v.literal("done"),
      v.literal("done_late"),
      v.literal("missed"),
      v.literal("skipped")
    ),
    completedAt: v.optional(v.string()), // ISO Datetime
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
        frequency: v.union(
          v.literal("daily"),
          v.literal("weekly"),
          v.literal("monthly")
        ),
        daysOfWeek: v.optional(v.array(v.number())), // 0-6
        endDate: v.optional(v.string()),
      })
    ),
    reminderId: v.optional(v.string()), // Used for templates or instance identifiers
    createdAt: v.string(),
    updatedAt: v.string(),
  })
  .index("by_plannedDate", ["plannedDate"])
  .index("by_reminderId", ["reminderId"])
  .index("by_userId", ["userId"])
  .index("by_userId_and_plannedDate", ["userId", "plannedDate"])
  .index("by_userId_and_reminderId", ["userId", "reminderId"]),

  dailyReviews: defineTable({
    userId: v.string(),
    date: v.string(), // "YYYY-MM-DD"
    reflectionNote: v.optional(v.string()),
    reviewedAt: v.string(), // ISO Datetime
  })
  .index("by_date", ["date"])
  .index("by_userId", ["userId"])
  .index("by_userId_and_date", ["userId", "date"]),

  weeklyReviews: defineTable({
    userId: v.string(),
    weekStart: v.string(), // "YYYY-MM-DD" (Monday)
    reflectionNote: v.optional(v.string()),
    reviewedAt: v.string(), // ISO Datetime
  })
  .index("by_weekStart", ["weekStart"])
  .index("by_userId", ["userId"])
  .index("by_userId_and_weekStart", ["userId", "weekStart"]),

  calendarAccounts: defineTable({
    userId: v.string(),
    provider: v.literal("google"),
    providerAccountId: v.optional(v.string()),
    email: v.optional(v.string()),
    status: v.union(
      v.literal("not_connected"),
      v.literal("connecting"),
      v.literal("synced"),
      v.literal("failed"),
      v.literal("permission_missing")
    ),
    approvedScopes: v.optional(v.string()),
    lastSyncedAt: v.optional(v.string()),
    syncRangeStart: v.optional(v.string()),
    syncRangeEnd: v.optional(v.string()),
    error: v.optional(v.string()),
    updatedAt: v.string(),
    createdAt: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_provider", ["userId", "provider"]),

  calendarEvents: defineTable({
    userId: v.string(),
    provider: v.literal("google"),
    externalId: v.string(),
    calendarId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    start: v.string(),
    end: v.string(),
    isAllDay: v.boolean(),
    location: v.optional(v.string()),
    updatedAt: v.string(),
    syncedAt: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_start", ["userId", "start"])
    .index("by_userId_and_provider_and_externalId", ["userId", "provider", "externalId"]),

  pushSubscriptions: defineTable({
    userId: v.string(),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.optional(v.string()),
    enabled: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_endpoint", ["userId", "endpoint"])
    .index("by_userId_and_enabled", ["userId", "enabled"]),

  reminderSettings: defineTable({
    userId: v.string(),
    taskReminderOffsetMinutes: v.number(),
    eveningReviewEnabled: v.boolean(),
    eveningReviewTime: v.string(),
    weeklyReviewEnabled: v.boolean(),
    weeklyReviewDay: v.number(),
    weeklyReviewTime: v.string(),
    timezone: v.string(),
    updatedAt: v.string(),
    createdAt: v.string(),
  }).index("by_userId", ["userId"]),

  taskReminderSchedules: defineTable({
    userId: v.string(),
    taskId: v.id("tasks"),
    scheduledFor: v.string(),
    status: v.union(
      v.literal("scheduled"),
      v.literal("sent"),
      v.literal("snoozed"),
      v.literal("skipped"),
      v.literal("cancelled")
    ),
    snoozedUntil: v.optional(v.string()),
    updatedAt: v.string(),
    createdAt: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_taskId", ["taskId"])
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_status_and_scheduledFor", ["status", "scheduledFor"])
    .index("by_status_and_snoozedUntil", ["status", "snoozedUntil"]),

  notificationLogs: defineTable({
    userId: v.string(),
    kind: v.union(
      v.literal("task"),
      v.literal("evening_review"),
      v.literal("weekly_review")
    ),
    taskId: v.optional(v.id("tasks")),
    subscriptionId: v.optional(v.id("pushSubscriptions")),
    status: v.union(
      v.literal("queued"),
      v.literal("delivered"),
      v.literal("failed"),
      v.literal("done"),
      v.literal("snoozed"),
      v.literal("skipped")
    ),
    title: v.string(),
    body: v.string(),
    action: v.optional(v.string()),
    error: v.optional(v.string()),
    deliveredAt: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_taskId", ["taskId"])
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_userId_and_kind_and_createdAt", ["userId", "kind", "createdAt"]),
});
