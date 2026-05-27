const CATEGORIES_KEY = "lifeos_trackdaily_categories";

const DEFAULT_CATEGORIES = ["Work", "Health", "Personal", "Other"];

export function generateId(): string {
  return Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15);
}

export function getCategories(): string[] {
  if (typeof window === "undefined") return DEFAULT_CATEGORIES;
  const data = localStorage.getItem(CATEGORIES_KEY);
  if (!data) {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES));
    return DEFAULT_CATEGORIES;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? parsed
      : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export function saveCategories(categories: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

export function formatDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
