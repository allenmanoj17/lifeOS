import { auth, clerkClient } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

type GoogleEventDate = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  start?: GoogleEventDate;
  end?: GoogleEventDate;
  location?: string;
  updated?: string;
};

function toIso(date: GoogleEventDate | undefined, isEnd = false) {
  if (!date) return null;
  if (date.dateTime) return new Date(date.dateTime).toISOString();
  if (date.date) return new Date(`${date.date}T${isEnd ? "23:59:59" : "00:00:00"}.000Z`).toISOString();
  return null;
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const timeMin = url.searchParams.get("timeMin");
  const timeMax = url.searchParams.get("timeMax");
  if (!timeMin || !timeMax || Number.isNaN(Date.parse(timeMin)) || Number.isNaN(Date.parse(timeMax))) {
    return Response.json({ error: "timeMin and timeMax ISO query params are required" }, { status: 400 });
  }

  const client = await clerkClient();
  const tokenResponse = await client.users.getUserOauthAccessToken(userId, "google");
  const token = tokenResponse.data[0];
  const scopes = token?.scopes ?? [];
  if (!token) {
    return Response.json({ error: "Google account is not connected", status: "not_connected" }, { status: 409 });
  }
  if (!scopes.includes("https://www.googleapis.com/auth/calendar.readonly")) {
    return Response.json(
      {
        error: "Google Calendar read-only permission is missing",
        status: "permission_missing",
        scopes,
      },
      { status: 403 }
    );
  }

  const googleUrl = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  googleUrl.searchParams.set("singleEvents", "true");
  googleUrl.searchParams.set("orderBy", "startTime");
  googleUrl.searchParams.set("timeMin", timeMin);
  googleUrl.searchParams.set("timeMax", timeMax);
  googleUrl.searchParams.set("maxResults", "250");

  const response = await fetch(googleUrl, {
    headers: { Authorization: `Bearer ${token.token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    return Response.json(
      { error: "Google Calendar sync failed", status: "failed", detail: await response.text() },
      { status: response.status }
    );
  }

  const payload = (await response.json()) as { items?: GoogleEvent[] };
  const events = (payload.items ?? [])
    .map((item) => {
      const start = toIso(item.start);
      const end = toIso(item.end, true);
      if (!start || !end) return null;
      return {
        externalId: item.id,
        calendarId: "primary",
        title: item.summary?.trim() || "Busy",
        description: item.description,
        start,
        end,
        isAllDay: Boolean(item.start?.date && !item.start?.dateTime),
        location: item.location,
        updatedAt: item.updated ? new Date(item.updated).toISOString() : new Date().toISOString(),
      };
    })
    .filter((event): event is NonNullable<typeof event> => Boolean(event));

  return Response.json({
    status: "synced",
    providerAccountId: token.externalAccountId,
    approvedScopes: scopes.join(" "),
    events,
  });
}

