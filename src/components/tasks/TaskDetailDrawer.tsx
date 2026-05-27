"use client";

import React, { useState } from "react";
import { 
  X, 
  Calendar, 
  Clock, 
  Trash2, 
  Edit3, 
  CheckSquare, 
  Square,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight
} from "lucide-react";
import { updateTask, deleteTask, getCategories, generateId } from "@/app/trackdaily/db";
import { Task, ChecklistItem } from "@/app/trackdaily/types";

interface TaskDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onTaskUpdated: () => void;
}

export default function TaskDetailDrawer({
  isOpen,
  onClose,
  task,
  onTaskUpdated,
}: TaskDetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showSkipReasonInput, setShowSkipReasonInput] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Form states for Editing (initialized directly from task prop)
  const [editTitle, setEditTitle] = useState(task.title);
  const [editNotes, setEditNotes] = useState(task.notes || "");
  const [editCategory, setEditCategory] = useState(task.category);
  const [editDate, setEditDate] = useState(task.plannedDate);
  const [editTime, setEditTime] = useState(task.plannedTime || "");
  const [editChecklist, setEditChecklist] = useState<ChecklistItem[]>(task.checklist || []);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [categories] = useState<string[]>(() => getCategories());

  if (!isOpen) return null;

  // Handle Mark Done (Auto detects Done Late)
  const handleMarkDone = () => {
    const now = new Date();
    const nowStr = now.toISOString();
    let status: Task["status"] = "done";

    // Detect if Done Late
    if (task.plannedTime) {
      try {
        const plannedDateTime = new Date(`${task.plannedDate}T${task.plannedTime}`);
        if (now > plannedDateTime) {
          status = "done_late";
        }
      } catch (e) {
        console.error("Error parsing planned date/time", e);
      }
    }

    updateTask(task.id, {
      status,
      completedAt: nowStr
    });
    onTaskUpdated();
    onClose();
  };

  // Handle Mark Missed
  const handleMarkMissed = () => {
    updateTask(task.id, { status: "missed" });
    onTaskUpdated();
    onClose();
  };

  // Handle Mark Skipped
  const handleMarkSkippedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateTask(task.id, { 
      status: "skipped",
      skipReason: skipReason.trim() || undefined
    });
    onTaskUpdated();
    onClose();
  };

  // Delete Task
  const handleDelete = () => {
    deleteTask(task.id);
    onTaskUpdated();
    onClose();
  };

  // Check/uncheck Checklist Item in detail view
  const handleToggleChecklistItem = (itemId: string, checked: boolean) => {
    const updatedChecklist = (task.checklist || []).map(item => 
      item.id === itemId ? { ...item, checked } : item
    );
    updateTask(task.id, { checklist: updatedChecklist });
    onTaskUpdated();
    // Update local state as well
    setEditChecklist(updatedChecklist);
  };

  // Add Item to Checklist during edit
  const handleAddChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newCheckItem.trim();
    if (!label) return;
    setEditChecklist([
      ...editChecklist,
      { id: generateId(), label, checked: false }
    ]);
    setNewCheckItem("");
  };

  // Remove checklist item during edit
  const handleRemoveChecklistItem = (itemId: string) => {
    setEditChecklist(editChecklist.filter(item => item.id !== itemId));
  };

  // Toggle check/uncheck during edit
  const handleToggleChecklistEditMode = (itemId: string) => {
    setEditChecklist(editChecklist.map(item => 
      item.id === itemId ? { ...item, checked: !item.checked } : item
    ));
  };

  // Save Edits
  const handleSaveEdits = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

    updateTask(task.id, {
      title: editTitle.trim(),
      notes: editNotes.trim() || undefined,
      category: editCategory,
      plannedDate: editDate,
      plannedTime: editTime || undefined,
      checklist: editChecklist,
    });

    setIsEditing(false);
    onTaskUpdated();
  };

  const getStatusStyle = (status: Task["status"]) => {
    switch (status) {
      case "done":
        return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
      case "done_late":
        return "bg-amber-500/10 border-amber-500/20 text-amber-400";
      case "missed":
        return "bg-rose-500/10 border-rose-500/20 text-rose-400";
      case "skipped":
        return "bg-zinc-800 border-zinc-700/60 text-zinc-400";
      default:
        return "bg-sky-500/10 border-sky-500/20 text-sky-400";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      ></div>

      {/* Panel */}
      <div className="w-full max-w-md bg-zinc-950 border-t border-white/10 rounded-t-[2.2rem] z-50 p-6 flex flex-col gap-4 shadow-2xl relative max-h-[85vh] overflow-y-auto animate-slide-up">
        
        {/* Drag handle decoration */}
        <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-2 shrink-0"></div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-full uppercase tracking-wider ${getStatusStyle(task.status)}`}>
              {task.status.replace("_", " ")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {!isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="p-2 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition-colors"
                title="Edit Task"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-2 hover:bg-zinc-900 rounded-lg text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Mode vs Edit Mode */}
        {!isEditing ? (
          <div className="flex flex-col gap-4 text-xs">
            {/* Title & Notes */}
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-black text-white leading-snug">{task.title}</h2>
              {task.notes && (
                <p className="text-zinc-400 mt-2 bg-zinc-900/40 border border-white/5 p-3.5 rounded-xl text-[11px] leading-relaxed">
                  {task.notes}
                </p>
              )}
            </div>

            {/* Date Time Metas */}
            <div className="flex items-center gap-4 text-zinc-500 py-1 font-semibold text-[11px]">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <span>{task.plannedDate}</span>
              </div>
              {task.plannedTime && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  <span>{task.plannedTime}</span>
                </div>
              )}
              <div className="ml-auto bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wide">
                {task.category}
              </div>
            </div>

            {/* Checklist Section */}
            {task.checklist && task.checklist.length > 0 && (
              <div className="flex flex-col gap-2.5 py-2 border-t border-white/5">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Sub-task Checklist</span>
                <div className="flex flex-col gap-1.5">
                  {task.checklist.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => handleToggleChecklistItem(item.id, !item.checked)}
                      className="flex items-center gap-2 p-2 bg-zinc-900/20 border border-white/5 rounded-xl cursor-pointer hover:bg-zinc-900/60 transition-colors"
                    >
                      {item.checked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-600 shrink-0" />
                      )}
                      <span className={`text-xs font-medium text-zinc-300 ${item.checked ? "line-through text-zinc-600" : ""}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skip Reason logged if skipped */}
            {task.status === "skipped" && task.skipReason && (
              <div className="p-3 bg-zinc-900/60 border border-white/5 rounded-xl flex flex-col gap-1 text-[11px]">
                <span className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Skip Reason</span>
                <span className="text-zinc-300 italic">&quot;{task.skipReason}&quot;</span>
              </div>
            )}

            {/* Status Actions */}
            {task.status === "planned" && !showSkipReasonInput && (
              <div className="flex flex-col gap-2 pt-3 border-t border-white/5">
                <button 
                  onClick={handleMarkDone}
                  className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark Completed</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setShowSkipReasonInput(true)}
                    className="bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700/60 text-zinc-300 font-bold py-3 rounded-xl transition-all"
                  >
                    Skip Habit
                  </button>
                  <button 
                    onClick={handleMarkMissed}
                    className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-1"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Mark Missed</span>
                  </button>
                </div>
              </div>
            )}

            {/* Skip Reason Input Section */}
            {showSkipReasonInput && (
              <form onSubmit={handleMarkSkippedSubmit} className="flex flex-col gap-3 pt-3 border-t border-white/5 animate-fade-in">
                <div className="flex flex-col gap-1">
                  <label className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Reason for skipping</label>
                  <input 
                    type="text"
                    placeholder="E.g., feeling sick, low battery, out of town..."
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                    className="glass-input text-xs px-3 py-2.5 text-white"
                    required
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowSkipReasonInput(false)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700/60 text-zinc-300 py-2.5 rounded-xl font-semibold"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 py-2.5 rounded-xl font-bold flex items-center justify-center gap-1"
                  >
                    <span>Confirm Skip</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}

            {/* Delete button (with confirm toggle) */}
            {!confirmDelete ? (
              <button 
                onClick={() => setConfirmDelete(true)}
                className="w-full mt-4 text-zinc-600 hover:text-rose-400/80 py-2 rounded-xl text-center text-[10px] font-bold border border-transparent hover:border-rose-500/10 transition-all flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Task</span>
              </button>
            ) : (
              <div className="mt-4 p-3 bg-rose-500/5 border border-rose-500/15 rounded-xl flex items-center justify-between text-[11px] animate-fade-in">
                <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Permanently delete?</span>
                </div>
                <div className="flex gap-1.5">
                  <button 
                    onClick={() => setConfirmDelete(false)}
                    className="bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded-lg font-semibold"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="bg-rose-500 text-white px-3.5 py-1.5 rounded-lg font-bold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Inline Edit Form */
          <form onSubmit={handleSaveEdits} className="flex flex-col gap-4 text-xs">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Task Title</label>
              <input 
                type="text" 
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="glass-input text-xs px-3.5 py-2.5 text-white"
                required
              />
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Date</label>
                <input 
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="bg-zinc-900 border border-white/5 rounded-xl px-2.5 py-2 text-white text-[11px] focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Time</label>
                <input 
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="bg-zinc-900 border border-white/5 rounded-xl px-2.5 py-2 text-white text-[11px] focus:outline-none"
                />
              </div>
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Category</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="bg-zinc-900 border border-white/5 rounded-xl px-2.5 py-2 text-white focus:outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Notes</label>
              <textarea 
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                className="glass-input text-xs px-3.5 py-2 text-white resize-none"
              />
            </div>

            {/* Checklist Edit */}
            <div className="flex flex-col gap-2 py-1.5">
              <label className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Sub-tasks checklist</label>
              
              {/* Existing items */}
              {editChecklist.length > 0 && (
                <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                  {editChecklist.map((item) => (
                    <div 
                      key={item.id}
                      className="flex items-center justify-between p-2 bg-zinc-900/40 border border-white/5 rounded-xl"
                    >
                      <div 
                        onClick={() => handleToggleChecklistEditMode(item.id)}
                        className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                      >
                        {item.checked ? (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                        )}
                        <span className={`text-[11px] truncate text-zinc-300 ${item.checked ? "line-through opacity-40" : ""}`}>
                          {item.label}
                        </span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => handleRemoveChecklistItem(item.id)}
                        className="text-zinc-500 hover:text-rose-400 p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add checklist item */}
              <div className="flex gap-1.5 mt-1">
                <input 
                  type="text" 
                  placeholder="Add item..." 
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-white/5 rounded-xl px-2.5 py-1.5 text-white placeholder:text-zinc-700 text-[11px]"
                />
                <button 
                  type="button"
                  onClick={handleAddChecklistItem}
                  className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 px-3 rounded-xl text-zinc-300 font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Edit Actions */}
            <div className="flex gap-2 pt-2">
              <button 
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 py-2.5 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="flex-1 bg-purple-500 hover:bg-purple-400 text-black py-2.5 rounded-xl font-bold"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
