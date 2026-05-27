"use client";

import React, { ReactNode, useState, useEffect } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useConvexAuth } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { Lock, Sparkles, Clock } from "lucide-react";

// Get the environment variables
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 1. Loading state - Show glowing cyber spin loader in light mode
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f7f7f9] text-slate-800 flex flex-col justify-center items-center font-jakarta scanline relative">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
          <svg className="w-full h-full animate-spin">
            <circle cx="32" cy="32" r="26" className="stroke-slate-200" strokeWidth="4" fill="transparent" />
            <circle cx="32" cy="32" r="26" className="stroke-indigo-600" strokeWidth="4" fill="transparent" strokeDasharray={163.36} strokeDashoffset={40} strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-[10px] text-indigo-650 font-bold tracking-widest uppercase mt-4 animate-pulse">Syncing mainframe...</span>
      </div>
    );
  }

  // 2. Unauthenticated state - Show cockpit console login gate in light mode
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f7f7f9] text-slate-800 flex flex-col justify-center px-6 font-jakarta scanline relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-10 left-10 w-48 h-48 bg-sky-500/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* Central Terminal Console Box */}
        <div className="max-w-md w-full mx-auto glass-panel p-8 rounded-3xl border border-indigo-500/10 shadow-[0_4px_30px_rgba(99,102,241,0.04)] flex flex-col items-center text-center relative">
          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-indigo-500/20 rounded-tr-md"></div>
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-indigo-500/20 rounded-bl-md"></div>

          {/* Clock Header */}
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-indigo-700 font-bold bg-indigo-500/5 border border-indigo-500/10 px-3 py-1 rounded-lg mb-6">
            <Clock className="w-3.5 h-3.5 text-indigo-650" />
            <span>TIME: {time}</span>
          </div>

          {/* Lock Icon glowing container */}
          <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl text-indigo-600 mb-5 relative group shadow-inner">
            <Lock className="w-8 h-8 animate-pulse-glow" />
            <div className="absolute inset-0 border border-indigo-400/20 rounded-2xl scale-110 opacity-20 animate-ping"></div>
          </div>

          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-1.5 justify-center">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            CONNECT TO MAINFRAME
          </h1>
          
          <p className="text-xs text-slate-500 mt-2.5 leading-relaxed max-w-[280px]">
            Access to lifeOS databases and behavioral matrices requires verified cryptographic identity signature.
          </p>

          <div className="mt-8 w-full">
            <SignInButton mode="modal">
              <button className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-850 hover:from-indigo-550 hover:to-indigo-800 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_4px_15px_rgba(99,102,241,0.25)] cursor-pointer">
                Authorize Access
              </button>
            </SignInButton>
          </div>
          
          <div className="text-[9px] font-mono text-slate-400 mt-6 tracking-widest">
            SECURE PORT CONVEX-CLERK v1.0
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated state - Render app pages
  return <>{children}</>;
}

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  // Use state to initialize once to avoid recreation on re-renders
  const [convex] = useState(() => {
    if (convexUrl) {
      console.log("Convex backend URL detected. Enabling real-time database sync.");
      return new ConvexReactClient(convexUrl);
    } else {
      console.log("No Convex backend URL detected. Running in Local Storage fallback mode.");
      return null;
    }
  });

  // 1. Fallback: No Convex URL configured -> pure LocalStorage mode
  if (!convex) {
    return <>{children}</>;
  }

  // 2. Fallback: Convex URL is configured, but Clerk Publishable Key is absent -> run Convex without auth
  if (!clerkPublishableKey) {
    console.log("Clerk Publishable Key not found. Starting Convex in unauthenticated mode.");
    return <ConvexProvider client={convex}>{children}</ConvexProvider>;
  }

  // 3. Fully Authenticated Mode: Both Convex and Clerk are configured
  console.log("Clerk credentials and Convex URL detected. Initializing Authenticated Mainframe.");
  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <AuthGate>{children}</AuthGate>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
