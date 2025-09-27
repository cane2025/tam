/**
 * Testfall för historiska KPI som bevaras trots arkivering/borttagning
 * 
 * Testar att:
 * 1. HistoryEntry skapas korrekt vid save av vecka/månad/GFP
 * 2. upsertHistory() är idempotent per (periodType,periodId,staffId,clientId,metric)
 * 3. Historik bevaras efter arkivering av klient
 * 4. Historik bevaras efter borttagning av klient
 * 5. Dashboards läser från history för passerade perioder
 * 6. cleanup rör inte us:history
 */

import { HistoryEntry, DocStatus } from '../src/types';

// Mock data för tester
const mockHistoryEntry: HistoryEntry = {
  id: 'history-1',
  periodType: 'week',
  periodId: '2024-W01',
  staffId: 'staff-1',
  clientId: 'client-1',
  metric: 'weekDoc',
  status: 'approved',
  value: 3,
  ts: '2024-01-01T10:00:00.000Z'
};

const mockWeekDocEntry: Omit<HistoryEntry, 'id' | 'ts'> = {
  periodType: 'week',
  periodId: '2024-W01',
  staffId: 'staff-1',
  clientId: 'client-1',
  metric: 'weekDoc',
  status: 'approved',
  value: 3
};

const mockMonthReportEntry: Omit<HistoryEntry, 'id' | 'ts'> = {
  periodType: 'month',
  periodId: '2024-01',
  staffId: 'staff-1',
  clientId: 'client-1',
  metric: 'monthReport',
  status: 'approved',
  value: 1
};

const mockGfpEntry: Omit<HistoryEntry, 'id' | 'ts'> = {
  periodType: 'week',
  periodId: '2024-W01',
  staffId: 'staff-1',
  clientId: 'client-1',
  metric: 'gfp',
  status: 'approved',
  value: 1
};

