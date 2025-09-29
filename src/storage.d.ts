/**
 * Storage wrapper med localStorage + memory fallback
 * Enligt projektregler: try/catch runt allt localStorage, fallback till minne
 */
/**
 * Hämta lagrad data (localStorage först, sedan memory fallback)
 */
export declare function getStoredData(): string | null;
/**
 * Spara data (localStorage först, sedan memory fallback)
 */
export declare function setStoredData(data: string): boolean;
/**
 * Hämta tillgängliga backups
 */
export declare function getBackups(): {
    date: string;
    key: string;
}[];
/**
 * Kontrollera lagringstyp
 */
export declare function getStorageType(): "LocalStorage" | "Minne";
/**
 * Återställ från backup
 */
export declare function restoreFromBackup(backupKey: string): string | null;
/**
 * Rensa all data (både localStorage och memory)
 */
export declare function clearAllData(): void;
/**
 * Load Tuesday attendance record
 */
export declare function loadTuesdayAttendance(staffId: string, weekId: string): Record<string, unknown> | null;
/**
 * Save Tuesday attendance record with broadcast
 */
export declare function saveTuesdayAttendance(record: Record<string, unknown>): void;
/**
 * Get all staff IDs from storage
 */
export declare function getAllStaffIds(): string[];
/**
 * Aggregate Tuesday attendance for a week
 */
export declare function aggregateTuesdayAttendance(weekId: string): Record<string, number>;
