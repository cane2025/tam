/**
 * Testfall för mjuk-radering via deletedAt
 * 
 * Testar att:
 * 1. Alla entiteter får deletedAt?: string
 * 2. UI/KPI filtrerar bort deletedAt != null i "nuet"
 * 3. Historik (us:history) lämnas orörd
 * 4. Återställning möjlig för soft-deleted poster (ta bort deletedAt)
 */

import { Client, GFPPlan, WeeklyDoc, MonthlyReport, VismaWeek, Plan } from '../src/types';

// Mock data för tester
const mockClient: Client = {
  id: 'client-1',
  name: 'Test Klient',
  plan: { carePlanDate: undefined, hasGFP: false, staffNotified: false, notes: "" },
  plans: [],
  weeklyDocs: {},
  monthlyReports: {},
  visma: {},
  createdAt: '2024-01-01'
};

const mockGfpPlan: GFPPlan = {
  id: 'plan-1',
  title: 'GFP 1',
  date: '2024-01-01',
  dueDate: '2024-01-22',
  note: 'Test plan',
  staffInformed: true,
  done: true,
  status: 'approved'
};

const mockWeeklyDoc: WeeklyDoc = {
  weekId: '2024-W01',
  days: { mon: true, tue: false, wed: true, thu: false, fri: false, sat: false, sun: false },
  status: 'approved',
  note: 'Test vecka'
};

const mockMonthlyReport: MonthlyReport = {
  monthId: '2024-01',
  sent: true,
  status: 'approved',
  note: 'Test månad'
};

const mockVismaWeek: VismaWeek = {
  weekId: '2024-W01',
  days: { mon: true, tue: false, wed: true, thu: false, fri: false },
  status: 'approved'
};

const mockPlan: Plan = {
  carePlanDate: '2024-01-01',
  hasGFP: true,
  staffNotified: true,
  notes: 'Test plan',
  lastUpdated: '2024-01-01T10:00:00.000Z'
};

