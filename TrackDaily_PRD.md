# TrackDaily — Product Requirements Document
> Personal planning and behavioral analytics PWA.
> Solo developer. Personal use only.
> Optimized for AI-assisted development (Codex / Claude).

---

## Quick Reference

| Item | Value |
|---|---|
| App name | TrackDaily |
| Type | PWA (installable, mobile-first) |
| User | Solo / personal use |
| Frontend | Next.js + TypeScript + Tailwind + shadcn/ui |
| Backend | Convex |
| Hosting | Vercel |
| Charts | Recharts |
| Notifications | Web Push |

---

## Data Models

Define these schemas before building any feature.

### Task
```ts
type Task = {
  id: string
  title: string
  notes?: string
  category: string          // e.g. "Work", "Health", "Personal"
  plannedDate: string       // ISO date "YYYY-MM-DD"
  plannedTime?: string      // "HH:MM" 24h
  status: TaskStatus
  completedAt?: string      // ISO datetime, set when marked Done
  delayReason?: string
  skipReason?: string
  checklist?: ChecklistItem[]
  isRecurring: boolean
  recurringRule?: RecurringRule
  reminderId?: string
  createdAt: string
  updatedAt: string
}

type TaskStatus = "planned" | "done" | "done_late" | "missed" | "skipped"

type ChecklistItem = {
  id: string
  label: string
  checked: boolean
}

type RecurringRule = {
  frequency: "daily" | "weekly" | "monthly"
  daysOfWeek?: number[]     // 0=Sun, 1=Mon ... for weekly
  endDate?: string
}
```

### DailyReview
```ts
type DailyReview = {
  id: string
  date: string              // "YYYY-MM-DD"
  reflectionNote?: string
  reviewedAt: string
}
```

### WeeklyReview
```ts
type WeeklyReview = {
  id: string
  weekStart: string         // Monday ISO date
  reflectionNote?: string
  reviewedAt: string
}
```

---

## Navigation

Bottom tab bar (always visible):

```
[ Today ] [ Plan ] [ Calendar ] [ Analytics ] [ Review ] [ Settings ]
```

---

## Build Phases

Each phase is independently shippable. Do not start the next phase until the current one is in daily use.

---

## Phase 1 — Core Planning Loop

**Goal:** User can create, view, and update tasks for the day.

### Screens

#### Today Screen (`/`)
- List of tasks for today grouped by time (or unscheduled at bottom)
- Each task shows: title, category badge, planned time, status
- Tap task → Task Detail Sheet
- FAB (floating button) → Quick Add Task
- Empty state: "No tasks planned. Add one."

#### Quick Add Task (bottom sheet)
- Fields: title (required), category, planned date, planned time, notes
- Save button
- Dismiss on outside tap

#### Task Detail Sheet
- Shows all task fields
- Status action buttons: Mark Done / Miss / Skip
- When marking Done: store `completedAt = now()`
- When marking Done Late: `completedAt = now()`, status = `done_late` (auto if completed after plannedTime)
- Edit button → Edit Task Screen
- Delete button (with confirm)

#### Edit Task Screen (`/task/[id]/edit`)
- Full form: title, notes, category, date, time, checklist, recurring toggle + rule
- Save / Cancel

### Logic
- On app open: default to today's date
- Tasks sorted by plannedTime ascending, unscheduled tasks at bottom
- Recurring tasks: generate task instances daily from recurringRule (generate 30 days ahead)
- Categories: user-defined list stored in settings, with defaults: Work, Health, Personal, Other

### Data (Convex)
- `tasks` table with schema above
- `getTasksByDate(date: string)` query
- `createTask(task)` mutation
- `updateTask(id, fields)` mutation
- `deleteTask(id)` mutation

---

## Phase 2 — Reminders & End-of-Day Review

**Goal:** App reminds user of tasks and holds them accountable at end of day.

### Web Push Notifications
- Request permission on first app open (after user creates first task)
- One reminder per task (at plannedTime, or user-set offset: 0 / 5 / 10 / 15 / 30 min before)
- Evening planning reminder: daily at 9pm (configurable in Settings)
- Weekly review reminder: Sunday at 7pm (configurable)
- Notification actions: "Done" | "Snooze 15min" | "Skip"
- Snooze: reschedule notification 15 min forward, do not change task status
- iOS note: Web Push only works on iOS 16.4+ after PWA is added to home screen. Show a banner on iOS Safari prompting "Add to Home Screen to enable notifications."

