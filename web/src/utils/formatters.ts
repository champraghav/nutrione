import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function formatDate(date: string | Date, pattern = 'MMM d, yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, pattern);
}

export function formatNumber(num: number, decimals = 0): string {
  return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export type ScoreStatus = 'excellent' | 'good' | 'fair' | 'poor';

export function getHealthScoreStatus(score: number): ScoreStatus {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

export function getSleepStatus(durationMinutes: number, quality: number): ScoreStatus {
  const hours = durationMinutes / 60;
  if (hours >= 7 && hours <= 9 && quality >= 4) return 'excellent';
  if (hours >= 6.5 && quality >= 3) return 'good';
  if (hours >= 5.5) return 'fair';
  return 'poor';
}

const MET_BY_INTENSITY: Record<string, number> = { light: 3, moderate: 6, intense: 9 };

export function estimateCaloriesBurned(durationMinutes: number, intensity: string, weightKg = 70): number {
  const met = MET_BY_INTENSITY[intensity] ?? 6;
  return Math.round(met * 3.5 * weightKg * (durationMinutes / 200));
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
