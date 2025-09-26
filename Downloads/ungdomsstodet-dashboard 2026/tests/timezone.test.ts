/**
 * Timezone Tests
 * Tests for Europe/Stockholm timezone handling
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  nowInStockholm,
  formatInStockholm,
  toStockholmTime,
  toUtc,
  getCurrentWeekId,
  getCurrentMonthId,
  getCurrentDateId,
  parseWeekId,
  parseMonthId,
  isValidWeekId,
  isValidMonthId,
  getWeekIdsForYear,
  getMonthIdsForYear,
  addDaysInStockholm,
  formatForDisplay,
  formatForApi,
  parseApiDate,
  STOCKHOLM_TIMEZONE
} from '../server/utils/timezone.js';

describe('Stockholm Timezone Utilities', () => {
  
  describe('Current Time Functions', () => {
    it('should return current time in Stockholm timezone', () => {
      const now = nowInStockholm();
      expect(now).toBeInstanceOf(Date);
      expect(now.getTime()).toBeGreaterThan(0);
    });

    it('should format current time in Stockholm timezone', () => {
      const now = new Date();
      const formatted = formatInStockholm(now, 'yyyy-MM-dd HH:mm:ss');
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('should get current week ID in correct format', () => {
      const weekId = getCurrentWeekId();
      expect(weekId).toMatch(/^\d{4}-W\d{2}$/);
      
      // Should be current year
      const currentYear = new Date().getFullYear();
      expect(weekId).toContain(currentYear.toString());
    });

    it('should get current month ID in correct format', () => {
      const monthId = getCurrentMonthId();
      expect(monthId).toMatch(/^\d{4}-\d{2}$/);
      
      // Should be current year
      const currentYear = new Date().getFullYear();
      expect(monthId).toContain(currentYear.toString());
    });

    it('should get current date ID in correct format', () => {
      const dateId = getCurrentDateId();
      expect(dateId).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Timezone Conversion', () => {
    it('should convert UTC to Stockholm time', () => {
      const utcDate = new Date('2024-01-15T12:00:00Z'); // UTC noon
      const stockholmTime = toStockholmTime(utcDate);
      
      // Stockholm is UTC+1 in winter (CET)
      expect(stockholmTime.getHours()).toBe(13);
    });

    it('should convert Stockholm time to UTC', () => {
      const stockholmDate = new Date('2024-01-15T13:00:00'); // Stockholm 1 PM
      const utcTime = toUtc(stockholmDate);
      
      // Should be UTC noon
      expect(utcTime.getUTCHours()).toBe(12);
    });

    it('should handle summer time (CEST)', () => {
      const utcDate = new Date('2024-07-15T12:00:00Z'); // UTC noon in summer
      const stockholmTime = toStockholmTime(utcDate);
      
      // Stockholm is UTC+2 in summer (CEST)
      expect(stockholmTime.getHours()).toBe(14);
    });
  });

  describe('Week ID Parsing', () => {
    it('should parse valid week IDs', () => {
      const weekId = '2024-W03';
      const result = parseWeekId(weekId);
      
      expect(result).not.toBeNull();
      expect(result!.start).toBeInstanceOf(Date);
      expect(result!.end).toBeInstanceOf(Date);
      expect(result!.start.getTime()).toBeLessThan(result!.end.getTime());
    });

    it('should reject invalid week ID formats', () => {
      expect(parseWeekId('2024-W99')).toBeNull();
      expect(parseWeekId('2024-W0')).toBeNull();
      expect(parseWeekId('2024-W53')).toBeNull();
      expect(parseWeekId('invalid')).toBeNull();
      expect(parseWeekId('2024-03')).toBeNull();
    });

    it('should validate week IDs correctly', () => {
      expect(isValidWeekId('2024-W03')).toBe(true);
      expect(isValidWeekId('2024-W01')).toBe(true);
      expect(isValidWeekId('2024-W52')).toBe(true);
      expect(isValidWeekId('2024-W53')).toBe(false); // Not all years have week 53
      expect(isValidWeekId('invalid')).toBe(false);
      expect(isValidWeekId('2024-03')).toBe(false);
    });

    it('should handle edge cases for week parsing', () => {
      // Week 1 of 2024 should start on January 1st
      const week1 = parseWeekId('2024-W01');
      expect(week1).not.toBeNull();
      
      // Week 52 of 2024 should be in December
      const week52 = parseWeekId('2024-W52');
      expect(week52).not.toBeNull();
      expect(week52!.start.getMonth()).toBe(11); // December is month 11
    });
  });

  describe('Month ID Parsing', () => {
    it('should parse valid month IDs', () => {
      const monthId = '2024-03';
      const result = parseMonthId(monthId);
      
      expect(result).not.toBeNull();
      expect(result!.start).toBeInstanceOf(Date);
      expect(result!.end).toBeInstanceOf(Date);
      expect(result!.start.getTime()).toBeLessThan(result!.end.getTime());
      
      // Should be March 2024
      expect(result!.start.getFullYear()).toBe(2024);
      expect(result!.start.getMonth()).toBe(2); // March is month 2 (0-indexed)
    });

    it('should reject invalid month ID formats', () => {
      expect(parseMonthId('2024-13')).toBeNull();
      expect(parseMonthId('2024-00')).toBeNull();
      expect(parseMonthId('invalid')).toBeNull();
      expect(parseMonthId('2024-3')).toBeNull(); // Should be zero-padded
    });

    it('should validate month IDs correctly', () => {
      expect(isValidMonthId('2024-01')).toBe(true);
      expect(isValidMonthId('2024-12')).toBe(true);
      expect(isValidMonthId('2024-03')).toBe(true);
      expect(isValidMonthId('2024-13')).toBe(false);
      expect(isValidMonthId('2024-00')).toBe(false);
      expect(isValidMonthId('invalid')).toBe(false);
    });
  });

  describe('Year-based Functions', () => {
    it('should get all week IDs for a year', () => {
      const weekIds = getWeekIdsForYear(2024);
      
      expect(weekIds).toHaveLength(52);
      expect(weekIds[0]).toMatch(/^2024-W\d{2}$/);
      expect(weekIds[51]).toMatch(/^2024-W\d{2}$/);
      
      // Should be in order
      expect(weekIds[0]).toBe('2024-W01');
      expect(weekIds[51]).toBe('2024-W52');
    });

    it('should get all month IDs for a year', () => {
      const monthIds = getMonthIdsForYear(2024);
      
      expect(monthIds).toHaveLength(12);
      expect(monthIds[0]).toBe('2024-01');
      expect(monthIds[11]).toBe('2024-12');
    });
  });

  describe('Date Manipulation', () => {
    it('should add days in Stockholm timezone', () => {
      const baseDate = new Date('2024-01-15T12:00:00Z');
      const result = addDaysInStockholm(baseDate, 7);
      
      expect(result.getTime()).toBeGreaterThan(baseDate.getTime());
      expect(result.getTime() - baseDate.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should handle daylight saving time transitions', () => {
      // Test spring forward (last Sunday in March)
      const beforeDST = new Date('2024-03-30T12:00:00Z');
      const afterDST = addDaysInStockholm(beforeDST, 1);
      
      expect(afterDST.getTime()).toBeGreaterThan(beforeDST.getTime());
      
      // Test fall back (last Sunday in October)
      const beforeFall = new Date('2024-10-26T12:00:00Z');
      const afterFall = addDaysInStockholm(beforeFall, 1);
      
      expect(afterFall.getTime()).toBeGreaterThan(beforeFall.getTime());
    });
  });

  describe('Formatting Functions', () => {
    it('should format dates for display', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const formatted = formatForDisplay(date);
      
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it('should format dates for API', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const formatted = formatForApi(date);
      
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+\d{2}:\d{2}$/);
    });

    it('should parse API date strings', () => {
      const apiDate = '2024-01-15T14:30:00.000+01:00';
      const parsed = parseApiDate(apiDate);
      
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.getTime()).toBeGreaterThan(0);
    });

    it('should handle invalid dates gracefully', () => {
      const invalidDate = new Date('invalid');
      const formatted = formatForDisplay(invalidDate);
      
      expect(formatted).toBe('Invalid date');
    });
  });

  describe('Stockholm Timezone Constants', () => {
    it('should have correct timezone constant', () => {
      expect(STOCKHOLM_TIMEZONE).toBe('Europe/Stockholm');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow from week ID to dates', () => {
      const weekId = '2024-W10';
      
      // Parse week ID
      const weekDates = parseWeekId(weekId);
      expect(weekDates).not.toBeNull();
      
      // Format back to display
      const startFormatted = formatForDisplay(weekDates!.start);
      const endFormatted = formatForDisplay(weekDates!.end);
      
      expect(startFormatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      expect(endFormatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it('should handle complete workflow from month ID to dates', () => {
      const monthId = '2024-03';
      
      // Parse month ID
      const monthDates = parseMonthId(monthId);
      expect(monthDates).not.toBeNull();
      
      // Format back to display
      const startFormatted = formatForDisplay(monthDates!.start);
      const endFormatted = formatForDisplay(monthDates!.end);
      
      expect(startFormatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      expect(endFormatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it('should maintain consistency across timezone operations', () => {
      const originalDate = new Date('2024-01-15T12:00:00Z');
      
      // Convert to Stockholm and back
      const stockholmTime = toStockholmTime(originalDate);
      const backToUtc = toUtc(stockholmTime);
      
      // Should be close to original (within 1 second due to precision)
      const diff = Math.abs(backToUtc.getTime() - originalDate.getTime());
      expect(diff).toBeLessThan(1000);
    });
  });
});