### PWA Setup
- `manifest.json`: name, short_name, icons (192, 512), theme_color, background_color, display: standalone
- Service worker: handle push events, notification click routing
- Install prompt: show "Add to Home Screen" banner after 2 uses

### End-of-Day Review Screen (`/review/daily`)
- Triggered by: tap Review tab OR evening notification
- Shows three sections:
  - Completed (done, done_late)
  - Unfinished (planned, missed)
  - Skipped
- For each unfinished task, user chooses:
  - Carry forward (reschedules to tomorrow)
  - Skip (sets status = skipped)
  - Reschedule (date picker)
- Optional reflection note (textarea, max 500 chars)
- Submit → saves DailyReview record

### Data (Convex)
- `dailyReviews` table
- `createDailyReview(review)` mutation
- `getDailyReview(date)` query

---

## Phase 3 — Analytics

**Goal:** User sees completion patterns over time.

### Analytics Screen (`/analytics`)

Tabs: Day | Week | Month

#### Daily Tab
- Completion % (done + done_late / total planned)
- Done late % 
- Missed %
- Bar chart: task status breakdown for selected date
- Date picker to navigate days

#### Weekly Tab
- Weekly score = completion % across 7 days
- Bar chart: daily completion % for the week
- Category completion breakdown (pie or horizontal bar)
- Recurring task adherence % (recurring done / recurring planned)
- Most missed tasks list (top 3)

#### Monthly Tab
- Monthly score = avg daily completion %
- Line chart: daily score across the month
- Best day / Worst day
- Trend: improving / declining / stable (compare last 2 weeks)

### Behavioral Insights Panel (bottom of Analytics screen)
Show only when there is enough data (7+ days). Each insight is one line with an emoji icon.

- 📉 Overplanning: "You plan X tasks/day but complete Y on average"
- ⏰ Delay pattern: "Most missed tasks are in [category]"
- 🔁 Recurring adherence: "You complete [habit] X% of the time"
- 📆 Best time: "You complete most tasks before [time]"

### Data (Convex)
- `getTasksInRange(startDate, endDate)` query
- All analytics computed client-side from task data using Recharts

---

## Phase 4 — Calendar & Google Calendar Sync

**Goal:** See tasks alongside real calendar events.

### Calendar Screen (`/calendar`)

#### Weekly View (default)
- 7-column grid, time slots on Y axis (6am–11pm)
- Tasks shown as colored blocks at their plannedTime
- Google Calendar events shown in a different color/style
- Tap task → Task Detail Sheet
- Tap empty slot → Quick Add with that date/time pre-filled
- Swipe left/right to navigate weeks

#### Daily Timeline View
- Single column, time slots
- Tasks + GCal events merged
- Conflict indicator: red border if two items overlap

### Google Calendar Integration
- OAuth 2.0 via Google (setup in Settings)
- Read-only: fetch events for visible range
- Display GCal events as non-interactive blocks
- Conflict detection: if a task's plannedTime overlaps a GCal event, show warning badge on task
- Refresh on calendar mount and every 15 min while screen is open
- No write to GCal in v1

### Data
- GCal events stored in local state only (not persisted to Convex)
- `useGoogleCalendar(startDate, endDate)` hook handles OAuth + fetch

---

## Phase 5 — AI Layer

**Goal:** App surfaces insights the user wouldn't calculate manually.

### AI Weekly Summary
- Triggered: after weekly review is submitted, OR manually from Analytics tab
- Input to Claude: tasks from last 7 days (title, status, category, plannedTime, completedAt), weekly review reflection note
- Output: 3–5 sentence summary covering: what went well, what was missed, one observation about patterns
- Displayed in: Weekly Review screen and Analytics > Week tab
- Model: claude-sonnet-4-20250514
- Max tokens: 400

### AI Monthly Summary
- Same pattern, uses last 30 days of data
- Output: paragraph summary + 3 bullet suggestions
- Displayed in: Analytics > Month tab

### Missed Task Analysis
- Triggered: when user views a task that has been missed 3+ times in last 14 days
- Output: one-line observation ("You've missed this task every Monday — consider rescheduling it")
- Inline in Task Detail Sheet

### Overload Warning
- Triggered: when user adds a task to a day that already has 7+ tasks
- Output: "You have X tasks planned for [date]. Historically you complete Y on busy days. Consider moving some tasks."
- Shown as dismissable toast

