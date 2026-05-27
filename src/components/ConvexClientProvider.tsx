"use client";

import { ReactNode, useMemo, useEffect, useState } from "react";
import { ClerkProvider, SignInButton, useAuth } from "@clerk/nextjs";
import { ConvexReactClient, useConvexAuth } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ArrowRight, Clock, Lock } from "lucide-react";
import { MultisessionAppSupport } from "@/components/MultisessionAppSupport";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function formatClockTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function ConfigErrorScreen({ missing }: { missing: string[] }) {
  return (
    <div className="min-h-screen bg-[#f7f7f9] text-slate-800 flex items-center justify-center px-6 font-jakarta">
      <div className="max-w-md w-full glass-panel p-6 border border-rose-200">
        <div className="flex items-center gap-2 text-rose-600 font-black text-sm uppercase tracking-widest">
          <Lock className="w-4 h-4" />
          Configuration Required
        </div>
        <p className="text-xs text-slate-600 leading-relaxed mt-3">
          LifeOS now requires Convex and Clerk. Add the missing environment
          variables before loading the app.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {missing.map((name) => (
            <code
              key={name}
              className="text-[11px] bg-rose-500/5 border border-rose-500/15 text-rose-700 px-3 py-2 rounded-lg"
            >
              {name}
            </code>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated: isConvexAuthenticated, isLoading: isConvexLoading } = useConvexAuth();
  const {
    isLoaded: isClerkLoaded,
    isSignedIn,
    getToken,
  } = useAuth();
  const [time, setTime] = useState(formatClockTime);
  const [convexTokenChecked, setConvexTokenChecked] = useState(false);
  const [hasConvexToken, setHasConvexToken] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTime(formatClockTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isClerkLoaded || !isSignedIn) {
      return;
    }

    let isMounted = true;
    void getToken({ template: "convex" })
      .then((token) => {
        if (!isMounted) return;
        setHasConvexToken(Boolean(token));
        setConvexTokenChecked(true);
      })
      .catch(() => {
        if (!isMounted) return;
        setHasConvexToken(false);
        setConvexTokenChecked(true);
      });

    return () => {
      isMounted = false;
    };
  }, [getToken, isClerkLoaded, isSignedIn]);

  if (!isClerkLoaded || isConvexLoading) {
    return (
      <div className="min-h-screen bg-[#f6f7f9] text-slate-800 flex flex-col justify-center items-center font-jakarta relative">
        <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
          <svg className="w-full h-full animate-spin">
            <circle cx="32" cy="32" r="26" className="stroke-slate-200" strokeWidth="4" fill="transparent" />
            <circle
              cx="32"
              cy="32"
              r="26"
              className="stroke-sky-500"
              strokeWidth="4"
              fill="transparent"
              strokeDasharray={163.36}
              strokeDashoffset={40}
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span className="text-[10px] text-sky-600 font-bold tracking-widest uppercase mt-4 animate-pulse">
          Loading workspace...
        </span>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#f6f7f9] text-slate-800 flex flex-col justify-center px-6 font-jakarta relative overflow-hidden">
        <div className="max-w-md w-full mx-auto glass-panel p-8 flex flex-col items-center text-center relative">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-sky-700 font-bold bg-sky-500/5 border border-sky-500/10 px-3 py-1 rounded-lg mb-6">
            <Clock className="w-3.5 h-3.5 text-sky-600" />
            <span>{time}</span>
          </div>

          <div className="p-4 bg-sky-50 border border-sky-100 rounded-lg text-sky-700 mb-5">
            <Lock className="w-8 h-8" />
          </div>

          <h1 className="text-xl font-semibold text-slate-950 tracking-tight">
            Sign in to LifeOS
          </h1>

          <p className="text-xs text-slate-500 mt-2.5 leading-relaxed max-w-[280px]">
            Your tasks and reviews are stored in Convex and require your Clerk account.
          </p>

          <div className="mt-8 w-full">
            <SignInButton mode="redirect" forceRedirectUrl="/trackdaily">
              <button className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-widest rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 group">
                Sign in
                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </button>
            </SignInButton>
          </div>

          <div className="text-[9px] font-mono text-slate-400 mt-6 tracking-widest uppercase">
            Convex + Clerk
          </div>
        </div>
      </div>
    );
  }

  if (!isConvexAuthenticated) {
    const detail = convexTokenChecked && !hasConvexToken
      ? "Clerk is signed in, but the Clerk JWT template named \"convex\" is not returning a token."
      : "Clerk is signed in, but Convex has not accepted the auth token yet.";

    return (
      <div className="min-h-screen bg-[#f7f7f9] text-slate-800 flex items-center justify-center px-6 font-jakarta">
        <div className="max-w-md w-full glass-panel p-6 border border-amber-200">
          <div className="flex items-center gap-2 text-amber-700 font-black text-sm uppercase tracking-widest">
            <Lock className="w-4 h-4" />
            Convex Auth Not Connected
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mt-3">{detail}</p>
          <div className="mt-4 text-[11px] text-slate-600 leading-relaxed bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
            In Clerk, enable the Convex integration/JWT template named{" "}
            <code className="font-mono font-bold">convex</code>, make sure its
            audience is <code className="font-mono font-bold">convex</code>,
            then restart Convex/Next and sign out and back in.
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function ConvexClientProvider({
  children,
  serverMissingEnv = [],
}: {
  children: ReactNode;
  serverMissingEnv?: string[];
}) {
  const clientMissingEnv: string[] = [];
  if (!convexUrl) clientMissingEnv.push("NEXT_PUBLIC_CONVEX_URL");
  if (!clerkPublishableKey) {
    clientMissingEnv.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  }
  const missing = clientMissingEnv.concat(serverMissingEnv);

  const convex = useMemo(
    () => (convexUrl ? new ConvexReactClient(convexUrl) : null),
    []
  );

  if (missing.length > 0 || !convex || !clerkPublishableKey) {
    return <ConfigErrorScreen missing={missing} />;
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <AuthGate>
          <MultisessionAppSupport>{children}</MultisessionAppSupport>
        </AuthGate>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
