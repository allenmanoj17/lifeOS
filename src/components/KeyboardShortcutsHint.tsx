"use client";

import React, { useState, useEffect } from "react";
import { Command, ArrowRight, ArrowLeft, X, HelpCircle } from "lucide-react";

export function KeyboardShortcutsHint() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Show hint after 3 seconds of app load (only once)
    const timer = setTimeout(() => {
      const hasSeenHint = localStorage.getItem("lifeOS_shortcuts_hint_seen");
      if (!hasSeenHint) {
        setIsOpen(true);
        localStorage.setItem("lifeOS_shortcuts_hint_seen", "true");
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
        onClick={() => setIsOpen(false)}
      ></div>

      {/* Modal */}
      <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm mx-4 relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-sky-600" />
            <h2 className="text-sm font-bold text-slate-800">Keyboard Shortcuts</h2>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="px-6 py-4 space-y-3">
          {/* Quick Add */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Command className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">K</span>
            </div>
            <span className="text-xs text-slate-500 text-right flex-1">Add task</span>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <span className="text-xs text-slate-500 text-right flex-1">Navigate days</span>
          </div>

          {/* Close */}
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-200 mt-2">
            <span className="text-xs font-semibold text-slate-600">Esc</span>
            <span className="text-xs text-slate-500 text-right flex-1">Close drawers</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-sky-50 border-t border-slate-200 rounded-b-2xl">
          <button 
            onClick={() => setIsOpen(false)}
            className="w-full text-xs font-bold text-sky-600 hover:text-sky-700 transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
