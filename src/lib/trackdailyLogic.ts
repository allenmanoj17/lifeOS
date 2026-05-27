import type { CalendarEvent, RecurringRule, Task, TaskStatus } from "@/app/trackdaily/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateTaskDraft(task: {
  title: string;
  category: string;
  plannedDate: string;
  plannedTime?: string;
  isRecurring?: boolean;
  recurringRule?: RecurringRule;
}) {
  if (!task.title.trim()) return "Task title is required";
  if (!task.category.trim()) return "Task category is required";
  if (!DATE_RE.test(task.plannedDate) || Number.isNaN(Date.parse(`${task.plannedDate}T00:00:00Z`))) {
    return "Planned date must be valid";
  }
  if (task.plannedTime && !TIME_RE.test(task.plannedTime)) {
    return "Planned time must be HH:MM";
  }
  if (task.isRecurring && task.recurringRule?.frequency === "weekly") {
    const days = task.recurringRule.daysOfWeek ?? [];
    if (days.length === 0) return "Weekly recurring tasks require at least one day";
    if (days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      return "Recurring weekdays must be 0-6";
    }
  }
  return null;
}

export function recurringMatchesDate(rule: RecurringRule, plannedDate: string, targetDateStr: string) {
  if (targetDateStr < plannedDate) return false;
  if (rule.endDate && targetDateStr > rule.endDate) return false;
  const targetDate = new Date(`${targetDateStr}T12:00:00`);
  if (rule.frequency === "daily") return true;
  if (rule.frequency === "weekly") return rule.daysOfWeek?.includes(targetDate.getDay()) ?? false;
  const templateDate = new Date(`${plannedDate}T12:00:00`);
  return templateDate.getDate() === targetDate.getDate();
}

export function nextTaskStatus(task: Pick<Task, "plannedDate" | "plannedTime">, completedAt: Date): TaskStatus {
  if (!task.plannedTime) return "done";
  const planned = new Date(`${task.plannedDate}T${task.plannedTime}:00`);
  return completedAt > planned ? "done_late" : "done";
}

export function taskConflictsWithEvents(
  task: Pick<Task, "plannedDate" | "plannedTime">,
  events: Pick<CalendarEvent, "start" | "end">[]
) {
  if (!task.plannedTime) return false;
  const taskTime = new Date(`${task.plannedDate}T${task.plannedTime}:00`);
  return events.some((event) => new Date(event.start) <= taskTime && taskTime < new Date(event.end));
}

export function reminderTimeForTask(
  task: Pick<Task, "plannedDate" | "plannedTime">,
  offsetMinutes: number
) {
  if (!task.plannedTime) return null;
  const planned = new Date(`${task.plannedDate}T${task.plannedTime}:00`);
  if (Number.isNaN(planned.getTime())) return null;
  return new Date(planned.getTime() - offsetMinutes * 60_000).toISOString();
}

