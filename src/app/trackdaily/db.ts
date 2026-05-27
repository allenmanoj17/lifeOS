import { Task, TaskStatus } from "./types";

const TASKS_KEY = "lifeos_trackdaily_tasks";
const CATEGORIES_KEY = "lifeos_trackdaily_categories";

const DEFAULT_CATEGORIES = ["Work", "Health", "Personal", "Other"];

// Helper to generate a simple unique ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Get all tasks from localStorage
export function getAllTasks(): Task[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(TASKS_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error("Error parsing tasks from localStorage", e);
    return [];
  }
}

// Save all tasks to localStorage
export function saveAllTasks(tasks: Task[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

// Get categories list
export function getCategories(): string[] {
  if (typeof window === "undefined") return DEFAULT_CATEGORIES;
  const data = localStorage.getItem(CATEGORIES_KEY);
  if (!data) {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES));
    return DEFAULT_CATEGORIES;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return DEFAULT_CATEGORIES;
  }
}

// Save categories list
export function saveCategories(categories: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

// Helper to format Date to YYYY-MM-DD
export function formatDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Helper to add days to a date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Generate recurring task instances for the next 30 days
export function generateRecurringInstances(): void {
  const allTasks = getAllTasks();
  const templates = allTasks.filter(t => t.isRecurring && !t.reminderId?.startsWith("instance_")); // using reminderId or parentId to distinguish. Let's add a parentId or similar concept. In the PRD, isRecurring is boolean, and recurringRule is set.
  
  if (templates.length === 0) return;
  
  let updated = false;
  const newTasks = [...allTasks];
  const today = new Date();
  
  // We look 30 days ahead from today
  for (let i = 0; i < 30; i++) {
    const targetDate = addDays(today, i);
    const targetDateStr = formatDateString(targetDate);
    const targetDayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday...
    const targetDayOfMonth = targetDate.getDate();

    for (const template of templates) {
      if (!template.recurringRule) continue;
      
      const { frequency, daysOfWeek, endDate } = template.recurringRule;
      
      // Check if past end date
      if (endDate && targetDateStr > endDate) continue;
      
      // Check if start date is after target date
      if (template.plannedDate > targetDateStr) continue;

      let isMatch = false;
      if (frequency === "daily") {
        isMatch = true;
      } else if (frequency === "weekly") {
        if (daysOfWeek && daysOfWeek.includes(targetDayOfWeek)) {
          isMatch = true;
        }
      } else if (frequency === "monthly") {
        // match day of month (e.g. template plannedDate is 2026-05-15, match on 15th of every month)
        const templateDate = new Date(template.plannedDate);
        if (templateDate.getDate() === targetDayOfMonth) {
          isMatch = true;
        }
      }

      if (isMatch) {
        // Check if instance already exists for this date
        const instanceExists = allTasks.some(
          t => t.reminderId === `instance_${template.id}_${targetDateStr}`
        );
        
        if (!instanceExists) {
          const nowStr = new Date().toISOString();
          const instance: Task = {
            id: generateId(),
            title: template.title,
            notes: template.notes,
            category: template.category,
            plannedDate: targetDateStr,
            plannedTime: template.plannedTime,
            status: "planned",
            checklist: template.checklist 
              ? template.checklist.map(c => ({ ...c, id: generateId(), checked: false }))
              : [],
            isRecurring: false,
            // We use reminderId to store the link: instance_templateId_date
            reminderId: `instance_${template.id}_${targetDateStr}`,
            createdAt: nowStr,
            updatedAt: nowStr
          };
          newTasks.push(instance);
          updated = true;
        }
      }
    }
  }

  if (updated) {
    saveAllTasks(newTasks);
  }
}

// Get tasks for a specific date (also triggers recurring generation)
export function getTasksByDate(dateStr: string): Task[] {
  // Generate first to make sure they exist
  generateRecurringInstances();
  
  const allTasks = getAllTasks();
  
  // Filter tasks that match the plannedDate
  // Also, exclude base recurring templates if they are only templates (we display their instances instead, except if they have the actual matching date themselves)
  return allTasks.filter(task => {
    // If it's a template and has isRecurring=true, but we generated instances for it,
    // we should only display it on its original plannedDate if no instance covers that date,
    // or we can treat the template task as the first instance itself.
    // In our system, let's show tasks matching the date. 
    // If a task is a template, we show it on its original date. 
    // For other dates, its instances will show up because they have the target date.
    return task.plannedDate === dateStr;
  });
}

// Create a task
export function createTask(taskData: Omit<Task, "id" | "createdAt" | "updatedAt">): Task {
  const allTasks = getAllTasks();
  const nowStr = new Date().toISOString();
  
  const newTask: Task = {
    ...taskData,
    id: generateId(),
    createdAt: nowStr,
    updatedAt: nowStr
  };
  
  allTasks.push(newTask);
  saveAllTasks(allTasks);
  
  // If it's recurring, trigger generation immediately
  if (newTask.isRecurring) {
    generateRecurringInstances();
  }
  
  return newTask;
}

// Update a task
export function updateTask(id: string, fields: Partial<Task>): Task {
  const allTasks = getAllTasks();
  const index = allTasks.findIndex(t => t.id === id);
  
  if (index === -1) {
    throw new Error(`Task with id ${id} not found`);
  }
  
  const nowStr = new Date().toISOString();
  const updatedTask = {
    ...allTasks[index],
    ...fields,
    updatedAt: nowStr
  };
  
  allTasks[index] = updatedTask;
  saveAllTasks(allTasks);
  
  // If recurring rule changed, regenerate
  if (fields.isRecurring || fields.recurringRule) {
    generateRecurringInstances();
  }
  
  return updatedTask;
}

// Delete a task
export function deleteTask(id: string): void {
  const allTasks = getAllTasks();
  const taskToDelete = allTasks.find(t => t.id === id);
  
  let filteredTasks = allTasks.filter(t => t.id !== id);
  
  // If deleting a template task, delete all future unsaved/uncompleted instances of it as well
  if (taskToDelete && taskToDelete.isRecurring) {
    filteredTasks = filteredTasks.filter(t => {
      const isInstance = t.reminderId?.startsWith(`instance_${id}_`);
      const isPlanned = t.status === "planned";
      return !(isInstance && isPlanned);
    });
  }
  
  saveAllTasks(filteredTasks);
}