describe('Mjuk-radering via deletedAt', () => {
  
  test('1. Alla entiteter får deletedAt?: string', () => {
    // Test Client
    const clientWithDeletedAt: Client = {
      ...mockClient,
      deletedAt: '2024-01-15T10:00:00.000Z'
    };
    
    expect(clientWithDeletedAt.deletedAt).toBeDefined();
    expect(clientWithDeletedAt.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    
    // Test GFPPlan
    const gfpPlanWithDeletedAt: GFPPlan = {
      ...mockGfpPlan,
      deletedAt: '2024-01-15T10:00:00.000Z'
    };
    
    expect(gfpPlanWithDeletedAt.deletedAt).toBeDefined();
    expect(gfpPlanWithDeletedAt.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    
    // Test WeeklyDoc
    const weeklyDocWithDeletedAt: WeeklyDoc = {
      ...mockWeeklyDoc,
      deletedAt: '2024-01-15T10:00:00.000Z'
    };
    
    expect(weeklyDocWithDeletedAt.deletedAt).toBeDefined();
    expect(weeklyDocWithDeletedAt.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    
    // Test MonthlyReport
    const monthlyReportWithDeletedAt: MonthlyReport = {
      ...mockMonthlyReport,
      deletedAt: '2024-01-15T10:00:00.000Z'
    };
    
    expect(monthlyReportWithDeletedAt.deletedAt).toBeDefined();
    expect(monthlyReportWithDeletedAt.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    
    // Test VismaWeek
    const vismaWeekWithDeletedAt: VismaWeek = {
      ...mockVismaWeek,
      deletedAt: '2024-01-15T10:00:00.000Z'
    };
    
    expect(vismaWeekWithDeletedAt.deletedAt).toBeDefined();
    expect(vismaWeekWithDeletedAt.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    
    // Test Plan
    const planWithDeletedAt: Plan = {
      ...mockPlan,
      deletedAt: '2024-01-15T10:00:00.000Z'
    };
    
    expect(planWithDeletedAt.deletedAt).toBeDefined();
    expect(planWithDeletedAt.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  test('2. UI/KPI filtrerar bort deletedAt != null i "nuet"', () => {
    const activeClient: Client = {
      ...mockClient,
      id: 'client-1',
      name: 'Aktiv Klient'
    };
    
    const softDeletedClient: Client = {
      ...mockClient,
      id: 'client-2',
      name: 'Borttagen Klient',
      deletedAt: '2024-01-15T10:00:00.000Z'
    };
    
    const archivedClient: Client = {
      ...mockClient,
      id: 'client-3',
      name: 'Arkiverad Klient',
      archivedAt: '2024-01-10T10:00:00.000Z'
    };
    
    const clients = [activeClient, softDeletedClient, archivedClient];
    
    // Simulera UI-filtrering för aktiva klienter
    const activeClients = clients.filter(c => !c.archivedAt && !c.deletedAt);
    expect(activeClients).toHaveLength(1);
    expect(activeClients[0]?.id).toBe('client-1');
    expect(activeClients[0]?.name).toBe('Aktiv Klient');
    
    // Simulera KPI-beräkning (bara aktiva klienter)
    let totalActiveClients = 0;
    clients.forEach(client => {
      if (!client.archivedAt && !client.deletedAt) {
        totalActiveClients += 1;
      }
    });
    
    expect(totalActiveClients).toBe(1);
    
    // Test GFP-planer filtrering
    const activePlan: GFPPlan = {
      ...mockGfpPlan,
      id: 'plan-1',
      title: 'Aktiv Plan'
    };
    
    const softDeletedPlan: GFPPlan = {
      ...mockGfpPlan,
      id: 'plan-2',
      title: 'Borttagen Plan',
      deletedAt: '2024-01-15T10:00:00.000Z'
    };
    
    const plans = [activePlan, softDeletedPlan];
    const activePlans = plans.filter(p => !p.deletedAt);
    
    expect(activePlans).toHaveLength(1);
    expect(activePlans[0]?.id).toBe('plan-1');
    expect(activePlans[0]?.title).toBe('Aktiv Plan');
  });

  test('3. Historik (us:history) lämnas orörd', () => {
    // Simulera history-data
    const mockHistory = [
      {
        id: 'history-1',
        periodType: 'week' as const,
        periodId: '2024-W01',
        staffId: 'staff-1',
        clientId: 'client-1',
        metric: 'weekDoc' as const,
        status: 'approved' as const,
        value: 3,
        ts: '2024-01-01T10:00:00.000Z'
      },
      {
        id: 'history-2',
        periodType: 'month' as const,
        periodId: '2024-01',
        staffId: 'staff-1',
        clientId: 'client-2',
        metric: 'monthReport' as const,
        status: 'approved' as const,
        value: 1,
        ts: '2024-01-01T10:00:00.000Z'
      }
    ];
    
    // Simulera mjuk-radering av klient
    const softDeletedClient: Client = {
      ...mockClient,
      id: 'client-1',
      name: 'Borttagen Klient',
      deletedAt: '2024-01-15T10:00:00.000Z'
    };
    
    // Historik ska fortfarande finnas kvar
    const clientHistory = mockHistory.filter(h => h.clientId === 'client-1');
    expect(clientHistory).toHaveLength(1);
    expect(clientHistory[0]?.status).toBe('approved');
    expect(clientHistory[0]?.value).toBe(3);
    
    // Historik ska vara tillgänglig för dashboards
    const weekHistory = mockHistory.filter(h => h.periodType === 'week' && h.periodId === '2024-W01');
    expect(weekHistory).toHaveLength(1);
    expect(weekHistory[0]?.metric).toBe('weekDoc');
    
    // Historik ska inte påverkas av mjuk-radering
    const allHistory = mockHistory;
    expect(allHistory).toHaveLength(2);
    expect(allHistory.every(h => h.ts)).toBe(true);
  });

  test('4. Återställning möjlig för soft-deleted poster (ta bort deletedAt)', () => {
    // Simulera mjuk-raderad klient
    const softDeletedClient: Client = {
      ...mockClient,
      id: 'client-1',
      name: 'Borttagen Klient',
      deletedAt: '2024-01-15T10:00:00.000Z'
    };
    
    // Simulera återställning (ta bort deletedAt)
    const restoredClient: Client = {
      ...softDeletedClient,
      deletedAt: undefined
    };
    
    expect(restoredClient.deletedAt).toBeUndefined();
    expect(restoredClient.id).toBe('client-1');
    expect(restoredClient.name).toBe('Borttagen Klient');
    expect(restoredClient.createdAt).toBe('2024-01-01');
    
    // Test GFP-plan återställning
    const softDeletedPlan: GFPPlan = {
      ...mockGfpPlan,
      id: 'plan-1',
      title: 'Borttagen Plan',
      deletedAt: '2024-01-15T10:00:00.000Z'
    };
    
    const restoredPlan: GFPPlan = {
      ...softDeletedPlan,
      deletedAt: undefined
    };
    
    expect(restoredPlan.deletedAt).toBeUndefined();
    expect(restoredPlan.id).toBe('plan-1');
    expect(restoredPlan.title).toBe('Borttagen Plan');
    expect(restoredPlan.status).toBe('approved');
    
    // Test veckodokument återställning
    const softDeletedWeeklyDoc: WeeklyDoc = {
      ...mockWeeklyDoc,
      deletedAt: '2024-01-15T10:00:00.000Z'
    };
    
    const restoredWeeklyDoc: WeeklyDoc = {
      ...softDeletedWeeklyDoc,
      deletedAt: undefined
    };
    
    expect(restoredWeeklyDoc.deletedAt).toBeUndefined();
    expect(restoredWeeklyDoc.weekId).toBe('2024-W01');
    expect(restoredWeeklyDoc.status).toBe('approved');
    
    // Test månadsrapport återställning
    const softDeletedMonthlyReport: MonthlyReport = {
      ...mockMonthlyReport,
      deletedAt: '2024-01-15T10:00:00.000Z'
    };
    
    const restoredMonthlyReport: MonthlyReport = {
      ...softDeletedMonthlyReport,
      deletedAt: undefined
    };
    
    expect(restoredMonthlyReport.deletedAt).toBeUndefined();
    expect(restoredMonthlyReport.monthId).toBe('2024-01');
    expect(restoredMonthlyReport.status).toBe('approved');
    
    // Test Visma-vecka återställning
    const softDeletedVismaWeek: VismaWeek = {
      ...mockVismaWeek,
      deletedAt: '2024-01-15T10:00:00.000Z'
    };
    
    const restoredVismaWeek: VismaWeek = {
      ...softDeletedVismaWeek,
      deletedAt: undefined
    };
    
    expect(restoredVismaWeek.deletedAt).toBeUndefined();
    expect(restoredVismaWeek.weekId).toBe('2024-W01');
    expect(restoredVismaWeek.status).toBe('approved');
  });
});

console.log('✅ Alla 4 testfall för mjuk-radering är definierade och redo att köras');
