// src/components/MultisessionAppSupport.tsx
'use client';
import { useSession } from '@clerk/nextjs';
import React from 'react';

/**
 * Forces a full React re‑render whenever the active Clerk session changes.
 * This is recommended when multi‑session handling is enabled in the Clerk dashboard.
 */
export function MultisessionAppSupport({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useSession();
  // Using the session ID as a key forces React to recreate the subtree on session switch.
  return <React.Fragment key={session?.id ?? 'no-session'}>{children}</React.Fragment>;
}
