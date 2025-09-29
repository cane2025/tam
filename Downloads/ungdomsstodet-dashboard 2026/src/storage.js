/**
 * Storage wrapper med localStorage + memory fallback
 * Enligt projektregler: try/catch runt allt localStorage, fallback till minne
 */
const LS_KEY = "ungdomsstodet_app_state_v3";
const BACKUP_PREFIX = "ungdomsstodet_backup_";
const memoryStore = {
    value: null,
    isMemoryMode: false
};
/**
 * Kontrollera om localStorage är tillgängligt
 */
function isLocalStorageAvailable() {
    try {
        const testKey = '__ls_test__';
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Hämta lagrad data (localStorage först, sedan memory fallback)
 */
export function getStoredData() {
    try {
        if (isLocalStorageAvailable()) {
            const data = localStorage.getItem(LS_KEY);
            if (data !== null) {
                return data;
            }
        }
    }
    catch (error) {
        console.warn('Failed to read from localStorage:', error);
    }
    // Fallback till memory
    return memoryStore.value;
}
/**
 * Spara data (localStorage först, sedan memory fallback)
 */
export function setStoredData(data) {
    let success = false;
    try {
        if (isLocalStorageAvailable()) {
            localStorage.setItem(LS_KEY, data);
            createBackup(data);
            success = true;
        }
    }
    catch (error) {
        console.warn('Failed to write to localStorage:', error);
    }
    // Spara alltid i memory som fallback
    memoryStore.value = data;
    memoryStore.isMemoryMode = !success;
    return success;
}
/**
 * Skapa backup i localStorage
 */
function createBackup(data) {
    try {
        if (!isLocalStorageAvailable())
            return;
        const today = new Date().toISOString().slice(0, 10);
        const backupKey = BACKUP_PREFIX + today;
        localStorage.setItem(backupKey, data);
        cleanOldBackups();
    }
    catch (error) {
        console.warn('Failed to create backup:', error);
    }
}
/**
 * Rensa gamla backups (behåll bara 7 senaste)
 */
function cleanOldBackups() {
    try {
        if (!isLocalStorageAvailable())
            return;
        const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
            .filter((k) => k && k.startsWith(BACKUP_PREFIX))
            .sort()
            .reverse();
        // Ta bort allt utom de 7 senaste
        keys.slice(7).forEach((k) => localStorage.removeItem(k));
    }
    catch (error) {
        console.warn('Failed to clean old backups:', error);
    }
}
/**
 * Hämta tillgängliga backups
 */
export function getBackups() {
    try {
        if (!isLocalStorageAvailable())
            return [];
        const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
            .filter((k) => k && k.startsWith(BACKUP_PREFIX));
        return keys
            .map((k) => ({ date: k.replace(BACKUP_PREFIX, ""), key: k }))
            .sort((a, b) => b.date.localeCompare(a.date));
    }
    catch {
        return [];
    }
}
/**
 * Kontrollera lagringstyp
 */
export function getStorageType() {
    if (memoryStore.isMemoryMode || !isLocalStorageAvailable()) {
        return "Minne";
    }
    return "LocalStorage";
}
/**
 * Återställ från backup
 */
export function restoreFromBackup(backupKey) {
    try {
        if (!isLocalStorageAvailable())
            return null;
        return localStorage.getItem(backupKey);
    }
    catch (error) {
        console.warn('Failed to restore from backup:', error);
        return null;
    }
}
/**
 * Rensa all data (både localStorage och memory)
 */
export function clearAllData() {
    try {
        if (isLocalStorageAvailable()) {
            // Ta bort main data
            localStorage.removeItem(LS_KEY);
            // Ta bort alla backups
            const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
                .filter((k) => k && k.startsWith(BACKUP_PREFIX));
            keys.forEach((k) => localStorage.removeItem(k));
        }
    }
    catch (error) {
        console.warn('Failed to clear localStorage:', error);
    }
    // Rensa memory
    memoryStore.value = null;
    memoryStore.isMemoryMode = false;
}
// Tuesday Attendance Storage Functions
const TUESDAY_ATTENDANCE_PREFIX = 'us:attTue:';
/**
 * Safe localStorage wrapper for Tuesday attendance
 */
function safeLocalStorage() {
    return {
        getItem: (key) => {
            try {
                if (memoryStore.isMemoryMode) {
                    return memoryStore.value?.includes(key) ? memoryStore.value : null;
                }
                return localStorage.getItem(key);
            }
            catch {
                memoryStore.isMemoryMode = true;
                return null;
            }
        },
        setItem: (key, value) => {
            try {
                if (memoryStore.isMemoryMode) {
                    // In memory mode, we can't store individual keys
                    return;
                }
                localStorage.setItem(key, value);
            }
            catch {
                memoryStore.isMemoryMode = true;
            }
        }
    };
}
/**
 * Load Tuesday attendance record
 */
export function loadTuesdayAttendance(staffId, weekId) {
    const storage = safeLocalStorage();
    const key = `${TUESDAY_ATTENDANCE_PREFIX}${staffId}:${weekId}`;
    const data = storage.getItem(key);
    if (!data)
        return null;
    try {
        return JSON.parse(data);
    }
    catch {
        return null;
    }
}
/**
 * Save Tuesday attendance record with broadcast
 */
export function saveTuesdayAttendance(record) {
    const storage = safeLocalStorage();
    const key = `${TUESDAY_ATTENDANCE_PREFIX}${record.staffId}:${record.weekId}`;
    storage.setItem(key, JSON.stringify(record));
    // Broadcast update event for live updates  
    window.dispatchEvent(new CustomEvent('us:attTue:changed', {
        detail: { weekId: record.weekId }
    }));
}
/**
 * Get all staff IDs from storage
 */
export function getAllStaffIds() {
    const data = getStoredData();
    if (!data)
        return [];
    try {
        const state = JSON.parse(data);
        return state.staff?.map((s) => s.id) || [];
    }
    catch {
        return [];
    }
}
/**
 * Aggregate Tuesday attendance for a week
 */
export function aggregateTuesdayAttendance(weekId) {
    const counts = {
        unregistered: 0,
        excused_absence: 0,
        on_time: 0,
        late: 0,
        unexcused_absence: 0,
    };
    const staffIds = getAllStaffIds();
    staffIds.forEach(staffId => {
        const record = loadTuesdayAttendance(staffId, weekId);
        const status = record?.status || 'unregistered';
        if (status in counts && counts[status] !== undefined) {
            counts[status]++;
        }
    });
    return counts;
}
