"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Edit3,
  Plus,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { generateId, getCategories } from "@/app/trackdaily/db";
import { ChecklistItem, Task } from "@/app/trackdaily/types";
import { useToast } from "@/components/Toast";
import { useTrackDailyContext } from "@/context/TrackDailyContext";

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
  const { addToast } = useToast();
  const { updateTask, deleteTask } = useTrackDailyContext();
  const [isEditing, setIsEditing] = useState(false);
  const [showSkipReasonInput, setShowSkipReasonInput] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editNotes, setEditNotes] = useState(task.notes || "");
  const [editCategory, setEditCategory] = useState(task.category);
  const [editDate, setEditDate] = useState(task.plannedDate);
  const [editTime, setEditTime] = useState(task.plannedTime || "");
  const [editChecklist, setEditChecklist] = useState<ChecklistItem[]>(task.checklist || []);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [categories] = useState<string[]>(() => getCategories());

  if (!isOpen) return null;

  const handleMarkDone = async () => {
    const now = new Date();
    let status: Task["status"] = "done";

    if (task.plannedTime) {
      try {
        const plannedDateTime = new Date(`${task.plannedDate}T${task.plannedTime}`);
        if (now > plannedDateTime) status = "done_late";
      } catch {}
    }

    await updateTask(task.id, { status, completedAt: now.toISOString() });
    addToast(`"${task.title}" completed${status === "done_late" ? " late" : ""}`, "success", 2000);
    onTaskUpdated();
    onClose();
  };

  const handleMarkMissed = async () => {
    await updateTask(task.id, { status: "missed" });
    addToast(`"${task.title}" marked as missed`, "error", 2000);
    onTaskUpdated();
    onClose();
  };

  const handleMarkSkippedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateTask(task.id, {
      status: "skipped",
      skipReason: skipReason.trim() || undefined,
    });
    addToast(`"${task.title}" skipped`, "info", 2000);
    onTaskUpdated();
    onClose();
  };

  const handleDelete = async () => {
    await deleteTask(task.id);
    addToast(`"${task.title}" deleted`, "info", 2000);
    onTaskUpdated();
    onClose();
  };

  const handleToggleChecklistItem = async (itemId: string, checked: boolean) => {
    const updatedChecklist = (task.checklist || []).map((item) =>
      item.id === itemId ? { ...item, checked } : item,
    );
    await updateTask(task.id, { checklist: updatedChecklist });
    setEditChecklist(updatedChecklist);
    onTaskUpdated();
  };

  const handleAddChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newCheckItem.trim();
    if (!label) return;
    setEditChecklist([...editChecklist, { id: generateId(), label, checked: false }]);
    setNewCheckItem("");
  };

  const handleSaveEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

    await updateTask(task.id, {
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

  const statusStyle = {
    done: "border-emerald-200 bg-emerald-50 text-emerald-700",
    done_late: "border-amber-200 bg-amber-50 text-amber-700",
    missed: "border-rose-200 bg-rose-50 text-rose-700",
    skipped: "border-slate-200 bg-slate-100 text-slate-600",
    planned: "border-sky-200 bg-sky-50 text-sky-700",
  }[task.status];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="fixed inset-0 bg-slate-950/35 animate-fade-in" onClick={onClose} />

      <div className="relative z-50 flex max-h-[86vh] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-t-xl border border-slate-200 bg-white p-5 shadow-2xl animate-slide-up sm:mb-6 sm:rounded-xl">
        <div className="mx-auto h-1 w-10 rounded-full bg-slate-200" />

        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${statusStyle}`}>
            {task.status.replace("_", " ")}
          </span>
          <div className="flex items-center gap-1.5">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-950"
                title="Edit task"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            ) : null}
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-950"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!isEditing ? (
          <div className="flex flex-col gap-5 text-sm">
            <div>
              <h2 className="text-xl font-semibold leading-snug text-slate-950">{task.title}</h2>
              {task.notes ? (
                <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                  {task.notes}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {task.plannedDate}
              </span>
              {task.plannedTime ? (
                <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {task.plannedTime}
                </span>
              ) : null}
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                {task.category}
              </span>
            </div>

            {task.checklist && task.checklist.length > 0 ? (
              <div className="flex flex-col gap-2 border-t border-slate-200 pt-4">
                <span className="text-xs font-semibold text-slate-600">Checklist</span>
                {task.checklist.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleToggleChecklistItem(item.id, !item.checked)}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-left transition-colors hover:bg-slate-50"
                  >
                    {item.checked ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <span className={`text-sm ${item.checked ? "text-slate-400 line-through" : "text-slate-700"}`}>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {task.status === "skipped" && task.skipReason ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <p className="text-xs font-semibold text-slate-500">Skip reason</p>
                <p className="mt-1">{task.skipReason}</p>
              </div>
            ) : null}

            {task.status === "planned" && !showSkipReasonInput ? (
              <div className="flex flex-col gap-2 border-t border-slate-200 pt-4">
                <button
                  onClick={handleMarkDone}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark completed
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowSkipReasonInput(true)}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleMarkMissed}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                  >
                    <AlertCircle className="h-4 w-4" />
                    Missed
                  </button>
                </div>
              </div>
            ) : null}

            {showSkipReasonInput ? (
              <form onSubmit={handleMarkSkippedSubmit} className="flex flex-col gap-3 border-t border-slate-200 pt-4">
                <label className="text-xs font-semibold text-slate-600">Reason for skipping</label>
                <input
                  type="text"
                  placeholder="Optional context"
                  value={skipReason}
                  onChange={(e) => setSkipReason(e.target.value)}
                  className="glass-input px-3 py-2.5 text-sm"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSkipReasonInput(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white hover:bg-slate-800"
                  >
                    Confirm skip
                  </button>
                </div>
              </form>
            ) : null}

            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-transparent py-2.5 text-xs font-semibold text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                <Trash2 className="h-4 w-4" />
                Delete task
              </button>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-rose-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Delete permanently?
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSaveEdits} className="flex flex-col gap-4 text-sm">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Task title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="glass-input px-3.5 py-2.5 text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600">Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="glass-input px-3 py-2.5 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600">Time</label>
                <input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="glass-input px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Category</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="glass-input px-3 py-2.5 text-sm font-medium"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="glass-input resize-none px-3.5 py-2.5 text-sm"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-600">Checklist</label>
              {editChecklist.length > 0 ? (
                <div className="flex max-h-36 flex-col gap-1.5 overflow-y-auto">
                  {editChecklist.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditChecklist((current) =>
                            current.map((entry) =>
                              entry.id === item.id ? { ...entry, checked: !entry.checked } : entry,
                            ),
                          )
                        }
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        {item.checked ? (
                          <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <Square className="h-4 w-4 shrink-0 text-slate-400" />
                        )}
                        <span className={`truncate text-sm ${item.checked ? "text-slate-400 line-through" : "text-slate-700"}`}>
                          {item.label}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditChecklist((current) => current.filter((entry) => entry.id !== item.id))}
                        className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-rose-600"
                        title="Remove checklist item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add checklist item"
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  className="glass-input min-w-0 flex-1 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddChecklistItem}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                  title="Add checklist item"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white hover:bg-slate-800"
              >
                Save changes
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
