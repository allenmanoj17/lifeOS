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
    status: v.string(), // "planned" | "done" | "done_late" | "missed" | "skipped"
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
        frequency: v.string(), // "daily" | "weekly" | "monthly"
        daysOfWeek: v.optional(v.array(v.float64())), // 0-6
        endDate: v.optional(v.string()),
      })
    ),
    reminderId: v.optional(v.string()), // Used for templates or instance identifiers
    createdAt: v.string(),
    updatedAt: v.string(),
  })
  .index("by_plannedDate", ["plannedDate"])
  .index("by_reminderId", ["reminderId"])
  .index("by_userId_plannedDate", ["userId", "plannedDate"]),

  dailyReviews: defineTable({
    userId: v.string(),
    date: v.string(), // "YYYY-MM-DD"
    reflectionNote: v.optional(v.string()),
    reviewedAt: v.string(), // ISO Datetime
  })
  .index("by_date", ["date"])
  .index("by_userId_date", ["userId", "date"]),

  weeklyReviews: defineTable({
    userId: v.string(),
    weekStart: v.string(), // "YYYY-MM-DD" (Monday)
    reflectionNote: v.optional(v.string()),
    reviewedAt: v.string(), // ISO Datetime
  })
  .index("by_weekStart", ["weekStart"])
  .index("by_userId_weekStart", ["userId", "weekStart"]),
});
