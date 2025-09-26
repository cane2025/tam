/**
 * ISO 8601 datum helpers för Ungdomsstöd Admin
 * Rena funktioner för vecko- och månadsnavigering
 */

export type WeekId = string; // 'YYYY-Wxx'
export type MonthId = string; // 'YYYY-MM'

/**
 * Padding helper
 */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Hämta ISO vecka för ett datum
 */
function getISOWeek(date: Date): { year: number; week: number } {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+tmp - +yearStart) / 86400000 + 1) / 7);
  return { year: tmp.getUTCFullYear(), week: weekNo };
}

/**
 * Hämta nuvarande ISO vecka
 */
export function getCurrentWeek(): WeekId {
  const now = new Date();
  const { year, week } = getISOWeek(now);
  return `${year}-W${pad2(week)}`;
}

/**
 * Hämta nuvarande månad
 */
export function getCurrentMonth(): MonthId {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

/**
 * Lägg till antal veckor till en WeekId
 */
export function addWeeks(weekId: WeekId, weeks: number): WeekId {
  // Parse WeekId: 'YYYY-Wxx'
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekId;

  const year = parseInt(match[1]!, 10);
  const week = parseInt(match[2]!, 10);

  // Skapa ett datum från ISO vecka (torsdag i veckan)
  const jan4 = new Date(year, 0, 4);
  const startOfYear = new Date(jan4.getTime() - (jan4.getDay() - 1) * 24 * 60 * 60 * 1000);
  const targetDate = new Date(startOfYear.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
  
  // Lägg till veckor
  const newDate = new Date(targetDate.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
  
  // Hämta ISO vecka för det nya datumet
  const { year: newYear, week: newWeek } = getISOWeek(newDate);
  return `${newYear}-W${pad2(newWeek)}`;
}

/**
 * Lägg till antal månader till en MonthId
 */
export function addMonths(monthId: MonthId, months: number): MonthId {
  // Parse MonthId: 'YYYY-MM'
  const match = monthId.match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthId;

  let year = parseInt(match[1]!, 10);
  let month = parseInt(match[2]!, 10);

  // Lägg till månader
  month += months;

  // Hantera år-övergångar
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }

  return `${year}-${pad2(month)}`;
}

/**
 * Lägg till antal dagar till ett datum (YYYY-MM-DD format)
 */
export function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Hämta dagens datum i YYYY-MM-DD format
 */
export function todayYMD(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Formatera datetime för visning
 */
export function formatDateTime(): string {
  return new Date().toLocaleString("sv-SE");
}

/**
 * Jämför två WeekId:s
 */
export function compareWeekId(a: WeekId, b: WeekId): number {
  const [ya, wa] = a.split("-W");
  const [yb, wb] = b.split("-W");
  if (ya !== yb) return Number(ya) - Number(yb);
  return Number(wa) - Number(wb);
}

/**
 * Jämför två MonthId:s
 */
export function compareMonthId(a: MonthId, b: MonthId): number {
  return a.localeCompare(b);
}

/**
 * Validera WeekId format
 */
export function isValidWeekId(weekId: string): boolean {
  return /^\d{4}-W\d{2}$/.test(weekId);
}

/**
 * Validera MonthId format
 */
export function isValidMonthId(monthId: string): boolean {
  return /^\d{4}-\d{2}$/.test(monthId);
}
