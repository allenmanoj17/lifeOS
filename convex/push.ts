"use node";

import webpush from "web-push";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";

type PushDelivery = {
  kind: "task" | "evening_review" | "weekly_review";
  userId: string;
  subscriptionId: Id<"pushSubscriptions">;
  scheduleId?: Id<"taskReminderSchedules">;
  taskId?: Id<"tasks">;
  actionKey?: string;
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  payload: {
    title: string;
    body: string;
    icon?: string;
    tag?: string;
    data?: Record<string, string>;
    actions?: Array<{ action: string; title: string }>;
  };
};

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

  if (!publicKey || !privateKey) {
    throw new Error("VAPID_PUBLIC_KEY/NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function shouldDisableSubscription(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const statusCode = "statusCode" in error ? Number(error.statusCode) : 0;
  return statusCode === 404 || statusCode === 410;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Push send failed";
}

export const dispatchDueNotifications = internalAction({
  args: { now: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = args.now ?? new Date().toISOString();
    const taskDeliveries: PushDelivery[] = await ctx.runQuery(
      internal.reminders.listDuePushDeliveries,
      { now }
    );
    const reviewDeliveries: PushDelivery[] = await ctx.runQuery(
      internal.reminders.listDueReviewDeliveries,
      { now }
    );
    const deliveries = [...taskDeliveries, ...reviewDeliveries];

    try {
      configureWebPush();
    } catch (error) {
      for (const delivery of deliveries) {
        await ctx.runMutation(internal.reminders.recordPushDispatch, {
          userId: delivery.userId,
          kind: delivery.kind,
          taskId: delivery.taskId,
          scheduleId: delivery.scheduleId,
          subscriptionId: delivery.subscriptionId,
          title: delivery.payload.title,
          body: delivery.payload.body,
          status: "failed",
          error: errorMessage(error),
          actionKey: delivery.actionKey,
          disableSubscription: false,
        });
      }
      return { sent: 0, failed: deliveries.length };
    }

    let sent = 0;
    let failed = 0;
    for (const delivery of deliveries) {
      try {
        await webpush.sendNotification(delivery.subscription, JSON.stringify(delivery.payload));
        sent += 1;
        await ctx.runMutation(internal.reminders.recordPushDispatch, {
          userId: delivery.userId,
          kind: delivery.kind,
          taskId: delivery.taskId,
          scheduleId: delivery.scheduleId,
          subscriptionId: delivery.subscriptionId,
          title: delivery.payload.title,
          body: delivery.payload.body,
          status: "delivered",
          actionKey: delivery.actionKey,
          disableSubscription: false,
        });
      } catch (error) {
        failed += 1;
        await ctx.runMutation(internal.reminders.recordPushDispatch, {
          userId: delivery.userId,
          kind: delivery.kind,
          taskId: delivery.taskId,
          scheduleId: delivery.scheduleId,
          subscriptionId: delivery.subscriptionId,
          title: delivery.payload.title,
          body: delivery.payload.body,
          status: "failed",
          error: errorMessage(error),
          actionKey: delivery.actionKey,
          disableSubscription: shouldDisableSubscription(error),
        });
      }
    }

    return { sent, failed };
  },
});