### AI Prompt Pattern (use for all AI calls)
```
System: You are a personal productivity assistant. Be concise, direct, and honest. 
        Never use filler phrases. Output plain text only, no markdown.

User: [structured task data as JSON] + [specific instruction]
```

### Cost Note
Personal use only. At ~1 AI call/week, cost is negligible. If sharing with others later, add usage tracking.

---

## Phase 6 — Auto Scheduling + Polish

**Goal:** App thinks ahead so user doesn't have to.

### Auto Scheduling
- "Schedule for me" button in Quick Add: suggests best available time slot based on:
  - Existing tasks that day (avoid overlap)
  - GCal events (avoid conflict)
  - User's historical productive hours (from analytics)
- Overloaded day detection: if day has 7+ tasks, show warning badge on that date in weekly view
- Reschedule unfinished: in end-of-day review, offer "Smart reschedule" which picks best day in next 3 days with fewest tasks

### Smart Task Spacing
- When creating recurring task, suggest time based on similar existing recurring tasks to spread load

### Data Export / Import
- Settings → Export Data → downloads JSON of all tasks + reviews
- Settings → Import Data → accepts JSON, merges (no duplicates by id)
- JSON schema matches Task and Review types above

### Full PWA Polish
- App icon (all sizes)
- Splash screen
- Offline fallback page: "You're offline. Your data will sync when you reconnect."
- Add to Home Screen banner with instructions
- `theme-color` meta tag for browser chrome

---

## Settings Screen (`/settings`)

| Setting | Type | Default |
|---|---|---|
| Categories | Editable list | Work, Health, Personal, Other |
| Evening reminder time | Time picker | 9:00 PM |
| Weekly review reminder | Day + time | Sunday 7:00 PM |
| Default reminder offset | Select (0/5/10/15/30 min) | 10 min |
| Google Calendar | Connect / Disconnect | — |
| Timezone | Auto-detected | System |
| Export Data | Button | — |
| Import Data | Button | — |

---

## Error States

Handle these explicitly:

| Scenario | Behavior |
|---|---|
| Convex offline | Show banner "Syncing paused", queue writes locally |
| Push notification denied | Show inline prompt explaining how to re-enable |
| GCal auth expired | Show "Reconnect Google Calendar" banner in Calendar tab |
| GCal fetch fails | Show cached events with "Could not refresh" message |
| AI call fails | Hide AI section silently, show retry button |
| iOS + not installed as PWA | Show persistent banner: "Add to Home Screen for notifications" |

---

## iOS PWA Notes

- Web Push requires iOS 16.4+ AND app added to home screen
- Standalone mode (`display: standalone` in manifest) is required
- Test on actual device — iOS simulator does not support push
- Show "Add to Home Screen" instructions (with screenshots) on first launch on iOS Safari

---

## File Structure (suggested)

```
/app
  /page.tsx                  → Today screen
  /plan/page.tsx             → Plan screen
  /calendar/page.tsx         → Calendar screen
  /analytics/page.tsx        → Analytics screen
  /review
    /daily/page.tsx
    /weekly/page.tsx
  /settings/page.tsx

/components
  /tasks
    TaskCard.tsx
    TaskDetailSheet.tsx
    QuickAddSheet.tsx
    EditTaskForm.tsx
  /analytics
    DailyStats.tsx
    WeeklyStats.tsx
    MonthlyStats.tsx
    InsightsPanel.tsx
  /calendar
    WeeklyCalendar.tsx
    DailyTimeline.tsx
  /ui                        → shadcn/ui components
  BottomNav.tsx

/convex
  schema.ts
  tasks.ts
  reviews.ts

/hooks
  useGoogleCalendar.ts
  usePushNotifications.ts
  useAI.ts

/lib
  analytics.ts               → pure functions for computing stats
  scheduler.ts               → auto-scheduling logic
  ai.ts                      → Claude API wrapper
```

---

## Phase Summary

| Phase | Core Deliverable | Done When |
|---|---|---|
| 1 | Create, view, update tasks | Using it daily |
| 2 | Push reminders + end-of-day review | Phone buzzes, you respond in app |
| 3 | Analytics dashboards | Sunday review gives real insight |
| 4 | Calendar + Google Calendar sync | No longer switching to GCal |
| 5 | AI summaries and insights | AI says something you didn't know |
| 6 | Auto scheduling + PWA polish | App feels complete and installed |

**Rule: Do not start Phase N+1 until Phase N is part of your daily routine.**
