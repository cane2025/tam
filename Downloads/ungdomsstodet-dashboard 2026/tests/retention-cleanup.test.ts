/**
 * Test cases for retention cleanup functionality
 */

import { describe, it, expect } from 'vitest';

// Mock app state for testing
interface TestClient {
  id: string;
  name: string;
  archivedAt?: string;
  deletedAt?: string;
  plans: TestPlan[];
  weeklyDocs: Record<string, TestWeeklyDoc>;
  monthlyReports: Record<string, TestMonthlyReport>;
  visma: Record<string, TestVismaWeek>;
}

interface TestPlan {
  id: string;
  title: string;
  deletedAt?: string;
}

interface TestWeeklyDoc {
  weekId: string;
  deletedAt?: string;
}

interface TestMonthlyReport {
  monthId: string;
  deletedAt?: string;
}

interface TestVismaWeek {
  weekId: string;
  deletedAt?: string;
}

interface TestStaff {
  id: string;
  name: string;
  clients: TestClient[];
}

// Mock implementation of retentionSweep function
function mockRetentionSweep(cutoffDays: number, staff: TestStaff[]) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);
  const cutoffISO = cutoffDate.toISOString();
  
  const toRemove: Array<{ type: string; id: string; staffId: string; clientId?: string; data: any; deletedAt: string }> = [];
  
  staff.forEach(staffMember => {
    staffMember.clients.forEach(client => {
      // Check client-level deletion/archiving
      if (client.archivedAt && client.archivedAt < cutoffISO) {
        toRemove.push({
          type: 'client',
          id: client.id,
          staffId: staffMember.id,
          clientId: client.id,
          data: client,
          deletedAt: client.archivedAt
        });
      } else if (client.deletedAt && client.deletedAt < cutoffISO) {
        toRemove.push({
          type: 'client',
          id: client.id,
          staffId: staffMember.id,
          clientId: client.id,
          data: client,
          deletedAt: client.deletedAt
        });
      } else {
        // Check individual items within active clients
        client.plans.forEach(plan => {
          if (plan.deletedAt && plan.deletedAt < cutoffISO) {
            toRemove.push({
              type: 'plan',
              id: plan.id,
              staffId: staffMember.id,
              clientId: client.id,
              data: plan,
              deletedAt: plan.deletedAt
            });
          }
        });
        
        Object.values(client.weeklyDocs).forEach(doc => {
          if (doc.deletedAt && doc.deletedAt < cutoffISO) {
            toRemove.push({
              type: 'weeklyDoc',
              id: doc.weekId,
              staffId: staffMember.id,
              clientId: client.id,
              data: doc,
              deletedAt: doc.deletedAt
            });
          }
        });
        
        Object.values(client.monthlyReports).forEach(report => {
          if (report.deletedAt && report.deletedAt < cutoffISO) {
            toRemove.push({
              type: 'monthlyReport',
              id: report.monthId,
              staffId: staffMember.id,
              clientId: client.id,
              data: report,
              deletedAt: report.deletedAt
            });
          }
        });
        
        Object.values(client.visma).forEach(visma => {
          if (visma.deletedAt && visma.deletedAt < cutoffISO) {
            toRemove.push({
              type: 'vismaWeek',
              id: visma.weekId,
              staffId: staffMember.id,
              clientId: client.id,
              data: visma,
              deletedAt: visma.deletedAt
            });
          }
        });
      }
    });
  });
  
  return { toRemove, cutoffDate: cutoffISO };
}

// Test data
const createTestData = () => {
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 200); // 200 days ago
  
  const recentDate = new Date();
  recentDate.setDate(recentDate.getDate() - 50); // 50 days ago
  
  return [
    {
      id: 'staff1',
      name: 'Anna Andersson',
      clients: [
        {
          id: 'client1',
          name: 'Klient A',
          archivedAt: oldDate.toISOString(), // Old archived client
          plans: [],
          weeklyDocs: {},
          monthlyReports: {},
          visma: {}
        },
        {
          id: 'client2',
          name: 'Klient B',
          deletedAt: recentDate.toISOString(), // Recent soft-deleted client
          plans: [],
          weeklyDocs: {},
          monthlyReports: {},
          visma: {}
        },
        {
          id: 'client3',
          name: 'Klient C',
          plans: [
            {
              id: 'plan1',
              title: 'Gammal plan',
              deletedAt: oldDate.toISOString() // Old deleted plan
            },
            {
              id: 'plan2',
              title: 'Ny plan',
              deletedAt: recentDate.toISOString() // Recent deleted plan
            }
          ],
          weeklyDocs: {
            '2024-W10': {
              weekId: '2024-W10',
              deletedAt: oldDate.toISOString() // Old deleted doc
            },
            '2024-W30': {
              weekId: '2024-W30',
              deletedAt: recentDate.toISOString() // Recent deleted doc
            }
          },
          monthlyReports: {
            '2024-03': {
              monthId: '2024-03',
              deletedAt: oldDate.toISOString() // Old deleted report
            }
          },
          visma: {
            '2024-W11': {
              weekId: '2024-W11',
              deletedAt: oldDate.toISOString() // Old deleted visma
            }
          }
        }
      ]
    }
  ];
};

