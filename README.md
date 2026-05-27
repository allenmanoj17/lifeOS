# Epta LifeOS

Epta LifeOS is a warm personal planning workspace built with Next.js, React, Tailwind CSS, Convex, and Clerk.

The current product surface is TrackDaily: a task planner with daily planning, seven-day planning, Google Calendar conflict views, analytics, reviews, settings, PWA metadata, and Web Push reminder registration.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Convex backend
- Clerk authentication and Google OAuth
- lucide-react icons
- PWA manifest and service worker

## Requirements

- Node.js 20 or newer
- npm
- Convex project
- Clerk application with a Convex JWT template named `convex`
- Google OAuth enabled in Clerk with Calendar read-only scope
- VAPID keys for production Web Push

## Environment

Create `.env.local` with:

```bash
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_JWT_ISSUER_DOMAIN=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
TRACKDAILY_TEST_SEED_SECRET=
```

Clerk must return a token for the `convex` JWT template with audience `convex`. Without the required Convex and Clerk values the app intentionally shows a configuration or auth connection screen instead of falling back to local storage.

For Google Calendar sync, Clerk's Google provider must request or allow:

```text
https://www.googleapis.com/auth/calendar.readonly
```

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

Run these before pushing:

```bash
npm run lint
npm run build
```

## App Routes

- `/` - Epta LifeOS hub
- `/trackdaily` - Today view
- `/trackdaily/plan` - Seven-day plan
- `/trackdaily/calendar` - Timeline and synced Google Calendar conflict view
- `/trackdaily/analytics` - Completion, category, and behavior metrics
- `/trackdaily/review` - Daily and weekly review flows
- `/trackdaily/settings` - Profile, categories, reminders, calendar sync, import/export

## Current Notes

- Convex plus Clerk is the only supported task data path.
- Calendar events are cached in Convex per authenticated user after Clerk Google OAuth authorization.
- Reminder settings, push device subscriptions, task reminder schedules, notification logs, and cron-based Web Push dispatch are stored and run through Convex.
- Browser notification fallback reminders still run while the app is open; production Web Push dispatch requires the server-only VAPID private key in the Convex deployment environment.
- The project includes Next.js 16 generated docs in `node_modules/next/dist/docs/`; read the relevant guide before changing framework-level routing, config, or API patterns.
