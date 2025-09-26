/**
 * Storage wrapper med localStorage + memory fallback
 * Enligt projektregler: try/catch runt allt localStorage, fallback till minne
 */

const LS_KEY = "ungdomsstodet_app_state_v3";
const BACKUP_PREFIX = "ungdomsstodet_backup_";

interface MemoryStore {
  value: string | null;
  isMemoryMode: boolean;
}

const memoryStore: MemoryStore = { 
  value: null, 
  isMemoryMode: false 
};

/**
 * Kontrollera om localStorage är tillgängligt
 */
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__ls_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Hämta lagrad data (localStorage först, sedan memory fallback)
 */
export function getStoredData(): string | null {
  try {
    if (isLocalStorageAvailable()) {
      const data = localStorage.getItem(LS_KEY);
      if (data !== null) {
        return data;
      }
    }
  } catch (error) {
    console.warn('Failed to read from localStorage:', error);
  }

  // Fallback till memory
  return memoryStore.value;
}

/**
 * Spara data (localStorage först, sedan memory fallback)
 */
export function setStoredData(data: string): boolean {
  let success = false;

  try {
    if (isLocalStorageAvailable()) {
      localStorage.setItem(LS_KEY, data);
      createBackup(data);
      success = true;
    }
  } catch (error) {
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
function createBackup(data: string): void {
  try {
    if (!isLocalStorageAvailable()) return;

    const today = new Date().toISOString().slice(0, 10);
    const backupKey = BACKUP_PREFIX + today;
    localStorage.setItem(backupKey, data);
    cleanOldBackups();
  } catch (error) {
    console.warn('Failed to create backup:', error);
  }
}

/**
 * Rensa gamla backups (behåll bara 7 senaste)
 */
function cleanOldBackups(): void {
  try {
    if (!isLocalStorageAvailable()) return;

    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!)
      .filter((k) => k && k.startsWith(BACKUP_PREFIX))
      .sort()
      .reverse();

    // Ta bort allt utom de 7 senaste
    keys.slice(7).forEach((k) => localStorage.removeItem(k));
  } catch (error) {
    console.warn('Failed to clean old backups:', error);
  }
}

/**
 * Hämta tillgängliga backups
 */
export function getBackups(): { date: string; key: string }[] {
  try {
    if (!isLocalStorageAvailable()) return [];

    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!)
      .filter((k) => k && k.startsWith(BACKUP_PREFIX));

    return keys
      .map((k) => ({ date: k.replace(BACKUP_PREFIX, ""), key: k }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

/**
 * Kontrollera lagringstyp
 */
export function getStorageType(): "LocalStorage" | "Minne" {
  if (memoryStore.isMemoryMode || !isLocalStorageAvailable()) {
    return "Minne";
  }
  return "LocalStorage";
}

/**
 * Återställ från backup
 */
export function restoreFromBackup(backupKey: string): string | null {
  try {
    if (!isLocalStorageAvailable()) return null;
    return localStorage.getItem(backupKey);
  } catch (error) {
    console.warn('Failed to restore from backup:', error);
    return null;
  }
}

/**
 * Rensa all data (både localStorage och memory)
 */
export function clearAllData(): void {
  try {
    if (isLocalStorageAvailable()) {
      // Ta bort main data
      localStorage.removeItem(LS_KEY);
      
      // Ta bort alla backups
      const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!)
        .filter((k) => k && k.startsWith(BACKUP_PREFIX));
      keys.forEach((k) => localStorage.removeItem(k));
    }
  } catch (error) {
    console.warn('Failed to clear localStorage:', error);
  }

  // Rensa memory
  memoryStore.value = null;
  memoryStore.isMemoryMode = false;
}
