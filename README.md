# LifeOS

LifeOS is a personal planning workspace built with Next.js, React, Tailwind CSS, Convex, and Clerk.

The current product surface is TrackDaily: a mobile-first task planner with daily planning, seven-day planning, calendar conflict views, analytics, reviews, settings, PWA metadata, and basic notification hooks.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Convex backend
- Clerk authentication
- lucide-react icons
- PWA manifest and service worker

## Requirements

- Node.js 20 or newer
- npm
- Convex project
- Clerk application with a Convex JWT template named `convex`

## Environment

Create `.env.local` with:

```bash
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_JWT_ISSUER_DOMAIN=
```

Clerk must return a token for the `convex` JWT template with audience `convex`. Without these values the app intentionally shows a configuration or auth connection screen instead of falling back to local storage.

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

Both commands pass on the current working tree.

## App Routes

- `/` - LifeOS hub
- `/trackdaily` - Today view
- `/trackdaily/plan` - Seven-day plan
- `/trackdaily/calendar` - Timeline and mock Google Calendar conflict view
- `/trackdaily/analytics` - Completion, category, and behavior metrics
- `/trackdaily/review` - Daily and weekly review flows
- `/trackdaily/settings` - Profile, categories, reminders, calendar mock toggle, import/export

## Current Notes

- Convex plus Clerk is the only supported task data path.
- Google Calendar is currently mocked with local toggle state.
- PWA install metadata and basic service worker caching are included.
- Browser notification permission and local notification scheduling hooks exist, but full production web push, snooze, and notification action handling are not complete.
- The project includes Next.js 16 generated docs in `node_modules/next/dist/docs/`; read the relevant guide before changing framework-level routing, config, or API patterns.

## Deployment

The app is suitable for Vercel once the Convex and Clerk environment variables are configured in the deployment environment.
