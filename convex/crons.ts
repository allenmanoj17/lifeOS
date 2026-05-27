import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "dispatch due reminders",
  { minutes: 1 },
  internal.push.dispatchDueNotifications,
  {}
);

export default crons;

