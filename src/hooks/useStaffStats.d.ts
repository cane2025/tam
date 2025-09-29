import { AppState, WeekId } from '../types';
export interface StaffKpis {
    totalClients: number;
    activePlans: number;
    delayedPlans: number;
    waitingPlans: number;
    completedThisWeek: number;
    delayedDocs: number;
    delayedMonthly: number;
    delayedVisma: number;
    documentationRate: number;
}
export interface WeeklyDocumentationStats {
    weekId: WeekId;
    approved: number;
    pending: number;
    rejected: number;
    total: number;
    rate: number;
}
export interface StaffStats {
    kpis: StaffKpis;
    weeklyStats: WeeklyDocumentationStats[];
    totalDocuments: number;
    approvedDocuments: number;
}
/**
 * Hook som aggregerar statistik för en specifik personal
 * Beräknar KPI:er och dokumentationsgrad över tid
 */
export declare function useStaffStats(state: AppState, staffId: string | undefined): StaffStats | null;
