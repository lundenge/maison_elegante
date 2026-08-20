import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatRoleLabel(role) {
  if (typeof role !== "string") return "";
  return role.replace(/_/g, " ").trim();
}