describe('Retention Cleanup', () => {
  
  it('Test 1: Should identify old archived/deleted items correctly', () => {
    const testData = createTestData();
    const result = mockRetentionSweep(180, testData); // 180 days cutoff
    
    // Should find 4 old items: 1 client, 1 plan, 1 weekly doc, 1 monthly report, 1 visma week
    expect(result.toRemove).toHaveLength(5);
    
    // Check that old client is included
    const oldClient = result.toRemove.find(item => item.type === 'client' && item.id === 'client1');
    expect(oldClient).toBeDefined();
    
    // Check that recent client is NOT included
    const recentClient = result.toRemove.find(item => item.type === 'client' && item.id === 'client2');
    expect(recentClient).toBeUndefined();
    
    // Check that old plan is included but recent plan is not
    const oldPlan = result.toRemove.find(item => item.type === 'plan' && item.id === 'plan1');
    const recentPlan = result.toRemove.find(item => item.type === 'plan' && item.id === 'plan2');
    expect(oldPlan).toBeDefined();
    expect(recentPlan).toBeUndefined();
  });

  it('Test 2: Should return empty result when no old items exist', () => {
    const testData = [{
      id: 'staff1',
      name: 'Anna Andersson',
      clients: [{
        id: 'client1',
        name: 'Klient A',
        deletedAt: new Date().toISOString(), // Today
        plans: [],
        weeklyDocs: {},
        monthlyReports: {},
        visma: {}
      }]
    }];
    
    const result = mockRetentionSweep(180, testData);
    expect(result.toRemove).toHaveLength(0);
  });

  it('Test 3: Should handle different retention periods correctly', () => {
    const testData = createTestData();
    
    // Test with 100 days - should find old items (200 days old)
    const result100 = mockRetentionSweep(100, testData);
    expect(result100.toRemove.length).toBeGreaterThan(0);
    
    // Test with 300 days - should find nothing (oldest is 200 days)
    const result300 = mockRetentionSweep(300, testData);
    expect(result300.toRemove).toHaveLength(0);
    
    // Test with 60 days - should find both old and recent items
    const result60 = mockRetentionSweep(60, testData);
    expect(result60.toRemove.length).toBeGreaterThan(result100.toRemove.length);
  });

  it('Test 4: Should preserve data structure for export', () => {
    const testData = createTestData();
    const result = mockRetentionSweep(180, testData);
    
    // Check that export data structure is correct
    const exportData = result.toRemove.map(item => ({
      type: item.type,
      id: item.id,
      staffId: item.staffId,
      clientId: item.clientId,
      deletedAt: item.deletedAt,
      data: JSON.stringify(item.data)
    }));
    
    expect(exportData).toHaveLength(result.toRemove.length);
    
    // Verify each export item has required fields
    exportData.forEach(item => {
      expect(item.type).toBeDefined();
      expect(item.id).toBeDefined();
      expect(item.staffId).toBeDefined();
      expect(item.deletedAt).toBeDefined();
      expect(item.data).toBeDefined();
      expect(typeof item.data).toBe('string'); // Should be JSON string
    });
  });

  it('Test 5: Should categorize items correctly for impact summary', () => {
    const testData = createTestData();
    const result = mockRetentionSweep(180, testData);
    
    // Count items by type
    const clientCount = result.toRemove.filter(item => item.type === 'client').length;
    const planCount = result.toRemove.filter(item => item.type === 'plan').length;
    const weeklyDocCount = result.toRemove.filter(item => item.type === 'weeklyDoc').length;
    const monthlyReportCount = result.toRemove.filter(item => item.type === 'monthlyReport').length;
    const vismaWeekCount = result.toRemove.filter(item => item.type === 'vismaWeek').length;
    
    // Verify expected counts based on test data
    expect(clientCount).toBe(1); // 1 old archived client
    expect(planCount).toBe(1); // 1 old deleted plan
    expect(weeklyDocCount).toBe(1); // 1 old deleted weekly doc
    expect(monthlyReportCount).toBe(1); // 1 old deleted monthly report
    expect(vismaWeekCount).toBe(1); // 1 old deleted visma week
    
    // Total should match
    expect(clientCount + planCount + weeklyDocCount + monthlyReportCount + vismaWeekCount).toBe(result.toRemove.length);
    
    // Create impact summary
    const impactSummary = `Rensar ${clientCount} klienter, ${planCount} planer, ${weeklyDocCount} veckorapporter, ${monthlyReportCount} månadsrapporter, ${vismaWeekCount} Visma-veckor`;
    expect(impactSummary).toContain('1 klienter');
    expect(impactSummary).toContain('1 planer');
    expect(impactSummary).toContain('1 veckorapporter');
    expect(impactSummary).toContain('1 månadsrapporter');
    expect(impactSummary).toContain('1 Visma-veckor');
  });

});
