import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins class names and lets later Tailwind classes override earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats a whole-rupee amount, e.g. 899 → "₹899". */
export function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
