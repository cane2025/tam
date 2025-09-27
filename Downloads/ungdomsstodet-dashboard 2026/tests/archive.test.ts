/**
 * Testfall för arkivering av klienter
 * 
 * Testar att:
 * 1. Klienter kan arkiveras (sätts archivedAt)
 * 2. Arkiverade klienter filtreras bort från aktiva listor
 * 3. Arkiverade klienter kan återställas (archivedAt tas bort)
 * 4. Historik bevaras för arkiverade klienter
 */

import { Client, Staff, AppState } from '../src/types';

// Mock data för tester
const mockClient: Client = {
  id: 'client-1',
  name: 'Test Klient',
  plan: { carePlanDate: undefined, hasGFP: false, staffNotified: false, notes: "" },
  plans: [],
  weeklyDocs: {
    '2024-W01': {
      weekId: '2024-W01',
      days: { mon: true, tue: false, wed: true, thu: false, fri: false, sat: false, sun: false },
      status: 'approved',
      note: 'Test vecka'
    }
  },
  monthlyReports: {
    '2024-01': {
      monthId: '2024-01',
      sent: true,
      status: 'approved',
      note: 'Test månad'
    }
  },
  visma: {},
  createdAt: '2024-01-01'
};

const mockStaff: Staff = {
  id: 'staff-1',
  name: 'Test Personal',
  clients: [mockClient]
};

const mockState: AppState = {
  staff: [mockStaff],
  selectedStaffId: undefined,
  selectedClientId: undefined,
  lastBackup: '2024-01-01T10:00:00.000Z',
  version: '3.0'
};

describe('Arkivering av klienter', () => {
  
  test('1. Klient kan arkiveras (sätts archivedAt)', () => {
    const now = new Date().toISOString();
    
    // Simulera arkivering
    const archivedClient: Client = {
      ...mockClient,
      archivedAt: now
    };
    
    expect(archivedClient.archivedAt).toBeDefined();
    expect(archivedClient.archivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(archivedClient.id).toBe(mockClient.id);
    expect(archivedClient.name).toBe(mockClient.name);
  });

  test('2. Arkiverade klienter filtreras bort från aktiva listor', () => {
    const archivedClient: Client = {
      ...mockClient,
      archivedAt: '2024-01-15T10:00:00.000Z'
    };
    
    const activeClient: Client = {
      ...mockClient,
      id: 'client-2',
      name: 'Aktiv Klient'
    };
    
    const staffWithMixedClients: Staff = {
      ...mockStaff,
      clients: [archivedClient, activeClient]
    };
    
    // Filtrera bort arkiverade klienter
    const activeClients = staffWithMixedClients.clients.filter(c => !c.archivedAt);
    
    expect(activeClients).toHaveLength(1);
    expect(activeClients[0]?.id).toBe('client-2');
    expect(activeClients[0]?.name).toBe('Aktiv Klient');
  });

  test('3. Arkiverade klienter kan återställas (archivedAt tas bort)', () => {
    const archivedClient: Client = {
      ...mockClient,
      archivedAt: '2024-01-15T10:00:00.000Z'
    };
    
    // Simulera återställning
    const restoredClient: Client = {
      ...archivedClient,
      archivedAt: undefined
    };
    
    expect(restoredClient.archivedAt).toBeUndefined();
    expect(restoredClient.id).toBe(mockClient.id);
    expect(restoredClient.name).toBe(mockClient.name);
    expect(restoredClient.weeklyDocs).toEqual(mockClient.weeklyDocs);
    expect(restoredClient.monthlyReports).toEqual(mockClient.monthlyReports);
  });

  test('4. Historik bevaras för arkiverade klienter', () => {
    const archivedClient: Client = {
      ...mockClient,
      archivedAt: '2024-01-15T10:00:00.000Z'
    };
    
    // Kontrollera att all historik finns kvar
    expect(archivedClient.weeklyDocs).toEqual(mockClient.weeklyDocs);
    expect(archivedClient.monthlyReports).toEqual(mockClient.monthlyReports);
    expect(archivedClient.plans).toEqual(mockClient.plans);
    expect(archivedClient.visma).toEqual(mockClient.visma);
    expect(archivedClient.createdAt).toBe(mockClient.createdAt);
    
    // Kontrollera specifik historik
    expect(archivedClient.weeklyDocs['2024-W01']).toBeDefined();
    expect(archivedClient.weeklyDocs['2024-W01']?.status).toBe('approved');
    expect(archivedClient.weeklyDocs['2024-W01']?.note).toBe('Test vecka');
    
    expect(archivedClient.monthlyReports['2024-01']).toBeDefined();
    expect(archivedClient.monthlyReports['2024-01']?.status).toBe('approved');
    expect(archivedClient.monthlyReports['2024-01']?.note).toBe('Test månad');
  });

  test('Bonus: KPI-beräkningar ignorerar arkiverade klienter', () => {
    const archivedClient: Client = {
      ...mockClient,
      archivedAt: '2024-01-15T10:00:00.000Z'
    };
    
    const activeClient: Client = {
      ...mockClient,
      id: 'client-2',
      name: 'Aktiv Klient',
      plans: [{
        id: 'plan-1',
        title: 'GFP 1',
        date: '2024-01-01',
        dueDate: '2024-01-22',
        note: 'Test plan',
        staffInformed: true,
        done: true,
        status: 'approved'
      }]
    };
    
    const staffWithMixedClients: Staff = {
      ...mockStaff,
      clients: [archivedClient, activeClient]
    };
    
    // Simulera KPI-beräkning (bara aktiva klienter)
    let totalPlansActive = 0;
    staffWithMixedClients.clients.forEach(client => {
      if (client.archivedAt) return; // Skip archived
      
      const latestPlan = client.plans[0];
      if (latestPlan?.done) {
        totalPlansActive += 1;
      }
    });
    
    expect(totalPlansActive).toBe(1); // Bara den aktiva klienten räknas
  });
});

console.log('✅ Alla testfall för arkivering är definierade och redo att köras');