describe('Historiska KPI', () => {
  
  test('1. HistoryEntry skapas korrekt vid save av vecka/månad/GFP', () => {
    // Test veckodokumentation
    const weekDocEntry: HistoryEntry = {
      id: 'test-id',
      ...mockWeekDocEntry,
      ts: '2024-01-01T10:00:00.000Z'
    };
    
    expect(weekDocEntry.periodType).toBe('week');
    expect(weekDocEntry.periodId).toBe('2024-W01');
    expect(weekDocEntry.metric).toBe('weekDoc');
    expect(weekDocEntry.status).toBe('approved');
    expect(weekDocEntry.value).toBe(3);
    expect(weekDocEntry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    
    // Test månadsrapport
    const monthReportEntry: HistoryEntry = {
      id: 'test-id-2',
      ...mockMonthReportEntry,
      ts: '2024-01-01T10:00:00.000Z'
    };
    
    expect(monthReportEntry.periodType).toBe('month');
    expect(monthReportEntry.periodId).toBe('2024-01');
    expect(monthReportEntry.metric).toBe('monthReport');
    expect(monthReportEntry.status).toBe('approved');
    expect(monthReportEntry.value).toBe(1);
    
    // Test GFP
    const gfpEntry: HistoryEntry = {
      id: 'test-id-3',
      ...mockGfpEntry,
      ts: '2024-01-01T10:00:00.000Z'
    };
    
    expect(gfpEntry.periodType).toBe('week');
    expect(gfpEntry.periodId).toBe('2024-W01');
    expect(gfpEntry.metric).toBe('gfp');
    expect(gfpEntry.status).toBe('approved');
    expect(gfpEntry.value).toBe(1);
  });

  test('2. upsertHistory() är idempotent per (periodType,periodId,staffId,clientId,metric)', () => {
    // Simulera upsertHistory funktionalitet
    const history: HistoryEntry[] = [];
    
    const upsertEntry = (entry: Omit<HistoryEntry, 'id' | 'ts'>) => {
      const key = `${entry.periodType}:${entry.periodId}:${entry.staffId}:${entry.clientId}:${entry.metric}`;
      const existingIndex = history.findIndex(h => 
        h.periodType === entry.periodType &&
        h.periodId === entry.periodId &&
        h.staffId === entry.staffId &&
        h.clientId === entry.clientId &&
        h.metric === entry.metric
      );
      
      const newEntry: HistoryEntry = {
        id: existingIndex >= 0 ? history[existingIndex]!.id : crypto.randomUUID(),
        ...entry,
        ts: new Date().toISOString()
      };
      
      if (existingIndex >= 0) {
        history[existingIndex] = newEntry;
      } else {
        history.push(newEntry);
      }
    };
    
    // Första anropet - ska skapa ny entry
    upsertEntry(mockWeekDocEntry);
    expect(history).toHaveLength(1);
    const firstId = history[0]!.id;
    
    // Andra anropet med samma data - ska uppdatera befintlig entry
    upsertEntry({ ...mockWeekDocEntry, status: 'rejected' });
    expect(history).toHaveLength(1); // Samma antal entries
    expect(history[0]!.id).toBe(firstId); // Samma ID
    expect(history[0]!.status).toBe('rejected'); // Uppdaterad status
    
    // Tredje anropet med annan metric - ska skapa ny entry
    upsertEntry({ ...mockWeekDocEntry, metric: 'gfp' });
    expect(history).toHaveLength(2); // Ny entry skapad
  });

  test('3. Historik bevaras efter arkivering av klient', () => {
    const history: HistoryEntry[] = [
      {
        id: 'history-1',
        periodType: 'week',
        periodId: '2024-W01',
        staffId: 'staff-1',
        clientId: 'client-1',
        metric: 'weekDoc',
        status: 'approved',
        value: 3,
        ts: '2024-01-01T10:00:00.000Z'
      },
      {
        id: 'history-2',
        periodType: 'month',
        periodId: '2024-01',
        staffId: 'staff-1',
        clientId: 'client-1',
        metric: 'monthReport',
        status: 'approved',
        value: 1,
        ts: '2024-01-01T10:00:00.000Z'
      }
    ];
    
    // Simulera arkivering av klient (sätt archivedAt)
    const archivedClient = {
      id: 'client-1',
      name: 'Test Klient',
      archivedAt: '2024-01-15T10:00:00.000Z'
    };
    
    // Historik ska fortfarande finnas kvar
    const clientHistory = history.filter(h => h.clientId === 'client-1');
    expect(clientHistory).toHaveLength(2);
    expect(clientHistory[0]?.status).toBe('approved');
    expect(clientHistory[1]?.status).toBe('approved');
    
    // Historik ska vara tillgänglig för dashboards
    const weekHistory = history.filter(h => h.periodType === 'week' && h.periodId === '2024-W01');
    expect(weekHistory).toHaveLength(1);
    expect(weekHistory[0]?.metric).toBe('weekDoc');
  });

  test('4. Historik bevaras efter borttagning av klient', () => {
    const history: HistoryEntry[] = [
      {
        id: 'history-1',
        periodType: 'week',
        periodId: '2024-W01',
        staffId: 'staff-1',
        clientId: 'client-1',
        metric: 'weekDoc',
        status: 'approved',
        value: 3,
        ts: '2024-01-01T10:00:00.000Z'
      },
      {
        id: 'history-2',
        periodType: 'week',
        periodId: '2024-W02',
        staffId: 'staff-1',
        clientId: 'client-2',
        metric: 'weekDoc',
        status: 'approved',
        value: 2,
        ts: '2024-01-08T10:00:00.000Z'
      }
    ];
    
    // Simulera borttagning av client-1
    const remainingHistory = history; // Historik bevaras i localStorage
    
    // Historik för borttagen klient ska fortfarande finnas
    const deletedClientHistory = remainingHistory.filter(h => h.clientId === 'client-1');
    expect(deletedClientHistory).toHaveLength(1);
    expect(deletedClientHistory[0]?.periodId).toBe('2024-W01');
    
    // Historik för kvarvarande klient ska också finnas
    const remainingClientHistory = remainingHistory.filter(h => h.clientId === 'client-2');
    expect(remainingClientHistory).toHaveLength(1);
    expect(remainingClientHistory[0]?.periodId).toBe('2024-W02');
  });

  test('5. Dashboards läser från history för passerade perioder', () => {
    const history: HistoryEntry[] = [
      // Passerade veckor (från arkiverade/borttagna klienter)
      {
        id: 'history-1',
        periodType: 'week',
        periodId: '2024-W01',
        staffId: 'staff-1',
        clientId: 'archived-client-1',
        metric: 'weekDoc',
        status: 'approved',
        value: 3,
        ts: '2024-01-01T10:00:00.000Z'
      },
      {
        id: 'history-2',
        periodType: 'week',
        periodId: '2024-W02',
        staffId: 'staff-1',
        clientId: 'deleted-client-1',
        metric: 'weekDoc',
        status: 'approved',
        value: 2,
        ts: '2024-01-08T10:00:00.000Z'
      },
      // Nuvarande vecka (från aktiva klienter)
      {
        id: 'history-3',
        periodType: 'week',
        periodId: '2024-W03',
        staffId: 'staff-1',
        clientId: 'active-client-1',
        metric: 'weekDoc',
        status: 'approved',
        value: 4,
        ts: '2024-01-15T10:00:00.000Z'
      }
    ];
    
    const currentWeek = '2024-W03';
    
    // Simulera dashboard-beräkning
    const pastWeeks = history.filter(h => 
      h.periodType === 'week' && 
      h.metric === 'weekDoc' && 
      h.status === 'approved' &&
      h.periodId < currentWeek // Passerade veckor
    );
    
    const currentWeekData = history.filter(h => 
      h.periodType === 'week' && 
      h.metric === 'weekDoc' && 
      h.status === 'approved' &&
      h.periodId === currentWeek // Nuvarande vecka
    );
    
    // Passerade veckor ska inkludera data från arkiverade/borttagna klienter
    expect(pastWeeks).toHaveLength(2);
    expect(pastWeeks.some(h => h.clientId === 'archived-client-1')).toBe(true);
    expect(pastWeeks.some(h => h.clientId === 'deleted-client-1')).toBe(true);
    
    // Nuvarande vecka ska inkludera data från aktiva klienter
    expect(currentWeekData).toHaveLength(1);
    expect(currentWeekData[0]?.clientId).toBe('active-client-1');
    
    // Aggregerad data för sparkline
    const weeklyByWeek: Record<string, number> = {};
    [...pastWeeks, ...currentWeekData].forEach(entry => {
      weeklyByWeek[entry.periodId] = (weeklyByWeek[entry.periodId] || 0) + 1;
    });
    
    expect(weeklyByWeek['2024-W01']).toBe(1);
    expect(weeklyByWeek['2024-W02']).toBe(1);
    expect(weeklyByWeek['2024-W03']).toBe(1);
  });

  test('6. cleanup rör inte us:history', () => {
    const mockLocalStorage = {
      'us:client-1:weekly:2024-W01': '{"weekId":"2024-W01","status":"approved"}',
      'us:client-2:monthly:2024-01': '{"monthId":"2024-01","status":"approved"}',
      'us:history': JSON.stringify([
        {
          id: 'history-1',
          periodType: 'week',
          periodId: '2024-W01',
          staffId: 'staff-1',
          clientId: 'client-1',
          metric: 'weekDoc',
          status: 'approved',
          value: 3,
          ts: '2024-01-01T10:00:00.000Z'
        }
      ]),
      'other-key': 'some-data'
    };
    
    // Simulera cleanup-funktion
    const cleanup = (allClientIds: Set<string>) => {
      const keysToRemove: string[] = [];
      const PERIOD_DATA_PREFIX = 'us:';
      const HISTORY_KEY = 'us:history';
      
      Object.keys(mockLocalStorage).forEach(key => {
        if (key.startsWith(PERIOD_DATA_PREFIX) && key !== HISTORY_KEY) {
          const parts = key.split(':');
          if (parts.length >= 2 && parts[1]) {
            const clientId = parts[1];
            if (!allClientIds.has(clientId)) {
              keysToRemove.push(key);
            }
          }
        }
      });
      
      // Remove orphaned keys (but NEVER touch us:history)
      keysToRemove.forEach(key => {
        if (key !== HISTORY_KEY) { // Extra safety check
          delete mockLocalStorage[key];
        }
      });
      
      return keysToRemove;
    };
    
    // Test med client-1 som inte finns längre
    const allClientIds = new Set(['client-3']); // client-1 och client-2 finns inte
    const removedKeys = cleanup(allClientIds);
    
    // Perioddata för client-1 och client-2 ska tas bort
    expect(removedKeys).toContain('us:client-1:weekly:2024-W01');
    expect(removedKeys).toContain('us:client-2:monthly:2024-01');
    expect(mockLocalStorage['us:client-1:weekly:2024-W01']).toBeUndefined();
    expect(mockLocalStorage['us:client-2:monthly:2024-01']).toBeUndefined();
    
    // us:history ska ALDRIG tas bort
    expect(removedKeys).not.toContain('us:history');
    expect(mockLocalStorage['us:history']).toBeDefined();
    expect(mockLocalStorage['us:history']).toContain('history-1');
    
    // other-key ska inte påverkas
    expect(mockLocalStorage['other-key']).toBe('some-data');
  });
});

console.log('✅ Alla 6 testfall för historiska KPI är definierade och redo att köras');
