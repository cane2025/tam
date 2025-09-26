/**
 * Timezone Utilities
 * Handles Europe/Stockholm timezone for all date operations
 */

import { format, parseISO, isValid, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime, format as formatTz } from 'date-fns-tz';

export const STOCKHOLM_TIMEZONE = 'Europe/Stockholm';

/**
 * Get current date/time in Stockholm timezone
 */
export function nowInStockholm(): Date {
  return utcToZonedTime(new Date(), STOCKHOLM_TIMEZONE);
}

/**
 * Format date to Stockholm timezone
 */
export function formatInStockholm(date: Date, formatString: string): string {
  return formatTz(date, formatString, { timeZone: STOCKHOLM_TIMEZONE });
}

/**
 * Convert UTC date to Stockholm timezone
 */
export function toStockholmTime(utcDate: Date): Date {
  return utcToZonedTime(utcDate, STOCKHOLM_TIMEZONE);
}

/**
 * Convert Stockholm time to UTC
 */
export function toUtc(stockholmDate: Date): Date {
  return zonedTimeToUtc(stockholmDate, STOCKHOLM_TIMEZONE);
}

/**
 * Get current week ID in Stockholm timezone (YYYY-WXX format)
 */
export function getCurrentWeekId(): string {
  const stockholmDate = nowInStockholm();
  return formatInStockholm(stockholmDate, 'yyyy-\'W\'II');
}

/**
 * Get current month ID in Stockholm timezone (YYYY-MM format)
 */
export function getCurrentMonthId(): string {
  const stockholmDate = nowInStockholm();
  return formatInStockholm(stockholmDate, 'yyyy-MM');
}

/**
 * Get current date in Stockholm timezone (YYYY-MM-DD format)
 */
export function getCurrentDateId(): string {
  const stockholmDate = nowInStockholm();
  return formatInStockholm(stockholmDate, 'yyyy-MM-dd');
}

/**
 * Parse week ID to date range in Stockholm timezone
 */
export function parseWeekId(weekId: string): { start: Date; end: Date } | null {
  try {
    // Parse YYYY-WXX format
    const match = weekId.match(/^(\d{4})-W(\d{2})$/);
    if (!match) return null;
    
    const year = parseInt(match[1]!, 10);
    const week = parseInt(match[2]!, 10);
    
    // Create date for the first day of the year
    const firstDayOfYear = new Date(year, 0, 1);
    
    // Find the first Monday of the year (ISO week)
    const firstMonday = startOfWeek(firstDayOfYear, { weekStartsOn: 1 });
    
    // Calculate the start of the requested week
    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);
    
    // Convert to Stockholm timezone
    const stockholmStart = utcToZonedTime(weekStart, STOCKHOLM_TIMEZONE);
    const stockholmEnd = endOfWeek(stockholmStart, { weekStartsOn: 1 });
    
    return {
      start: stockholmStart,
      end: stockholmEnd
    };
  } catch (error) {
    return null;
  }
}

/**
 * Parse month ID to date range in Stockholm timezone
 */
export function parseMonthId(monthId: string): { start: Date; end: Date } | null {
  try {
    // Parse YYYY-MM format
    const match = monthId.match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    
    const year = parseInt(match[1]!, 10);
    const month = parseInt(match[2]!, 10);
    
    if (month < 1 || month > 12) return null;
    
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = endOfMonth(monthStart);
    
    // Convert to Stockholm timezone
    const stockholmStart = utcToZonedTime(monthStart, STOCKHOLM_TIMEZONE);
    const stockholmEnd = utcToZonedTime(monthEnd, STOCKHOLM_TIMEZONE);
    
    return {
      start: stockholmStart,
      end: stockholmEnd
    };
  } catch (error) {
    return null;
  }
}

/**
 * Validate week ID format
 */
export function isValidWeekId(weekId: string): boolean {
  return /^\d{4}-W\d{2}$/.test(weekId) && parseWeekId(weekId) !== null;
}

/**
 * Validate month ID format
 */
export function isValidMonthId(monthId: string): boolean {
  return /^\d{4}-\d{2}$/.test(monthId) && parseMonthId(monthId) !== null;
}

/**
 * Get all week IDs for a given year in Stockholm timezone
 */
export function getWeekIdsForYear(year: number): string[] {
  const weekIds: string[] = [];
  const firstDay = new Date(year, 0, 1);
  const lastDay = new Date(year, 11, 31);
  
  let current = startOfWeek(firstDay, { weekStartsOn: 1 });
  
  while (current <= lastDay) {
    const stockholmDate = utcToZonedTime(current, STOCKHOLM_TIMEZONE);
    weekIds.push(formatInStockholm(stockholmDate, 'yyyy-\'W\'II'));
    current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  
  return weekIds;
}

/**
 * Get all month IDs for a given year
 */
export function getMonthIdsForYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => 
    format(new Date(year, i, 1), 'yyyy-MM')
  );
}

/**
 * Add days to a date in Stockholm timezone
 */
export function addDaysInStockholm(date: Date, days: number): Date {
  const stockholmDate = utcToZonedTime(date, STOCKHOLM_TIMEZONE);
  const newDate = new Date(stockholmDate);
  newDate.setDate(stockholmDate.getDate() + days);
  return zonedTimeToUtc(newDate, STOCKHOLM_TIMEZONE);
}

/**
 * Format date for display in Stockholm timezone
 */
export function formatForDisplay(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(dateObj)) return 'Invalid date';
  
  return formatInStockholm(dateObj, 'yyyy-MM-dd HH:mm');
}

/**
 * Format date for API (ISO string in Stockholm timezone)
 */
export function formatForApi(date: Date): string {
  return formatInStockholm(date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
}

/**
 * Parse API date string to Stockholm timezone
 */
export function parseApiDate(dateString: string): Date {
  const parsed = parseISO(dateString);
  return utcToZonedTime(parsed, STOCKHOLM_TIMEZONE);
}

