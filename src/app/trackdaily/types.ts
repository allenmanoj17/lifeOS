export type TaskStatus = "planned" | "done" | "done_late" | "missed" | "skipped";

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface RecurringRule {
  frequency: "daily" | "weekly" | "monthly";
  daysOfWeek?: number[]; // 0=Sun, 1=Mon ... 6=Sat (for weekly)
  endDate?: string;      // ISO date "YYYY-MM-DD"
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  category: string;          // e.g. "Work", "Health", "Personal"
  plannedDate: string;       // ISO date "YYYY-MM-DD"
  plannedTime?: string;      // "HH:MM" 24h
  status: TaskStatus;
  completedAt?: string;      // ISO datetime, set when marked Done
  delayReason?: string;
  skipReason?: string;
  checklist?: ChecklistItem[];
  isRecurring: boolean;
  recurringRule?: RecurringRule;
  reminderId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReview {
  id: string;
  date: string;              // "YYYY-MM-DD"
  reflectionNote?: string;
  reviewedAt: string;
}

export interface WeeklyReview {
  id: string;
  weekStart: string;         // Monday ISO date
  reflectionNote?: string;
  reviewedAt: string;
}

export type CalendarSyncStatus =
  | "not_connected"
  | "connecting"
  | "synced"
  | "failed"
  | "permission_missing";

export interface CalendarAccountState {
  status: CalendarSyncStatus;
  email?: string;
  providerAccountId?: string;
  approvedScopes?: string;
  lastSyncedAt?: string;
  syncRangeStart?: string;
  syncRangeEnd?: string;
  error?: string;
}

export interface CalendarEvent {
  id: string;
  externalId: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  isAllDay: boolean;
  location?: string;
}

export interface ReminderSettings {
  taskReminderOffsetMinutes: number;
  eveningReviewEnabled: boolean;
  eveningReviewTime: string;
  weeklyReviewEnabled: boolean;
  weeklyReviewDay: number;
  weeklyReviewTime: string;
  timezone: string;
}
