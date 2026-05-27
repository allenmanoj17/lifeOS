import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";

const calendarStatusValidator = v.union(
  v.literal("not_connected"),
  v.literal("connecting"),
  v.literal("synced"),
  v.literal("failed"),
  v.literal("permission_missing")
);

const calendarEventInputValidator = v.object({
  externalId: v.string(),
  calendarId: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  start: v.string(),
  end: v.string(),
  isAllDay: v.boolean(),
  location: v.optional(v.string()),
  updatedAt: v.string(),
});

type AuthInfo = {
  canonicalUserId: string;
  readableUserIds: string[];
};

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

function assertIso(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be an ISO datetime`);
  }
}

function assertEvent(event: {
  externalId: string;
  calendarId: string;
  title: string;
  start: string;
  end: string;
  updatedAt: string;
}) {
  if (!event.externalId.trim()) throw new Error("externalId cannot be empty");
  if (!event.calendarId.trim()) throw new Error("calendarId cannot be empty");
  if (!event.title.trim()) throw new Error("title cannot be empty");
  assertIso(event.start, "start");
  assertIso(event.end, "end");
  assertIso(event.updatedAt, "updatedAt");
  if (event.end <= event.start) throw new Error("Calendar event end must be after start");
}

export const getGoogleCalendarState = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getOptionalAuth(ctx);
    if (!auth) return null;

    for (const userId of auth.readableUserIds) {
      const account = await ctx.db
        .query("calendarAccounts")
        .withIndex("by_userId_and_provider", (q) => q.eq("userId", userId).eq("provider", "google"))
        .unique();
      if (account) return account;
    }

    return null;
  },
});

export const getEventsInRange = query({
  args: {
    start: v.string(),
    end: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await getOptionalAuth(ctx);
    if (!auth) return [];
    assertIso(args.start, "start");
    assertIso(args.end, "end");
    if (args.end <= args.start) throw new Error("Range end must be after start");

    const groups = await Promise.all(
      auth.readableUserIds.map((userId) =>
        ctx.db
          .query("calendarEvents")
          .withIndex("by_userId_and_start", (q) => q.eq("userId", userId).gte("start", args.start))
          .filter((q) => q.lt(q.field("start"), args.end))
          .collect()
      )
    );

    return groups
      .flat()
      .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  },
});

export const setGoogleCalendarStatus = mutation({
  args: {
    status: calendarStatusValidator,
    email: v.optional(v.string()),
    providerAccountId: v.optional(v.string()),
    approvedScopes: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("calendarAccounts")
      .withIndex("by_userId_and_provider", (q) =>
        q.eq("userId", auth.canonicalUserId).eq("provider", "google")
      )
      .unique();

    const fields = {
      provider: "google" as const,
      status: args.status,
      email: args.email,
      providerAccountId: args.providerAccountId,
      approvedScopes: args.approvedScopes,
      error: args.error,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }

    return await ctx.db.insert("calendarAccounts", {
      ...fields,
      userId: auth.canonicalUserId,
      createdAt: now,
    });
  },
});

export const replaceGoogleEvents = mutation({
  args: {
    rangeStart: v.string(),
    rangeEnd: v.string(),
    email: v.optional(v.string()),
    providerAccountId: v.optional(v.string()),
    approvedScopes: v.optional(v.string()),
    events: v.array(calendarEventInputValidator),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    assertIso(args.rangeStart, "rangeStart");
    assertIso(args.rangeEnd, "rangeEnd");
    if (args.rangeEnd <= args.rangeStart) throw new Error("Sync range end must be after start");
    for (const event of args.events) assertEvent(event);

    const now = new Date().toISOString();
    const account = await ctx.db
      .query("calendarAccounts")
      .withIndex("by_userId_and_provider", (q) =>
        q.eq("userId", auth.canonicalUserId).eq("provider", "google")
      )
      .unique();

    if (account) {
      await ctx.db.patch(account._id, {
        status: "synced",
        email: args.email,
        providerAccountId: args.providerAccountId,
        approvedScopes: args.approvedScopes,
        lastSyncedAt: now,
        syncRangeStart: args.rangeStart,
        syncRangeEnd: args.rangeEnd,
        error: undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("calendarAccounts", {
        userId: auth.canonicalUserId,
        provider: "google",
        status: "synced",
        email: args.email,
        providerAccountId: args.providerAccountId,
        approvedScopes: args.approvedScopes,
        lastSyncedAt: now,
        syncRangeStart: args.rangeStart,
        syncRangeEnd: args.rangeEnd,
        updatedAt: now,
        createdAt: now,
      });
    }

    const existing = await ctx.db
      .query("calendarEvents")
      .withIndex("by_userId_and_start", (q) =>
        q.eq("userId", auth.canonicalUserId).gte("start", args.rangeStart)
      )
      .filter((q) => q.lt(q.field("start"), args.rangeEnd))
      .collect();
    const seen = new Set(args.events.map((event) => event.externalId));

    for (const doc of existing) {
      if (doc.provider === "google" && !seen.has(doc.externalId)) {
        await ctx.db.delete(doc._id);
      }
    }

    for (const event of args.events) {
      const current = await ctx.db
        .query("calendarEvents")
        .withIndex("by_userId_and_provider_and_externalId", (q) =>
          q.eq("userId", auth.canonicalUserId).eq("provider", "google").eq("externalId", event.externalId)
        )
        .unique();
      const fields = {
        ...event,
        provider: "google" as const,
        syncedAt: now,
      };
      if (current) await ctx.db.patch(current._id, fields);
      else await ctx.db.insert("calendarEvents", { ...fields, userId: auth.canonicalUserId });
    }

    return args.events.length;
  },
});

