import { useMemo } from 'react';
import { getCurrentWeek, getCurrentMonth, addDaysISO, todayYMD, addWeeks } from '../date';
/**
 * Hook som aggregerar statistik för en specifik personal
 * Beräknar KPI:er och dokumentationsgrad över tid
 */
export function useStaffStats(state, staffId) {
    return useMemo(() => {
        if (!staffId)
            return null;
        const staff = state.staff.find(s => s.id === staffId);
        if (!staff)
            return null;
        const nowWeek = getCurrentWeek();
        const nowMonth = getCurrentMonth();
        const today = todayYMD();
        // Beräkna senaste 4 veckor för graf
        const last4Weeks = [];
        for (let i = 3; i >= 0; i--) {
            last4Weeks.push(addWeeks(nowWeek, -i));
        }
        // Initiera KPI:er
        let totalClients = 0;
        let activePlans = 0;
        let delayedPlans = 0;
        let waitingPlans = 0;
        let completedThisWeek = 0;
        let delayedDocs = 0;
        let delayedMonthly = 0;
        let delayedVisma = 0;
        let totalDocuments = 0;
        let approvedDocuments = 0;
        // Statistik per vecka
        const weeklyStatsMap = new Map();
        // Initiera veckostatistik
        last4Weeks.forEach(weekId => {
            weeklyStatsMap.set(weekId, {
                weekId,
                approved: 0,
                pending: 0,
                rejected: 0,
                total: 0,
                rate: 0
            });
        });
        // Gå igenom alla klienter för denna personal
        staff.clients.forEach((client) => {
            totalClients++;
            // Analysera vårdplan
            const carePlanDate = client.plan.carePlanDate;
            if (!carePlanDate) {
                waitingPlans++;
            }
            else {
                const dueDate = addDaysISO(carePlanDate, 21);
                if (!client.plan.hasGFP) {
                    if (today > dueDate) {
                        delayedPlans++;
                    }
                    else {
                        waitingPlans++;
                    }
                }
                else {
                    activePlans++;
                }
            }
            // Analysera veckodokumentation
            Object.values(client.weeklyDocs).forEach(doc => {
                totalDocuments++;
                if (doc.status === 'approved') {
                    approvedDocuments++;
                }
                // Denna vecka completions
                if (doc.weekId === nowWeek && doc.status === 'approved') {
                    completedThisWeek++;
                }
                // Försenade dokument (äldre än nuvarande vecka och inte godkända)
                if (compareWeekId(doc.weekId, nowWeek) < 0 && doc.status !== 'approved') {
                    delayedDocs++;
                }
                // Uppdatera veckostatistik om denna vecka finns i vår analys
                if (weeklyStatsMap.has(doc.weekId)) {
                    const weekStats = weeklyStatsMap.get(doc.weekId);
                    weekStats.total++;
                    if (doc.status === 'approved')
                        weekStats.approved++;
                    else if (doc.status === 'pending')
                        weekStats.pending++;
                    else if (doc.status === 'rejected')
                        weekStats.rejected++;
                }
            });
            // Analysera månadsrapporter
            Object.values(client.monthlyReports).forEach(report => {
                totalDocuments++;
                if (report.status === 'approved') {
                    approvedDocuments++;
                }
                // Försenade månadsrapporter
                if (compareMonthId(report.monthId, nowMonth) < 0 &&
                    (!report.sent || report.status !== 'approved')) {
                    delayedMonthly++;
                }
            });
            // Analysera Visma
            Object.values(client.visma).forEach(visma => {
                totalDocuments++;
                if (visma.status === 'approved') {
                    approvedDocuments++;
                }
                // Försenad Visma
                if (compareWeekId(visma.weekId, nowWeek) < 0 && visma.status !== 'approved') {
                    delayedVisma++;
                }
            });
        });
        // Beräkna rate för varje vecka
        const weeklyStats = Array.from(weeklyStatsMap.values()).map(weekStats => ({
            ...weekStats,
            rate: weekStats.total > 0 ? weekStats.approved / weekStats.total : 0
        }));
        const documentationRate = totalDocuments > 0 ? approvedDocuments / totalDocuments : 0;
        const kpis = {
            totalClients,
            activePlans,
            delayedPlans,
            waitingPlans,
            completedThisWeek,
            delayedDocs,
            delayedMonthly,
            delayedVisma,
            documentationRate
        };
        return {
            kpis,
            weeklyStats,
            totalDocuments,
            approvedDocuments
        };
    }, [state.staff, staffId]);
}
// Helper functions för datumjämförelser
function compareWeekId(a, b) {
    const [ya, wa] = a.split('-W');
    const [yb, wb] = b.split('-W');
    if (ya !== yb)
        return Number(ya) - Number(yb);
    return Number(wa) - Number(wb);
}
function compareMonthId(a, b) {
    return a.localeCompare(b);
}
