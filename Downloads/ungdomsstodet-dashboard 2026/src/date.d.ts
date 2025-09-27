/**
 * ISO 8601 datum helpers för Ungdomsstöd Admin
 * Rena funktioner för vecko- och månadsnavigering
 */
export type WeekId = string;
export type MonthId = string;
/**
 * Hämta nuvarande ISO vecka
 */
export declare function getCurrentWeek(): WeekId;
/**
 * Hämta nuvarande månad
 */
export declare function getCurrentMonth(): MonthId;
/**
 * Lägg till antal veckor till en WeekId
 */
export declare function addWeeks(weekId: WeekId, weeks: number): WeekId;
/**
 * Lägg till antal månader till en MonthId
 */
export declare function addMonths(monthId: MonthId, months: number): MonthId;
/**
 * Lägg till antal dagar till ett datum (YYYY-MM-DD format)
 */
export declare function addDaysISO(dateStr: string, days: number): string;
/**
 * Hämta dagens datum i YYYY-MM-DD format
 */
export declare function todayYMD(): string;
/**
 * Formatera datetime för visning
 */
export declare function formatDateTime(): string;
/**
 * Jämför två WeekId:s
 */
export declare function compareWeekId(a: WeekId, b: WeekId): number;
/**
 * Jämför två MonthId:s
 */
export declare function compareMonthId(a: MonthId, b: MonthId): number;
/**
 * Validera WeekId format
 */
export declare function isValidWeekId(weekId: string): boolean;
/**
 * Validera MonthId format
 */
export declare function isValidMonthId(monthId: string): boolean;
/**
 * Hämta ISO veckonummer för ett datum
 */
export declare function getISOWeekNumber(date: Date): number;
/**
 * Hämta ISO veckoår för ett datum
 */
export declare function getISOWeekYear(date: Date): number;
/**
 * Konvertera ISO vecka till datum (måndag i veckan)
 */
export declare function getWeekFromISO(isoWeek: string): Date;
