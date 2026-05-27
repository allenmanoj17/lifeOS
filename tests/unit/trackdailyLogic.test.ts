import { describe, expect, it } from "vitest";
import {
  nextTaskStatus,
  recurringMatchesDate,
  reminderTimeForTask,
  taskConflictsWithEvents,
  validateTaskDraft,
} from "@/lib/trackdailyLogic";

describe("trackdaily logic", () => {
  it("validates malformed task drafts", () => {
    expect(validateTaskDraft({ title: "", category: "Work", plannedDate: "2026-05-27" })).toBe(
      "Task title is required"
    );
    expect(validateTaskDraft({ title: "Focus", category: "", plannedDate: "2026-05-27" })).toBe(
      "Task category is required"
    );
    expect(validateTaskDraft({ title: "Focus", category: "Work", plannedDate: "bad-date" })).toBe(
      "Planned date must be valid"
    );
    expect(
      validateTaskDraft({ title: "Focus", category: "Work", plannedDate: "2026-05-27", plannedTime: "24:00" })
    ).toBe("Planned time must be HH:MM");
    expect(
      validateTaskDraft({
        title: "Focus",
        category: "Work",
        plannedDate: "2026-05-27",
        isRecurring: true,
        recurringRule: { frequency: "weekly", daysOfWeek: [] },
      })
    ).toBe("Weekly recurring tasks require at least one day");
  });

  it("matches recurring rules deterministically", () => {
    expect(recurringMatchesDate({ frequency: "daily" }, "2026-05-20", "2026-05-27")).toBe(true);
    expect(recurringMatchesDate({ frequency: "daily", endDate: "2026-05-26" }, "2026-05-20", "2026-05-27")).toBe(false);
    expect(recurringMatchesDate({ frequency: "weekly", daysOfWeek: [3] }, "2026-05-20", "2026-05-27")).toBe(true);
    expect(recurringMatchesDate({ frequency: "monthly" }, "2026-05-20", "2026-06-20")).toBe(true);
  });

  it("computes status transitions for on-time and late completion", () => {
    expect(nextTaskStatus({ plannedDate: "2026-05-27", plannedTime: "09:00" }, new Date("2026-05-27T08:59:00"))).toBe("done");
    expect(nextTaskStatus({ plannedDate: "2026-05-27", plannedTime: "09:00" }, new Date("2026-05-27T09:01:00"))).toBe("done_late");
  });

  it("detects calendar conflicts at task time", () => {
    expect(
      taskConflictsWithEvents(
        { plannedDate: "2026-05-27", plannedTime: "09:30" },
        [{ start: "2026-05-27T09:00:00", end: "2026-05-27T10:00:00" }]
      )
    ).toBe(true);
    expect(
      taskConflictsWithEvents(
        { plannedDate: "2026-05-27", plannedTime: "10:00" },
        [{ start: "2026-05-27T09:00:00", end: "2026-05-27T10:00:00" }]
      )
    ).toBe(false);
  });

  it("schedules task reminders with offsets", () => {
    expect(reminderTimeForTask({ plannedDate: "2026-05-27", plannedTime: "09:30" }, 15)).toBe(
      new Date("2026-05-27T09:15:00").toISOString()
    );
    expect(reminderTimeForTask({ plannedDate: "2026-05-27" }, 15)).toBe(null);
  });
});

