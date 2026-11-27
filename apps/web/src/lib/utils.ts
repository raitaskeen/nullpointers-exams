import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names and resolve conflicting Tailwind utilities (last one wins). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Two-letter avatar initials from a display name, falling back to the email address. */
export function initials(name: string, email: string): string {
  const source = name.trim() || email;
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
