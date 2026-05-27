"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  CheckSquare, 
  CalendarRange, 
  TrendingUp, 
  ClipboardCheck, 
  Settings,
  Home,
  Plus
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: "Today", href: "/trackdaily", icon: CheckSquare },
  { label: "Plan", href: "/trackdaily/plan", icon: Plus },
  { label: "Calendar", href: "/trackdaily/calendar", icon: CalendarRange },
  { label: "Analytics", href: "/trackdaily/analytics", icon: TrendingUp },
  { label: "Review", href: "/trackdaily/review", icon: ClipboardCheck },
  { label: "Settings", href: "/trackdaily/settings", icon: Settings },
];

export default function TrackDailyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Helper to determine active tab
  const isActive = (href: string) => {
    if (href === "/trackdaily") {
      return pathname === "/trackdaily";
    }
    return pathname.startsWith(href);
  };

  // Get active section label for header
  const getActiveLabel = () => {
    if (pathname === "/trackdaily") return "Today's Focus";
    if (pathname.startsWith("/trackdaily/settings")) return "Settings";
    if (pathname.startsWith("/trackdaily/plan")) return "Plan Dashboard";
    if (pathname.startsWith("/trackdaily/calendar")) return "Calendar Matrix";
    if (pathname.startsWith("/trackdaily/analytics")) return "Analytics Engine";
    if (pathname.startsWith("/trackdaily/review")) return "EOD Reflection";
    return "TrackDaily";
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-24 animate-fade-in">
      {/* Top Header Nav */}
      <header className="flex items-center justify-between py-4 mb-4 border-b border-white/5 sticky top-0 bg-background/80 backdrop-blur-md z-40">
        <div className="flex items-center gap-2">
          <Link 
            href="/" 
            className="p-2 hover:bg-zinc-800/50 rounded-lg text-zinc-400 hover:text-white transition-colors"
            title="Go to LifeOS Hub"
          >
            <Home className="w-4 h-4" />
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="text-sm font-bold text-white tracking-wide">{getActiveLabel()}</span>
        </div>
        <div className="text-[10px] uppercase tracking-wider font-semibold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/15">
          TrackDaily
        </div>
      </header>

      {/* Main Page Area */}
      <div className="flex-1 flex flex-col">
        {children}
      </div>

      {/* Premium Floating Bottom Navigation Bar */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md glass-panel p-2 rounded-2xl flex items-center justify-around shadow-2xl border border-white/10 z-50">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex flex-col items-center gap-1 py-1.5 px-3.5 rounded-xl transition-all duration-300 relative group`}
            >
              {/* Highlight background for active */}
              {active && (
                <span className="absolute inset-0 bg-purple-500/15 border border-purple-500/25 rounded-xl -z-10 animate-fade-in"></span>
              )}
              
              <Icon 
                className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                  active ? "text-purple-300" : "text-zinc-500 hover:text-zinc-300"
                }`} 
              />
              <span 
                className={`text-[9px] font-semibold tracking-wide transition-colors ${
                  active ? "text-purple-300 font-bold" : "text-zinc-500"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
