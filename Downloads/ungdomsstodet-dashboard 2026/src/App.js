import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState, useRef } from "react";
import { getStoredData, getBackups, getStorageType } from "./storage";
import { getCurrentWeek, getCurrentMonth, addWeeks, addMonths, addDaysISO, todayYMD } from "./date";
import SaveBar from "./components/SaveBar";
import StaffSummary from "./components/StaffSummary";
import GroupAttendanceWidget from "./components/GroupAttendanceWidget";
// NEW: Central status label mapping
const STATUS_LABEL = {
    approved: 'Godkänd',
    pending: 'Väntar',
    rejected: 'Ej godkänt/komplettera'
};
// NEW: Debounce helper for note saving
function debounceNote(fn, ms = 500) {
    let timeoutId;
    return (noteValue) => {
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => fn(noteValue), ms);
    };
}
// NEW: Period-based data persistence helpers with proper isolation
const PERIOD_DATA_PREFIX = 'us:';
function getPeriodKey(clientId, periodType, periodId) {
    return `${PERIOD_DATA_PREFIX}${clientId}:${periodType}:${periodId}`;
}
function savePeriodData(clientId, periodType, periodId, data) {
    try {
        const key = getPeriodKey(clientId, periodType, periodId);
        localStorage.setItem(key, JSON.stringify(data));
    }
    catch (error) {
        console.warn(`Failed to save ${periodType} data for ${clientId}:${periodId}:`, error);
    }
}
function loadPeriodData(clientId, periodType, periodId, defaultData) {
    try {
        const key = getPeriodKey(clientId, periodType, periodId);
        const stored = localStorage.getItem(key);
        if (stored) {
            const parsed = JSON.parse(stored);
            return { ...defaultData, ...parsed };
        }
    }
    catch (error) {
        console.warn(`Failed to load ${periodType} data for ${clientId}:${periodId}:`, error);
    }
    return defaultData;
}
// NEW: Cleanup orphaned period data for clients that no longer exist (but preserve archived clients' history and us:history)
function cleanupClientLocalStorage(allClientIds) {
    try {
        const keysToRemove = [];
        // Scan all localStorage keys for period data
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(PERIOD_DATA_PREFIX)) {
                // Parse key: us:clientId:periodType:periodId
                const parts = key.split(':');
                if (parts.length >= 2 && parts[1]) {
                    const clientId = parts[1];
                    // Only remove if client doesn't exist at all (including archived ones)
                    if (!allClientIds.has(clientId)) {
                        keysToRemove.push(key);
                    }
                }
            }
        }
        // Remove orphaned keys (but NEVER touch us:history)
        keysToRemove.forEach(key => {
            if (key !== HISTORY_KEY) { // Extra safety check
                localStorage.removeItem(key);
            }
        });
        if (keysToRemove.length > 0) {
            console.log(`Cleaned up ${keysToRemove.length} orphaned period data entries (preserved history)`);
        }
    }
    catch (error) {
        console.warn('Failed to cleanup orphaned period data:', error);
    }
}
// NEW: Get all client IDs from state (including archived ones to preserve history)
function getAllClientIds(state) {
    const clientIds = new Set();
    state.staff.forEach(staff => {
        staff.clients.forEach(client => {
            clientIds.add(client.id);
        });
    });
    return clientIds;
}
// NEW: History management functions
const HISTORY_KEY = 'us:history';
function loadHistory() {
    try {
        const stored = localStorage.getItem(HISTORY_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    }
    catch (error) {
        console.warn('Failed to load history:', error);
    }
    return [];
}
function saveHistory(history) {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }
    catch (error) {
        console.warn('Failed to save history:', error);
    }
}
function upsertHistory(entry) {
    const history = loadHistory();
    const now = new Date().toISOString();
    // Create unique key for idempotency (commented out as not used in current implementation)
    // const key = `${entry.periodType}:${entry.periodId}:${entry.staffId}:${entry.clientId}:${entry.metric}`;
    // Find existing entry
    const existingIndex = history.findIndex(h => h.periodType === entry.periodType &&
        h.periodId === entry.periodId &&
        h.staffId === entry.staffId &&
        h.clientId === entry.clientId &&
        h.metric === entry.metric);
    const newEntry = {
        id: existingIndex >= 0 ? history[existingIndex].id : crypto.randomUUID(),
        ...entry,
        ts: now
    };
    if (existingIndex >= 0) {
        // Update existing entry
        history[existingIndex] = newEntry;
    }
    else {
        // Add new entry
        history.push(newEntry);
    }
    saveHistory(history);
}
// Helper functions for future use (currently not used but available for extensions)
// function getHistoryForPeriod(periodType: 'week' | 'month', periodId: string): HistoryEntry[] {
//   const history = loadHistory();
//   return history.filter(h => h.periodType === periodType && h.periodId === periodId);
// }
// function getHistoryForClient(clientId: string): HistoryEntry[] {
//   const history = loadHistory();
//   return history.filter(h => h.clientId === clientId);
// }
// function getHistoryForStaff(staffId: string): HistoryEntry[] {
//   const history = loadHistory();
//   return history.filter(h => h.staffId === staffId);
// }
// NEW: Retention and export functions
function retentionSweep(cutoffDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);
    const cutoffISO = cutoffDate.toISOString();
    const toRemove = [];
    // Scan all staff and clients for old archived/deleted items
    const currentState = loadState();
    const allStaff = currentState?.staff || [];
    allStaff.forEach((staff) => {
        staff.clients.forEach((client) => {
            // Check client-level deletion/archiving
            if (client.archivedAt && client.archivedAt < cutoffISO) {
                toRemove.push({
                    type: 'client',
                    id: client.id,
                    staffId: staff.id,
                    clientId: client.id,
                    data: client,
                    deletedAt: client.archivedAt
                });
            }
            else if (client.deletedAt && client.deletedAt < cutoffISO) {
                toRemove.push({
                    type: 'client',
                    id: client.id,
                    staffId: staff.id,
                    clientId: client.id,
                    data: client,
                    deletedAt: client.deletedAt
                });
            }
            else {
                // Check individual items within active clients
                // GFP Plans
                client.plans.forEach((plan) => {
                    if (plan.deletedAt && plan.deletedAt < cutoffISO) {
                        toRemove.push({
                            type: 'plan',
                            id: plan.id,
                            staffId: staff.id,
                            clientId: client.id,
                            data: plan,
                            deletedAt: plan.deletedAt
                        });
                    }
                });
                // Weekly Docs
                Object.values(client.weeklyDocs).forEach((doc) => {
                    if (doc.deletedAt && doc.deletedAt < cutoffISO) {
                        toRemove.push({
                            type: 'weeklyDoc',
                            id: doc.weekId,
                            staffId: staff.id,
                            clientId: client.id,
                            data: doc,
                            deletedAt: doc.deletedAt
                        });
                    }
                });
                // Monthly Reports
                Object.values(client.monthlyReports).forEach((report) => {
                    if (report.deletedAt && report.deletedAt < cutoffISO) {
                        toRemove.push({
                            type: 'monthlyReport',
                            id: report.monthId,
                            staffId: staff.id,
                            clientId: client.id,
                            data: report,
                            deletedAt: report.deletedAt
                        });
                    }
                });
                // Visma Weeks
                Object.values(client.visma).forEach((visma) => {
                    if (visma.deletedAt && visma.deletedAt < cutoffISO) {
                        toRemove.push({
                            type: 'vismaWeek',
                            id: visma.weekId,
                            staffId: staff.id,
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
function exportToJSON(data, filename) {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
function exportToCSV(data, filename) {
    if (data.length === 0)
        return;
    const firstRow = data[0];
    if (!firstRow)
        return;
    const headers = Object.keys(firstRow);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => {
            const value = row[header];
            // Escape CSV values
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
// NEW: Helper functions for counting affected items
function countClientData(client) {
    return {
        plans: client.plans.length,
        weeks: Object.keys(client.weeklyDocs).length,
        months: Object.keys(client.monthlyReports).length
    };
}
function countStaffData(staff) {
    let totalPlans = 0;
    let totalWeeks = 0;
    let totalMonths = 0;
    staff.clients.forEach(client => {
        const counts = countClientData(client);
        totalPlans += counts.plans;
        totalWeeks += counts.weeks;
        totalMonths += counts.months;
    });
    return {
        clients: staff.clients.length,
        totalPlans,
        totalWeeks,
        totalMonths
    };
}
function ConfirmDialog({ open, title, description, impactSummary, onConfirm, onCancel }) {
    const confirmButtonRef = useRef(null);
    // Autofokus på "Ta bort"-knappen när dialog öppnas
    useEffect(() => {
        if (open && confirmButtonRef.current) {
            confirmButtonRef.current.focus();
        }
    }, [open]);
    // Keyboard handling
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            onCancel();
        }
        else if (e.key === 'Enter') {
            onConfirm();
        }
    };
    if (!open)
        return null;
    return (_jsx("div", { style: {
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
        }, onKeyDown: handleKeyDown, tabIndex: -1, children: _jsxs("div", { style: {
                background: '#ffffff',
                borderRadius: 12,
                padding: 24,
                maxWidth: 450,
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                border: '1px solid rgba(0, 0, 0, 0.1)'
            }, role: "dialog", "aria-modal": "true", "aria-labelledby": "confirm-dialog-title", "aria-describedby": "confirm-dialog-description", children: [_jsx("h3", { id: "confirm-dialog-title", style: {
                        fontSize: 18,
                        fontWeight: 700,
                        color: '#111827',
                        margin: '0 0 12px 0',
                        lineHeight: 1.4
                    }, children: title }), _jsx("p", { id: "confirm-dialog-description", style: {
                        fontSize: 14,
                        color: '#374151',
                        margin: '0 0 16px 0',
                        lineHeight: 1.5
                    }, children: description }), impactSummary && (_jsxs("div", { style: {
                        background: '#fef3c7',
                        border: '1px solid #f59e0b',
                        borderRadius: 8,
                        padding: 12,
                        margin: '0 0 24px 0'
                    }, children: [_jsx("div", { style: {
                                fontSize: 13,
                                fontWeight: 600,
                                color: '#92400e',
                                marginBottom: 4
                            }, children: "Detta p\u00E5verkar:" }), _jsx("div", { style: {
                                fontSize: 14,
                                color: '#92400e',
                                lineHeight: 1.4
                            }, children: impactSummary })] })), _jsxs("div", { style: {
                        display: 'flex',
                        gap: 12,
                        justifyContent: 'flex-end'
                    }, children: [_jsx("button", { onClick: onCancel, style: {
                                background: '#f8fafc',
                                color: '#374151',
                                border: '1px solid #e5e7eb',
                                borderRadius: 8,
                                padding: '8px 16px',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }, onMouseOver: (e) => {
                                e.currentTarget.style.background = '#e2e8f0';
                                e.currentTarget.style.borderColor = '#cbd5e1';
                            }, onMouseOut: (e) => {
                                e.currentTarget.style.background = '#f8fafc';
                                e.currentTarget.style.borderColor = '#e5e7eb';
                            }, children: "Avbryt" }), _jsx("button", { ref: confirmButtonRef, onClick: onConfirm, style: {
                                background: '#ff3b30',
                                color: '#ffffff',
                                border: '1px solid #ff3b30',
                                borderRadius: 8,
                                padding: '8px 16px',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }, onMouseOver: (e) => {
                                e.currentTarget.style.background = '#e53e3e';
                                e.currentTarget.style.borderColor = '#e53e3e';
                            }, onMouseOut: (e) => {
                                e.currentTarget.style.background = '#ff3b30';
                                e.currentTarget.style.borderColor = '#ff3b30';
                            }, children: "Ta bort" })] })] }) }));
}
/* ---------- GFP Plan Helper Functions ---------- */
function nextGfpTitle(plans) {
    return `GFP ${plans.length + 1}`;
}
function latestPlan(plans) {
    if (!plans || plans.length === 0)
        return undefined;
    // Filter out soft-deleted plans and return the first (newest) active plan
    const activePlans = plans.filter(p => !p.deletedAt);
    return activePlans[0]; // Nyaste först
}
function StatusPill({ status, size = 'small' }) {
    const colors = {
        approved: '#16a34a',
        pending: '#ff9500',
        rejected: '#ff3b30'
    };
    // UPDATED: Use central STATUS_LABEL mapping instead of local labels
    const pillSize = size === 'small' ? { padding: '2px 8px', fontSize: '11px' } : { padding: '4px 12px', fontSize: '12px' };
    return (_jsx("span", { style: {
            ...pillSize,
            background: colors[status],
            color: '#ffffff',
            borderRadius: '12px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            display: 'inline-block',
            whiteSpace: 'nowrap'
        }, children: STATUS_LABEL[status] }));
}
function Card({ title, status, headerActions, children }) {
    return (_jsxs("div", { style: {
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 14,
            padding: 12,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            height: 'fit-content'
        }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                    flexWrap: 'wrap',
                    gap: 8
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, flex: 1 }, children: [_jsx("div", { style: { fontWeight: 800, fontSize: 14 }, children: title }), status && _jsx(StatusPill, { status: status })] }), headerActions && (_jsx("div", { style: { display: 'flex', gap: 6, alignItems: 'center' }, children: headerActions }))] }), children] }));
}
function Accordion({ sections }) {
    const [openSection, setOpenSection] = useState(sections[0]?.id || null);
    return (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: sections.map((section) => {
            const isOpen = openSection === section.id;
            return (_jsxs("div", { style: {
                    background: '#fff',
                    border: '1px solid rgba(0,0,0,0.12)',
                    borderRadius: 14,
                    overflow: 'hidden',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }, children: [_jsxs("button", { onClick: () => setOpenSection(isOpen ? null : section.id), style: {
                            width: '100%',
                            padding: '12px 16px',
                            background: isOpen ? '#f8fafc' : '#fff',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 800,
                            color: '#111111',
                            transition: 'background 0.15s ease'
                        }, "aria-expanded": isOpen, "aria-controls": `accordion-content-${section.id}`, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("span", { children: section.title }), section.status && _jsx(StatusPill, { status: section.status })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [section.headerActions, _jsx("svg", { width: 16, height: 16, viewBox: "0 0 24 24", style: {
                                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                            transition: 'transform 0.2s ease'
                                        }, "aria-hidden": "true", children: _jsx("path", { d: "M7 10l5 5 5-5", stroke: "#6b7280", strokeWidth: "2", fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }) })] })] }), isOpen && (_jsx("div", { id: `accordion-content-${section.id}`, style: { padding: '0 16px 16px 16px' }, children: section.children }))] }, section.id));
        }) }));
}
function PeriodPicker({ type, value, onChange }) {
    const goBack = () => {
        if (type === 'week') {
            onChange(addWeeks(value, -1));
        }
        else {
            onChange(addMonths(value, -1));
        }
    };
    const goForward = () => {
        if (type === 'week') {
            onChange(addWeeks(value, 1));
        }
        else {
            onChange(addMonths(value, 1));
        }
    };
    const goToCurrent = () => {
        if (type === 'week') {
            onChange(getCurrentWeek());
        }
        else {
            onChange(getCurrentMonth());
        }
    };
    const inputWidth = type === 'week' ? 92 : 92;
    const placeholder = type === 'week' ? 'YYYY-WXX' : 'YYYY-MM';
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 4 }, children: [_jsx("button", { onClick: goBack, style: {
                    background: '#f8fafc',
                    border: '1px solid rgba(0,0,0,0.12)',
                    borderRadius: 6,
                    padding: '6px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 28,
                    height: 28,
                    fontSize: 14,
                    color: '#374151',
                    transition: 'all 0.15s ease'
                }, onMouseOver: (e) => {
                    e.currentTarget.style.background = '#e2e8f0';
                    e.currentTarget.style.borderColor = '#007aff';
                }, onMouseOut: (e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)';
                }, "aria-label": `Föregående ${type === 'week' ? 'vecka' : 'månad'}`, children: "\u25C0" }), _jsx("input", { type: "text", value: value, onChange: (e) => onChange(e.target.value), placeholder: placeholder, style: {
                    background: '#ffffff',
                    color: '#111111',
                    border: '1px solid rgba(0,0,0,0.12)',
                    borderRadius: 6,
                    padding: '4px 8px',
                    outline: 'none',
                    boxShadow: '0 1px 1px rgba(0,0,0,0.02)',
                    width: inputWidth,
                    textAlign: 'center',
                    fontSize: 12,
                    fontWeight: 600
                }, "aria-label": `${type === 'week' ? 'Vecka' : 'Månad'} input` }), _jsx("button", { onClick: goForward, style: {
                    background: '#f8fafc',
                    border: '1px solid rgba(0,0,0,0.12)',
                    borderRadius: 6,
                    padding: '6px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 28,
                    height: 28,
                    fontSize: 14,
                    color: '#374151',
                    transition: 'all 0.15s ease'
                }, onMouseOver: (e) => {
                    e.currentTarget.style.background = '#e2e8f0';
                    e.currentTarget.style.borderColor = '#007aff';
                }, onMouseOut: (e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)';
                }, "aria-label": `Nästa ${type === 'week' ? 'vecka' : 'månad'}`, children: "\u25B6" }), _jsx("button", { onClick: goToCurrent, style: {
                    background: '#007aff',
                    color: '#ffffff',
                    border: '1px solid #007aff',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    marginLeft: 4
                }, onMouseOver: (e) => {
                    e.currentTarget.style.background = '#0051d5';
                    e.currentTarget.style.borderColor = '#0051d5';
                }, onMouseOut: (e) => {
                    e.currentTarget.style.background = '#007aff';
                    e.currentTarget.style.borderColor = '#007aff';
                }, children: "Nu" })] }));
}
function DayMatrix({ days, weekId, onChange, type }) {
    // Dag-etiketter och ordning
    const dayLabels = type === 'weekly'
        ? ['må', 'ti', 'on', 'to', 'fr', 'lö', 'sö']
        : ['må', 'ti', 'on', 'to', 'fr']; // Visma bara vardagar
    const dayKeys = type === 'weekly'
        ? ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
        : ['mon', 'tue', 'wed', 'thu', 'fri'];
    // Beräkna verkliga datum för tooltips
    const getDateForDay = (dayIndex) => {
        try {
            // Parse ISO week: YYYY-Wxx
            const match = weekId.match(/^(\d{4})-W(\d{2})$/);
            if (!match)
                return '';
            const year = parseInt(match[1], 10);
            const week = parseInt(match[2], 10);
            // Skapa måndagen för den veckan
            const jan4 = new Date(year, 0, 4);
            const startOfYear = new Date(jan4.getTime() - (jan4.getDay() - 1) * 24 * 60 * 60 * 1000);
            const monday = new Date(startOfYear.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
            // Lägg till dagar för att få rätt dag
            const targetDate = new Date(monday.getTime() + dayIndex * 24 * 60 * 60 * 1000);
            return targetDate.toLocaleDateString('sv-SE');
        }
        catch {
            return '';
        }
    };
    const markWorkDays = () => {
        ['mon', 'tue', 'wed', 'thu', 'fri'].forEach(day => {
            if (days[day] !== undefined) {
                onChange(day, true);
            }
        });
    };
    const clearAll = () => {
        dayKeys.forEach(day => {
            if (days[day] !== undefined) {
                onChange(day, false);
            }
        });
    };
    // Kontrollera om några dagar är valda
    const hasSelectedDays = dayKeys.some(day => days[day] === true);
    return (_jsxs("div", { style: { marginBottom: 12 }, children: [_jsx("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: `repeat(${dayLabels.length}, 1fr)`,
                    gap: 4,
                    marginBottom: 8,
                    maxWidth: 280
                }, children: dayLabels.map((label, index) => {
                    const dayKey = dayKeys[index];
                    const isChecked = days[dayKey] || false;
                    const dateStr = getDateForDay(index);
                    const tooltip = `${label} ${dateStr} (${weekId})`;
                    return (_jsxs("label", { style: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 3,
                            cursor: 'pointer',
                            padding: 2
                        }, title: tooltip, children: [_jsx("div", { style: {
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: '#374151',
                                    lineHeight: 1
                                }, children: label }), _jsx("div", { style: {
                                    width: 32,
                                    height: 32,
                                    border: '2px solid #e5e7eb',
                                    borderRadius: 6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: isChecked ? '#007aff' : '#ffffff',
                                    borderColor: isChecked ? '#007aff' : '#e5e7eb',
                                    transition: 'all 0.15s ease',
                                    cursor: 'pointer'
                                }, children: _jsx("input", { type: "checkbox", checked: isChecked, onChange: (e) => onChange(dayKey, e.target.checked), style: {
                                        width: 16,
                                        height: 16,
                                        cursor: 'pointer',
                                        accentColor: '#007aff'
                                    }, "aria-label": tooltip }) })] }, dayKey));
                }) }), _jsxs("div", { style: {
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                    alignItems: 'center'
                }, children: [_jsx("button", { onClick: markWorkDays, style: {
                            background: '#f0f7ff',
                            color: '#007aff',
                            border: '1px solid #007aff',
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }, onMouseOver: (e) => {
                            e.currentTarget.style.background = '#007aff';
                            e.currentTarget.style.color = '#ffffff';
                        }, onMouseOut: (e) => {
                            e.currentTarget.style.background = '#f0f7ff';
                            e.currentTarget.style.color = '#007aff';
                        }, children: "Markera arbetsdagar" }), _jsx("button", { onClick: clearAll, style: {
                            background: '#f8fafc',
                            color: '#6b7280',
                            border: '1px solid #e5e7eb',
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }, onMouseOver: (e) => {
                            e.currentTarget.style.background = '#fee2e2';
                            e.currentTarget.style.color = '#dc2626';
                            e.currentTarget.style.borderColor = '#fecaca';
                        }, onMouseOut: (e) => {
                            e.currentTarget.style.background = '#f8fafc';
                            e.currentTarget.style.color = '#6b7280';
                            e.currentTarget.style.borderColor = '#e5e7eb';
                        }, children: "Rensa alla" })] }), !hasSelectedDays && (_jsx("div", { style: {
                    fontSize: 11,
                    color: '#9ca3af',
                    textAlign: 'center',
                    fontStyle: 'italic',
                    marginTop: 8,
                    padding: '4px 8px'
                }, children: type === 'weekly'
                    ? 'Ingen dokumentation vald denna vecka'
                    : 'Ingen tid registrerad denna vecka' }))] }));
}
const KPI_COLORS = {
    late: { accent: '#ff3b30', text: '#111827', bg: 'rgba(255,59,48,0.06)' },
    waiting: { accent: '#ff9500', text: '#111827', bg: 'rgba(255,149,0,0.06)' },
    info: { accent: '#007aff', text: '#111827', bg: 'rgba(0,122,255,0.06)' },
    success: { accent: '#16a34a', text: '#111827', bg: 'rgba(22,163,74,0.06)' },
    neutral: { accent: '#6b7280', text: '#111827', bg: 'rgba(107,114,128,0.06)' },
};
function KpiCard({ title, value, subtitle, variant = 'info', icon }) {
    const c = KPI_COLORS[variant];
    return (_jsxs("div", { className: `kpi-card kpi-${variant}`, style: {
            ...card(),
            display: 'flex',
            gap: ui.gap,
            alignItems: 'center',
            minHeight: 82
        }, children: [_jsx("div", { style: {
                    background: c.bg,
                    width: 36,
                    height: 36,
                    minWidth: 36,
                    borderRadius: 10,
                    display: 'grid',
                    placeItems: 'center'
                }, children: icon || (_jsx("svg", { width: 20, height: 20, viewBox: "0 0 24 24", "aria-hidden": "true", children: _jsx("circle", { cx: "12", cy: "12", r: "9", fill: c.accent, opacity: 0.9 }) })) }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { color: '#374151', fontSize: 12, fontWeight: 600 }, children: title }), _jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 8 }, children: [_jsx("div", { style: { color: c.text, fontSize: 26, fontWeight: 700 }, children: value }), subtitle && (_jsx("div", { style: { color: '#6b7280', fontSize: 12 }, children: subtitle }))] })] }), _jsx("div", { style: { width: 6, alignSelf: 'stretch', borderRadius: 6, background: c.accent, opacity: 0.18 } })] }));
}
// Typer importeras nu från types.ts
/* ---------- Utils ---------- */
function formatDateTime() {
    return new Date().toLocaleString("sv-SE");
}
function compareWeekId(a, b) {
    const [ya, wa] = a.split("-W");
    const [yb, wb] = b.split("-W");
    if (ya !== yb)
        return Number(ya) - Number(yb);
    return Number(wa) - Number(wb);
}
function compareMonthId(a, b) {
    return a.localeCompare(b);
}
/* ---------- Lagring ---------- */
function loadState() {
    try {
        const raw = getStoredData();
        if (raw) {
            const state = JSON.parse(raw);
            // MIGRATION: Konvertera gamla Plan-fält till plans[0]
            state.staff.forEach(staff => {
                staff.clients.forEach(client => {
                    if (!client.plans) {
                        client.plans = [];
                    }
                    // Om klient har gamla fält men ingen plans[0], skapa en
                    if (client.plan && (client.plan.carePlanDate || client.plan.hasGFP || client.plan.staffNotified || client.plan.notes)) {
                        const hasExistingPlan = client.plans.length > 0;
                        if (!hasExistingPlan) {
                            const legacyPlan = {
                                id: crypto.randomUUID(),
                                title: 'GFP 1',
                                date: client.plan.carePlanDate || todayYMD(),
                                dueDate: client.plan.carePlanDate ? addDaysISO(client.plan.carePlanDate, 21) : addDaysISO(todayYMD(), 21),
                                note: client.plan.notes || '',
                                staffInformed: client.plan.staffNotified || false,
                                done: client.plan.hasGFP || false,
                                status: client.plan.hasGFP ? 'approved' : 'pending'
                            };
                            client.plans.unshift(legacyPlan); // Lägg först (nyaste)
                        }
                    }
                });
            });
            return state;
        }
    }
    catch (error) {
        console.warn("Failed to load state:", error);
    }
    return undefined;
}
// SaveBar hanterar nu sparning automatiskt med debounce
/* ---------- Init-data ---------- */
function newClient(name) {
    return {
        id: crypto.randomUUID(),
        name,
        plan: { carePlanDate: undefined, hasGFP: false, staffNotified: false, notes: "" }, // LEGACY
        plans: [], // NEW - flera vårdplaner
        weeklyDocs: {},
        monthlyReports: {},
        visma: {},
        createdAt: todayYMD(),
    };
}
function initialState() {
    return {
        staff: [
            { id: crypto.randomUUID(), name: "Anna", clients: [] },
            { id: crypto.randomUUID(), name: "Johan", clients: [] },
        ],
        selectedStaffId: undefined,
        selectedClientId: undefined,
        lastBackup: formatDateTime(),
        version: "3.0",
    };
}
/* ---------- Export/Import ---------- */
function exportToFile(state) {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ungdomsstod_export_${todayYMD()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
function exportToClipboard(state) {
    const data = btoa(JSON.stringify(state));
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(data).then(() => alert("Data kopierat! Dela med kollega via email/chat."), () => fallback());
    }
    else {
        fallback();
    }
    function fallback() {
        try {
            const ta = document.createElement("textarea");
            ta.value = data;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            alert("Data kopierat (fallback).");
        }
        catch {
            alert("Kopiering misslyckades – markera och kopiera manuellt.");
        }
    }
}
/* ---------- UI tokens & helpers ---------- */
// NEW: Enhanced UI tokens for proper contrast
const ui = {
    gap: 12,
    radius: 10,
    pad: 12,
    border: '#E5E7EB',
    bg: '#FFFFFF',
    bgAlt: '#F9FAFB',
    text: '#111827',
    textMute: '#6B7280',
    navHoverBg: '#EEF2FF',
    navActiveBg: '#E6F0FF',
    navActiveText: '#0A2540',
    blue: '#007aff',
    orange: '#ff9500',
    red: '#ff3b30',
    green: '#16a34a',
    cardBg: '#FFFFFF',
    sidebarActive: '#e9f2ff'
};
// Legacy C object för bakåtkompatibilitet under migrering
const C = {
    blue: ui.blue,
    orange: ui.orange,
    red: ui.red,
    green: ui.green,
    white: ui.bg,
    border: ui.border,
    text: ui.text,
    textLight: ui.textMute,
    sidebarBg: ui.bg,
    sidebarActive: ui.sidebarActive
};
// Style helpers
function card() {
    return {
        background: ui.bg,
        border: `1px solid ${ui.border}`,
        borderRadius: ui.radius,
        padding: ui.pad,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
    };
}
function row(gap = ui.gap) {
    return {
        display: 'flex',
        alignItems: 'center',
        gap
    };
}
function col(gap = ui.gap) {
    return {
        display: 'flex',
        flexDirection: 'column',
        gap
    };
}
function pill(status) {
    const colors = {
        approved: { bg: 'rgba(22,163,74,0.1)', text: ui.green, border: ui.green },
        pending: { bg: 'rgba(255,149,0,0.1)', text: ui.orange, border: ui.orange },
        rejected: { bg: 'rgba(255,59,48,0.1)', text: ui.red, border: ui.red },
        late: { bg: 'rgba(255,59,48,0.1)', text: ui.red, border: ui.red },
        info: { bg: 'rgba(0,122,255,0.1)', text: ui.blue, border: ui.blue }
    };
    const color = colors[status];
    return {
        background: color.bg,
        color: color.text,
        border: `1px solid ${color.border}`,
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        display: 'inline-block'
    };
}
// ★ Base controls (förhindrar svarta fält i dark mode/Safari)
const inputBase = {
    background: '#ffffff',
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '8px 10px',
    outline: 'none',
    boxShadow: '0 1px 1px rgba(0,0,0,0.02)'
};
const inputSmall = {
    ...inputBase,
    borderRadius: 6,
    padding: '4px 8px'
};
const selectBase = {
    ...inputSmall,
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\'><path d=\'M4 6l4 4 4-4\' stroke=\'%236b7280\' stroke-width=\'2\' fill=\'none\' stroke-linecap=\'round\'/></svg>")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    paddingRight: 28
};
const textareaBase = {
    ...inputBase,
    minHeight: 80,
    resize: 'vertical'
};
// NEW: Helper functions for consistent contrast styling
const navItemStyle = (active) => ({
    padding: '10px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    color: active ? ui.navActiveText : ui.text,
    background: active ? ui.navActiveBg : 'transparent',
    fontWeight: active ? 600 : 500,
    borderLeft: active ? `3px solid ${ui.blue}` : '3px solid transparent',
    border: 'none',
    textAlign: 'left',
    width: '100%',
    fontSize: 15,
    letterSpacing: 0.2,
    transition: 'all 0.15s ease'
});
const listItemStyle = (selected) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    background: ui.cardBg,
    border: `1px solid ${ui.border}`,
    borderRadius: 10,
    padding: 10,
    color: ui.text,
    ...(selected ? { background: ui.navActiveBg, borderColor: ui.blue } : {})
});
const nameStyle = { fontWeight: 600, color: ui.text };
const metaStyle = { fontSize: 12, color: ui.textMute };
const app = {
    display: "flex",
    height: "100vh",
    minWidth: 280,
    background: "#f5f7fb",
    fontFamily: "system-ui, -apple-system, sans-serif"
};
const sidebar = {
    width: 280,
    minWidth: 240,
    background: C.sidebarBg,
    color: C.text, // 🔥 säkerställ mörk text
    borderRight: `1px solid ${C.border}`,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12
};
// REMOVED: Legacy navItem function replaced by navItemStyle with better contrast
const main = {
    flex: 1,
    padding: 16,
    paddingBottom: 80, // Utrymme för SaveBar
    overflow: "auto"
};
const headerBar = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 14
};
const title = { fontSize: 20, fontWeight: 800 };
const gridTwo = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 12,
    marginBottom: 12
};
const gridThree = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 12
};
// Legacy card constant removed - use card() helper instead
const cardHeader = {
    ...row(),
    justifyContent: "space-between",
    marginBottom: 8
};
const btn = {
    padding: "8px 14px",
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s"
};
const primaryBtn = {
    ...btn,
    background: C.blue,
    color: C.white,
    borderColor: C.blue
};
// smallBtn style removed - now using PeriodPicker component
/* ---------- Småkomponenter ---------- */
function Sparkline({ points }) {
    if (!points.length)
        return null;
    const W = 220;
    const H = 64;
    const max = Math.max(...points, 1);
    const min = Math.min(...points, 0);
    const range = Math.max(1, max - min);
    const step = W / Math.max(1, points.length - 1);
    const d = points
        .map((v, i) => {
        const x = i * step;
        const y = H - ((v - min) / range) * H;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
        .join(" ");
    return (_jsxs("svg", { width: W, height: H, style: { display: "block" }, children: [_jsx("path", { d: d, fill: "none", stroke: C.blue, strokeWidth: 2 }), _jsx("circle", { cx: W, cy: H - ((points[points.length - 1] - min) / range) * H, r: 3, fill: C.blue })] }));
}
function Donut({ pct }) {
    const size = 120;
    const stroke = 12;
    const R = (size - stroke) / 2;
    const CIRC = 2 * Math.PI * R;
    const off = CIRC * (1 - Math.max(0, Math.min(1, pct)));
    return (_jsx("svg", { width: size, height: size, children: _jsxs("g", { transform: `translate(${size / 2},${size / 2})`, children: [_jsx("circle", { r: R, fill: "none", stroke: "#eef2f7", strokeWidth: stroke }), _jsx("circle", { r: R, fill: "none", stroke: C.blue, strokeWidth: stroke, strokeDasharray: `${CIRC} ${CIRC}`, strokeDashoffset: off, transform: "rotate(-90)", strokeLinecap: "round" }), _jsxs("text", { y: "6", textAnchor: "middle", fontWeight: "800", fontSize: "20", children: [Math.round(pct * 100), "%"] })] }) }));
}
/* ---------- Views ---------- */
function Overview({ state, kpis }) {
    const overviewSamples = useMemo(() => {
        const weeklyByWeek = {};
        const currentWeekId = getCurrentWeek();
        // Get history for past weeks (including archived clients)
        const history = loadHistory();
        const pastWeeks = history
            .filter(h => h.periodType === 'week' && h.metric === 'weekDoc' && compareWeekId(h.periodId, currentWeekId) < 0)
            .filter(h => h.status === 'approved');
        // Aggregate from history
        pastWeeks.forEach(entry => {
            weeklyByWeek[entry.periodId] = (weeklyByWeek[entry.periodId] || 0) + 1;
        });
        // Add current week data from active clients only
        state.staff.forEach(st => {
            st.clients.forEach(c => {
                // Skip archived and soft-deleted clients for current week
                if (c.archivedAt || c.deletedAt)
                    return;
                Object.entries(c.weeklyDocs).forEach(([weekId, doc]) => {
                    if (doc.status === "approved" && compareWeekId(weekId, currentWeekId) >= 0) {
                        weeklyByWeek[weekId] = (weeklyByWeek[weekId] || 0) + 1;
                    }
                });
            });
        });
        const sortedWeeks = Object.keys(weeklyByWeek).sort(compareWeekId).slice(-8);
        const series = sortedWeeks.map(w => weeklyByWeek[w] || 0);
        // Calculate total and approved docs from history + current active clients
        const currentWeekForDocs = getCurrentWeek();
        const currentMonthForDocs = getCurrentMonth();
        // Get all history entries
        const allHistory = loadHistory();
        // Count total docs from history (past periods) + current active clients
        const totalDocs = allHistory.length + state.staff.reduce((sum, st) => sum +
            st.clients.reduce((cSum, c) => {
                // Skip archived and soft-deleted clients
                if (c.archivedAt || c.deletedAt)
                    return cSum;
                // Only count current period docs from active clients
                let count = 0;
                Object.entries(c.weeklyDocs).forEach(([weekId]) => {
                    if (compareWeekId(weekId, currentWeekForDocs) >= 0)
                        count++;
                });
                Object.entries(c.monthlyReports).forEach(([monthId]) => {
                    if (compareMonthId(monthId, currentMonthForDocs) >= 0)
                        count++;
                });
                return cSum + count;
            }, 0), 0);
        // Count approved docs from history + current active clients
        const approvedFromHistory = allHistory.filter(h => h.status === 'approved').length;
        const approvedFromCurrent = state.staff.reduce((sum, st) => sum +
            st.clients.reduce((cSum, c) => {
                // Skip archived and soft-deleted clients
                if (c.archivedAt || c.deletedAt)
                    return cSum;
                let count = 0;
                Object.values(c.weeklyDocs).forEach(doc => {
                    if (doc.status === "approved" && compareWeekId(doc.weekId, currentWeekForDocs) >= 0)
                        count++;
                });
                Object.values(c.monthlyReports).forEach(report => {
                    if (report.status === "approved" && compareMonthId(report.monthId, currentMonthForDocs) >= 0)
                        count++;
                });
                return cSum + count;
            }, 0), 0);
        const approvedDocs = approvedFromHistory + approvedFromCurrent;
        const quality = totalDocs ? approvedDocs / totalDocs : 0;
        return {
            series: series.length ? series : [0],
            quality
        };
    }, [state.staff]);
    // PRINT NEW: Print function for dashboard
    const handlePrint = () => {
        window.print();
    };
    return (_jsxs("div", { "data-print-scope": "personal-dashboard", children: [_jsxs("div", { style: headerBar, children: [_jsx("div", { style: title, children: "V\u00E5rdadmin \u2013 Dashboard" }), _jsx("button", { onClick: handlePrint, "data-print-keep": true, style: {
                            background: '#007aff',
                            color: '#ffffff',
                            border: '1px solid #007aff',
                            borderRadius: 8,
                            padding: '8px 16px',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }, onMouseOver: (e) => {
                            e.currentTarget.style.background = '#0051d5';
                            e.currentTarget.style.borderColor = '#0051d5';
                        }, onMouseOut: (e) => {
                            e.currentTarget.style.background = '#007aff';
                            e.currentTarget.style.borderColor = '#007aff';
                        }, children: "\uD83D\uDDA8\uFE0F Skriv ut" })] }), _jsxs("div", { style: gridTwo, children: [_jsxs("div", { style: card(), children: [_jsx("div", { style: cardHeader, children: _jsx("div", { style: { fontWeight: 800 }, children: "V\u00E5rdplaner - Status" }) }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 24, fontWeight: 900, color: C.green }, children: kpis.totalPlansActive }), _jsx("div", { style: { fontSize: 12, color: C.textLight }, children: "Aktiva med GFP" })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 24, fontWeight: 900, color: C.orange }, children: kpis.waitingPlan }), _jsx("div", { style: { fontSize: 12, color: C.textLight }, children: "Inv\u00E4ntar" })] })] })] }), _jsxs("div", { style: card(), children: [_jsx("div", { style: cardHeader, children: _jsx("div", { style: { fontWeight: 800 }, children: "Veckodokumentation" }) }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 13, color: C.textLight, marginBottom: 6 }, children: "Godk\u00E4nda per vecka" }), _jsx(Sparkline, { points: overviewSamples.series }), _jsx("div", { style: { fontSize: 11, color: C.textLight, marginTop: 4, fontStyle: 'italic' }, children: "Historik inkluderar arkiverade klienter" })] }), _jsx(Donut, { pct: overviewSamples.quality })] })] })] }), _jsxs("div", { style: gridThree, className: "kpi-grid", children: [_jsx(KpiCard, { title: "F\u00F6rsenad plan", value: kpis.delayedPlan ?? 0, subtitle: "GFP \u00F6ver 21 dagar", variant: "late" }), _jsx(KpiCard, { title: "F\u00F6rsenad dokumentation", value: kpis.delayedDocs ?? 0, subtitle: "Ej godk\u00E4nda veckor", variant: "waiting" }), _jsx(KpiCard, { title: "Denna vecka", value: kpis.completedThisWeek ?? 0, subtitle: "Godk\u00E4nda dokument", variant: "success" }), _jsx(KpiCard, { title: "Totalt klienter", value: kpis.totalClients ?? 0, subtitle: `${state.staff.length} personal`, variant: "neutral" }), _jsx(KpiCard, { title: "F\u00F6rsenad m\u00E5nadsrapport", value: kpis.delayedMonthly ?? 0, variant: "info" }), _jsx(KpiCard, { title: "F\u00F6rsenad Visma-tid", value: kpis.delayedVisma ?? 0, variant: "info" })] }), _jsx(GroupAttendanceWidget, {})] }));
}
function StaffView({ state, setState, selectedStaff, setView }) {
    const [newStaffName, setNewStaffName] = useState("");
    const [newClientName, setNewClientName] = useState("");
    const [staffQuery, setStaffQuery] = useState("");
    // NEW: Confirm dialog state
    const [confirmDialog, setConfirmDialog] = useState({
        open: false,
        title: '',
        description: '',
        impactSummary: undefined,
        onConfirm: () => { }
    });
    function addStaff(name) {
        if (!name.trim())
            return;
        setState((p) => ({
            ...p,
            staff: [...p.staff, { id: crypto.randomUUID(), name: name.trim(), clients: [] }]
        }));
    }
    function removeStaff(id) {
        setState((prev) => {
            const nextStaff = prev.staff.filter(s => s.id !== id);
            const nextSelectedStaffId = prev.selectedStaffId === id ? undefined : prev.selectedStaffId;
            return { ...prev, staff: nextStaff, selectedStaffId: nextSelectedStaffId, selectedClientId: undefined };
        });
    }
    // NEW: Show confirm dialog for staff deletion with impact summary
    function showDeleteStaffConfirm(staff) {
        const counts = countStaffData(staff);
        const impactSummary = counts.clients > 0
            ? `Tar bort ${counts.clients} klienter, ${counts.totalPlans} planer, ${counts.totalWeeks} veckor, ${counts.totalMonths} månadsrapporter`
            : 'Ingen data att ta bort';
        setConfirmDialog({
            open: true,
            title: "Ta bort personal",
            description: `Är du säker på att du vill ta bort ${staff.name}? Detta går inte att ångra.`,
            impactSummary,
            onConfirm: () => {
                removeStaff(staff.id);
                setConfirmDialog(prev => ({ ...prev, open: false }));
            }
        });
    }
    function addClientToSelected(name) {
        if (!selectedStaff || !name.trim())
            return;
        setState((prev) => ({
            ...prev,
            staff: prev.staff.map(s => s.id === selectedStaff.id ? { ...s, clients: [...s.clients, newClient(name.trim())] } : s)
        }));
    }
    function softDeleteClient(clientId) {
        if (!selectedStaff)
            return;
        setState((prev) => ({
            ...prev,
            staff: prev.staff.map(s => s.id === selectedStaff.id ? {
                ...s,
                clients: s.clients.map(c => c.id === clientId
                    ? { ...c, deletedAt: new Date().toISOString() }
                    : c)
            } : s),
            selectedClientId: prev.selectedClientId === clientId ? undefined : prev.selectedClientId
        }));
    }
    // Helper function for restoring soft-deleted clients (used in ArchiveView)
    // function restoreClient(clientId: string) {
    //   if (!selectedStaff) return;
    //   setState((prev: AppState) => ({
    //     ...prev,
    //     staff: prev.staff.map(s =>
    //       s.id === selectedStaff.id ? { 
    //         ...s, 
    //         clients: s.clients.map(c => 
    //           c.id === clientId 
    //             ? { ...c, deletedAt: undefined }
    //             : c
    //         )
    //       } : s
    //     )
    //   }));
    // }
    // NEW: Show confirm dialog for client soft deletion with impact summary
    function showDeleteClientConfirm(client) {
        const counts = countClientData(client);
        const impactSummary = counts.plans > 0 || counts.weeks > 0 || counts.months > 0
            ? `Mjuk-raderar ${counts.plans} planer, ${counts.weeks} veckor, ${counts.months} månadsrapporter (bevaras för historik)`
            : 'Ingen data att radera';
        setConfirmDialog({
            open: true,
            title: "Ta bort klient",
            description: `Är du säker på att du vill ta bort ${client.name}? Klienten försvinner från aktiva listor men all historik bevaras.`,
            impactSummary,
            onConfirm: () => {
                softDeleteClient(client.id);
                setConfirmDialog(prev => ({ ...prev, open: false }));
            }
        });
    }
    const filtered = state.staff.filter((s) => s.name.toLowerCase().includes(staffQuery.toLowerCase()));
    return (_jsxs("div", { children: [_jsx("div", { style: headerBar, children: _jsx("div", { style: title, children: "Personal & Klienter" }) }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "minmax(260px, 340px) 1fr", gap: 12 }, children: [_jsxs("div", { style: card(), children: [_jsx("div", { style: cardHeader, children: _jsxs("div", { style: { fontWeight: 800 }, children: ["Personal (", state.staff.length, ")"] }) }), _jsx("input", { placeholder: "S\u00F6k personal\u2026", value: staffQuery, onChange: e => setStaffQuery(e.target.value), style: { ...inputBase, width: '100%', marginBottom: 8 } }), _jsxs("div", { style: { display: "flex", gap: 6, marginBottom: 8 }, children: [_jsx("input", { placeholder: "Namn p\u00E5 ny personal", value: newStaffName, onChange: e => setNewStaffName(e.target.value), style: { ...inputBase, flex: 1 } }), _jsx("button", { style: primaryBtn, onClick: () => { addStaff(newStaffName); setNewStaffName(""); }, children: "L\u00E4gg till" })] }), _jsx("div", { style: { ...col(6), maxHeight: 400, overflow: "auto" }, children: filtered.map((s) => (_jsxs("div", { style: listItemStyle(state.selectedStaffId === s.id), onMouseEnter: (e) => {
                                        if (state.selectedStaffId !== s.id) {
                                            e.currentTarget.style.background = ui.navHoverBg;
                                        }
                                    }, onMouseLeave: (e) => {
                                        if (state.selectedStaffId !== s.id) {
                                            e.currentTarget.style.background = ui.cardBg;
                                        }
                                    }, children: [_jsxs("button", { style: {
                                                flex: 1,
                                                textAlign: "left",
                                                border: "none",
                                                background: "transparent",
                                                padding: 0,
                                                cursor: 'pointer',
                                                color: ui.text
                                            }, onClick: () => setState((prev) => ({ ...prev, selectedStaffId: s.id, selectedClientId: undefined })), onFocus: (e) => {
                                                e.currentTarget.style.outline = `2px solid ${ui.blue}`;
                                                e.currentTarget.style.outlineOffset = '2px';
                                            }, onBlur: (e) => {
                                                e.currentTarget.style.outline = 'none';
                                            }, children: [_jsx("div", { style: nameStyle, children: s.name }), _jsxs("div", { style: metaStyle, children: [s.clients.filter(c => !c.archivedAt && !c.deletedAt).length, " klienter"] })] }), _jsx("button", { style: { ...primaryBtn, fontSize: 12, padding: "4px 8px" }, onClick: () => {
                                                setState((prev) => ({ ...prev, selectedStaffId: s.id, selectedClientId: undefined }));
                                                setView("staffDetail");
                                            }, children: "Dashboard" }), _jsx("button", { style: { ...btn, fontSize: 12, padding: "4px 8px" }, onClick: () => showDeleteStaffConfirm(s), children: "Ta bort" })] }, s.id))) })] }), _jsxs("div", { style: card(), children: [_jsx("div", { style: cardHeader, children: _jsxs("div", { style: { fontWeight: 800 }, children: ["Klienter ", selectedStaff ? `– ${selectedStaff.name}` : ""] }) }), !selectedStaff ? (_jsx("div", { style: { color: C.textLight }, children: "V\u00E4lj en personal till v\u00E4nster." })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: "flex", gap: 6, marginBottom: 8 }, children: [_jsx("input", { placeholder: "Klient initialer (t.ex. AB)", value: newClientName, onChange: e => setNewClientName(e.target.value), style: { ...inputBase, flex: 1 } }), _jsx("button", { style: primaryBtn, onClick: () => { addClientToSelected(newClientName); setNewClientName(""); }, children: "L\u00E4gg till" })] }), _jsx("div", { style: { ...col(6), maxHeight: 450, overflow: "auto" }, children: selectedStaff.clients.filter(c => !c.archivedAt && !c.deletedAt).map((c) => (_jsxs("div", { style: {
                                                ...listItemStyle(state.selectedClientId === c.id),
                                                display: "grid",
                                                gridTemplateColumns: "1fr auto auto",
                                                gap: 6,
                                                alignItems: "center"
                                            }, onMouseEnter: (e) => {
                                                if (state.selectedClientId !== c.id) {
                                                    e.currentTarget.style.background = ui.navHoverBg;
                                                }
                                            }, onMouseLeave: (e) => {
                                                if (state.selectedClientId !== c.id) {
                                                    e.currentTarget.style.background = ui.cardBg;
                                                }
                                            }, children: [_jsxs("button", { style: {
                                                        textAlign: "left",
                                                        border: "none",
                                                        background: "transparent",
                                                        padding: 0,
                                                        cursor: 'pointer',
                                                        color: ui.text
                                                    }, onClick: () => setState((prev) => ({ ...prev, selectedClientId: c.id })), onFocus: (e) => {
                                                        e.currentTarget.style.outline = `2px solid ${ui.blue}`;
                                                        e.currentTarget.style.outlineOffset = '2px';
                                                    }, onBlur: (e) => {
                                                        e.currentTarget.style.outline = 'none';
                                                    }, children: [_jsx("div", { style: nameStyle, children: c.name }), _jsxs("div", { style: metaStyle, children: ["Planer: ", c.plans.length, " \u2022 Senaste: ", latestPlan(c.plans)?.title || "Ingen"] })] }), _jsx("button", { style: primaryBtn, onClick: () => { setState((prev) => ({ ...prev, selectedClientId: c.id })); setView("client"); }, children: "\u00D6ppna" }), _jsx("button", { style: { ...btn, fontSize: 12 }, onClick: () => showDeleteClientConfirm(c), children: "Ta bort" })] }, c.id))) })] }))] })] }), _jsx(ConfirmDialog, { open: confirmDialog.open, title: confirmDialog.title, description: confirmDialog.description, impactSummary: confirmDialog.impactSummary, onConfirm: confirmDialog.onConfirm, onCancel: () => setConfirmDialog(prev => ({ ...prev, open: false })) })] }));
}
/* ---------- ClientWork Section Content Components ---------- */
// Veckodokumentation innehåll
function WeeklyDocContent({ weeklyDoc, saveWeeklyDoc, weekIdInput, clientId }) {
    const [note, setNote] = useState(weeklyDoc.note || '');
    const [saveStatus, setSaveStatus] = useState('idle');
    const [lastSaved, setLastSaved] = useState('');
    // NEW: Debounced save with period-based storage
    const debouncedSave = useRef(debounceNote((noteValue) => {
        const updatedDoc = { ...weeklyDoc, note: noteValue };
        savePeriodData(clientId, 'weekly', weekIdInput, updatedDoc);
        setSaveStatus('saved');
        setLastSaved(new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }));
    }, 500));
    // NEW: Load data when period changes (ensures isolation)
    useEffect(() => {
        const defaultDoc = {
            weekId: weekIdInput,
            days: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false },
            status: "pending",
            note: ''
        };
        const loadedDoc = loadPeriodData(clientId, 'weekly', weekIdInput, defaultDoc);
        setNote(loadedDoc.note || '');
        setSaveStatus('idle');
        setLastSaved('');
        // Update the parent component with loaded data
        if (JSON.stringify(loadedDoc) !== JSON.stringify(weeklyDoc)) {
            saveWeeklyDoc(weekIdInput, loadedDoc);
        }
    }, [weekIdInput, clientId, weeklyDoc, saveWeeklyDoc]); // NEW: Re-load when period or client changes
    const handleDayChange = (day, checked) => {
        const newDoc = {
            ...weeklyDoc,
            days: { ...weeklyDoc.days, [day]: checked },
            lastUpdated: new Date().toISOString()
        };
        saveWeeklyDoc(weekIdInput, newDoc);
        // NEW: Also save to period-based storage
        savePeriodData(clientId, 'weekly', weekIdInput, newDoc);
    };
    const handleNoteChange = (value) => {
        setNote(value);
        setSaveStatus('saving');
        // NEW: Update weeklyDoc object with new note
        const updatedDoc = { ...weeklyDoc, note: value };
        saveWeeklyDoc(weekIdInput, updatedDoc);
        debouncedSave.current(value);
    };
    const handleNoteBlur = () => {
        const updatedDoc = { ...weeklyDoc, note: note };
        savePeriodData(clientId, 'weekly', weekIdInput, updatedDoc);
        setSaveStatus('saved');
        setLastSaved(new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }));
    };
    return (_jsxs(_Fragment, { children: [_jsx(DayMatrix, { days: weeklyDoc.days, weekId: weekIdInput, onChange: handleDayChange, type: "weekly" }), _jsxs("div", { style: { ...row(8), flexWrap: "wrap" }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600 }, children: "Status:" }), _jsxs("select", { value: weeklyDoc.status, onChange: (e) => saveWeeklyDoc(weekIdInput, { ...weeklyDoc, status: e.target.value }), style: selectBase, "aria-label": "Veckodokumentation status", children: [_jsx("option", { value: "pending", children: STATUS_LABEL.pending }), _jsx("option", { value: "approved", children: STATUS_LABEL.approved }), _jsx("option", { value: "rejected", children: STATUS_LABEL.rejected })] })] }), _jsxs("div", { style: { marginTop: 12 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600 }, children: "Notis f\u00F6r veckan" }), _jsxs("div", { style: { fontSize: 11, color: ui.textMute }, children: [saveStatus === 'saving' && 'Sparar...', saveStatus === 'saved' && lastSaved && `Sparat ${lastSaved}`] })] }), _jsx("textarea", { value: note, onChange: (e) => handleNoteChange(e.target.value), onBlur: handleNoteBlur, placeholder: "Kort notis f\u00F6r veckan\u2026", style: {
                            ...textareaBase,
                            height: 64,
                            fontSize: 14,
                            borderRadius: 8,
                            border: '1px solid #E5E7EB',
                            background: '#ffffff',
                            color: '#111111'
                        }, "aria-label": "Veckodokumentation notis" })] })] }));
}
function WeeklyDocSection({ weeklyDoc, saveWeeklyDoc, weekIdInput, setWeekIdInput, clientId }) {
    const headerActions = (_jsx(PeriodPicker, { type: "week", value: weekIdInput, onChange: setWeekIdInput }));
    return (_jsx(Card, { title: "Veckodokumentation", status: weeklyDoc.status, headerActions: headerActions, children: _jsx(WeeklyDocContent, { weeklyDoc: weeklyDoc, saveWeeklyDoc: saveWeeklyDoc, weekIdInput: weekIdInput, clientId: clientId }) }));
}
// Månadsrapport innehåll
function MonthlyReportContent({ monthlyReport, saveMonthlyReport, monthIdInput, clientId }) {
    const [note, setNote] = useState(monthlyReport.note || '');
    const [saveStatus, setSaveStatus] = useState('idle');
    const [lastSaved, setLastSaved] = useState('');
    // NEW: Debounced save with period-based storage
    const debouncedSave = useRef(debounceNote((noteValue) => {
        const updatedReport = { ...monthlyReport, note: noteValue };
        savePeriodData(clientId, 'monthly', monthIdInput, updatedReport);
        setSaveStatus('saved');
        setLastSaved(new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }));
    }, 500));
    // NEW: Load data when period changes (ensures isolation)
    useEffect(() => {
        const defaultReport = {
            monthId: monthIdInput,
            sent: false,
            status: "pending",
            note: ''
        };
        const loadedReport = loadPeriodData(clientId, 'monthly', monthIdInput, defaultReport);
        setNote(loadedReport.note || '');
        setSaveStatus('idle');
        setLastSaved('');
        // Update the parent component with loaded data
        if (JSON.stringify(loadedReport) !== JSON.stringify(monthlyReport)) {
            saveMonthlyReport(monthIdInput, loadedReport);
        }
    }, [monthIdInput, clientId, monthlyReport, saveMonthlyReport]); // NEW: Re-load when period or client changes
    const handleNoteChange = (value) => {
        setNote(value);
        setSaveStatus('saving');
        // NEW: Update monthlyReport object with new note
        const updatedReport = { ...monthlyReport, note: value };
        saveMonthlyReport(monthIdInput, updatedReport);
        debouncedSave.current(value);
    };
    const handleNoteBlur = () => {
        const updatedReport = { ...monthlyReport, note: note };
        savePeriodData(clientId, 'monthly', monthIdInput, updatedReport);
        setSaveStatus('saved');
        setLastSaved(new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }));
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { style: { ...row(12), flexWrap: "wrap" }, children: [_jsxs("label", { style: { ...row(8) }, children: [_jsx("input", { type: "checkbox", checked: monthlyReport.sent, onChange: (e) => saveMonthlyReport(monthIdInput, { ...monthlyReport, sent: e.target.checked }) }), "Skickad"] }), _jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600 }, children: "Status:" }), _jsxs("select", { value: monthlyReport.status, onChange: (e) => saveMonthlyReport(monthIdInput, { ...monthlyReport, status: e.target.value }), style: selectBase, "aria-label": "M\u00E5nadsrapport status", children: [_jsx("option", { value: "pending", children: STATUS_LABEL.pending }), _jsx("option", { value: "approved", children: STATUS_LABEL.approved }), _jsx("option", { value: "rejected", children: STATUS_LABEL.rejected })] })] })] }), _jsxs("div", { style: { marginTop: 12 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600 }, children: "Notis f\u00F6r m\u00E5naden" }), _jsxs("div", { style: { fontSize: 11, color: ui.textMute }, children: [saveStatus === 'saving' && 'Sparar...', saveStatus === 'saved' && lastSaved && `Sparat ${lastSaved}`] })] }), _jsx("textarea", { value: note, onChange: (e) => handleNoteChange(e.target.value), onBlur: handleNoteBlur, placeholder: "Kort notis f\u00F6r m\u00E5naden\u2026", style: {
                            ...textareaBase,
                            height: 64,
                            fontSize: 14,
                            borderRadius: 8,
                            border: '1px solid #E5E7EB',
                            background: '#ffffff',
                            color: '#111111'
                        }, "aria-label": "M\u00E5nadsrapport notis" })] })] }));
}
function MonthlyReportSection({ monthlyReport, saveMonthlyReport, monthIdInput, setMonthIdInput, clientId }) {
    const headerActions = (_jsx(PeriodPicker, { type: "month", value: monthIdInput, onChange: setMonthIdInput }));
    return (_jsx(Card, { title: "M\u00E5nadsrapport", status: monthlyReport.status, headerActions: headerActions, children: _jsx(MonthlyReportContent, { monthlyReport: monthlyReport, saveMonthlyReport: saveMonthlyReport, monthIdInput: monthIdInput, clientId: clientId }) }));
}
// Visma innehåll
function VismaContent({ vismaWeek, saveVisma, weekIdInput }) {
    const handleDayChange = (day, checked) => {
        const newVisma = {
            ...vismaWeek,
            days: { ...vismaWeek.days, [day]: checked },
            lastUpdated: new Date().toISOString()
        };
        saveVisma(weekIdInput, newVisma);
    };
    return (_jsxs(_Fragment, { children: [_jsx(DayMatrix, { days: vismaWeek.days, weekId: weekIdInput, onChange: handleDayChange, type: "visma" }), _jsxs("div", { style: { ...row(8), flexWrap: "wrap" }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600 }, children: "Status:" }), _jsxs("select", { value: vismaWeek.status, onChange: (e) => saveVisma(weekIdInput, { ...vismaWeek, status: e.target.value }), style: selectBase, "aria-label": "Visma tid status", children: [_jsx("option", { value: "pending", children: STATUS_LABEL.pending }), _jsx("option", { value: "approved", children: STATUS_LABEL.approved }), _jsx("option", { value: "rejected", children: STATUS_LABEL.rejected })] })] })] }));
}
function VismaSection({ vismaWeek, saveVisma, weekIdInput, setWeekIdInput }) {
    const headerActions = (_jsx(PeriodPicker, { type: "week", value: weekIdInput, onChange: setWeekIdInput }));
    return (_jsx(Card, { title: "Visma Tid", status: vismaWeek.status, headerActions: headerActions, children: _jsx(VismaContent, { vismaWeek: vismaWeek, saveVisma: saveVisma, weekIdInput: weekIdInput }) }));
}
// Plan innehåll - Uppdaterad för flera GFP-planer
function PlanContent({ selectedClient, savePlan, addNewPlan, showDeletePlanConfirm }) {
    const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
    // Filter out soft-deleted plans
    const activePlans = selectedClient.plans.filter(p => !p.deletedAt);
    const currentPlan = activePlans[selectedPlanIndex];
    const saveCurrentPlan = (updates) => {
        if (!currentPlan)
            return;
        const updatedPlans = [...selectedClient.plans];
        updatedPlans[selectedPlanIndex] = { ...currentPlan, ...updates };
        // Uppdatera genom savePlan (som kommer att hantera state-uppdatering)
        savePlan({ plans: updatedPlans });
    };
    return (_jsxs("div", { children: [_jsxs("div", { style: { ...row(8), marginBottom: 16, flexWrap: "wrap" }, children: [activePlans.map((plan, index) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 4 }, children: [_jsx("button", { onClick: () => setSelectedPlanIndex(index), style: {
                                    background: selectedPlanIndex === index ? ui.blue : ui.bgAlt,
                                    color: selectedPlanIndex === index ? '#ffffff' : ui.text,
                                    border: `1px solid ${selectedPlanIndex === index ? ui.blue : ui.border}`,
                                    borderRadius: 8,
                                    padding: '6px 12px',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }, children: plan.title }), activePlans.length > 1 && (_jsx("button", { onClick: () => showDeletePlanConfirm(plan), style: {
                                    background: '#fee2e2',
                                    color: '#dc2626',
                                    border: '1px solid #fecaca',
                                    borderRadius: 6,
                                    padding: '4px 6px',
                                    fontSize: 10,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    minWidth: 20,
                                    height: 20,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }, onMouseOver: (e) => {
                                    e.currentTarget.style.background = '#fecaca';
                                    e.currentTarget.style.borderColor = '#fca5a5';
                                }, onMouseOut: (e) => {
                                    e.currentTarget.style.background = '#fee2e2';
                                    e.currentTarget.style.borderColor = '#fecaca';
                                }, title: `Ta bort ${plan.title}`, "aria-label": `Ta bort ${plan.title}`, children: "\u00D7" }))] }, plan.id))), _jsx("button", { onClick: addNewPlan, style: {
                            background: ui.green,
                            color: '#ffffff',
                            border: `1px solid ${ui.green}`,
                            borderRadius: 8,
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }, children: "+ Ny plan" })] }), currentPlan ? (_jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, alignItems: "start" }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 4 }, children: "Datum (v\u00E5rdplan)" }), _jsx("input", { type: "date", value: currentPlan.date, onChange: (e) => saveCurrentPlan({ date: e.target.value, dueDate: addDaysISO(e.target.value, 21) }), style: inputBase, "aria-label": "V\u00E5rdplan datum" })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 4 }, children: "F\u00F6rfallodatum" }), _jsx("div", { style: { ...pill(currentPlan.done ? 'approved' : (todayYMD() > currentPlan.dueDate ? 'rejected' : 'pending')), fontWeight: 700 }, children: currentPlan.dueDate }), todayYMD() > currentPlan.dueDate && !currentPlan.done && (_jsx("div", { style: { color: ui.red, fontSize: 11, fontWeight: 600, marginTop: 4 }, children: "(F\u00F6rsenad)" }))] }), _jsx("div", { children: _jsxs("label", { style: { ...row(8) }, children: [_jsx("input", { type: "checkbox", checked: currentPlan.staffInformed, onChange: (e) => saveCurrentPlan({ staffInformed: e.target.checked }) }), "Personal tillsagd"] }) }), _jsx("div", { children: _jsxs("label", { style: { ...row(8) }, children: [_jsx("input", { type: "checkbox", checked: currentPlan.done, onChange: (e) => saveCurrentPlan({ done: e.target.checked, status: e.target.checked ? 'approved' : 'pending' }) }), "GFP klar"] }) }), _jsxs("div", { style: { gridColumn: "1 / -1" }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 4 }, children: "Anteckning" }), _jsx("textarea", { value: currentPlan.note, onChange: (e) => saveCurrentPlan({ note: e.target.value }), placeholder: "Skriv anteckning\u2026", style: textareaBase })] })] })) : (_jsx("div", { style: { textAlign: 'center', color: ui.textMute, padding: 20 }, children: "Inga planer \u00E4n. Klicka \"Ny plan\" f\u00F6r att skapa en." }))] }));
}
function ClientWorkFull({ selectedClient, savePlan, saveWeeklyDoc, saveMonthlyReport, saveVisma, weekIdInput, setWeekIdInput, monthIdInput, setMonthIdInput }) {
    const [isMobile, setIsMobile] = useState(false);
    // NEW: Confirm dialog state for plan deletion
    const [confirmDialog, setConfirmDialog] = useState({
        open: false,
        title: '',
        description: '',
        impactSummary: undefined,
        onConfirm: () => { }
    });
    // NEW: Show confirm dialog for plan soft deletion with impact summary
    function showDeletePlanConfirm(plan) {
        setConfirmDialog({
            open: true,
            title: "Ta bort plan",
            description: `Är du säker på att du vill ta bort ${plan.title}? Planen försvinner från aktiva listor men all historik bevaras.`,
            impactSummary: "Mjuk-raderar 1 plan",
            onConfirm: () => {
                if (!selectedClient)
                    return;
                const updatedPlans = selectedClient.plans.map(p => p.id === plan.id
                    ? { ...p, deletedAt: new Date().toISOString() }
                    : p);
                savePlan({ plans: updatedPlans });
                setConfirmDialog(prev => ({ ...prev, open: false }));
            }
        });
    }
    // Responsive check
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    if (!selectedClient) {
        return (_jsxs("div", { children: [_jsx("div", { style: headerBar, children: _jsx("div", { style: title, children: "Klient \u2013 Arbete" }) }), _jsx("div", { style: { ...card, color: C.textLight }, children: "V\u00E4lj en klient i Personal-vyn f\u00F6r att b\u00F6rja arbeta." })] }));
    }
    // NEW: Load period data with proper isolation
    const weeklyDoc = (() => {
        const defaultDoc = {
            weekId: weekIdInput,
            days: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false },
            status: "pending",
            note: ''
        };
        return loadPeriodData(selectedClient.id, 'weekly', weekIdInput, defaultDoc);
    })();
    const monthlyReport = (() => {
        const defaultReport = {
            monthId: monthIdInput,
            sent: false,
            status: "pending",
            note: ''
        };
        return loadPeriodData(selectedClient.id, 'monthly', monthIdInput, defaultReport);
    })();
    const vismaWeek = selectedClient.visma[weekIdInput] || {
        weekId: weekIdInput,
        days: { mon: false, tue: false, wed: false, thu: false, fri: false },
        status: "pending"
    };
    // Plan status beräkning - använd senaste planen
    const getPlanStatus = () => {
        const latest = latestPlan(selectedClient.plans);
        if (!latest)
            return "pending";
        if (!latest.done) {
            const today = todayYMD();
            if (today > latest.dueDate)
                return "rejected"; // Försenad
        }
        return latest.done ? "approved" : "pending";
    };
    const planStatus = getPlanStatus();
    if (isMobile) {
        // Mobile: Accordion layout
        const accordionSections = [
            {
                id: 'plan',
                title: 'Plan (GFP)',
                status: planStatus,
                children: _jsx(PlanContent, { selectedClient: selectedClient, savePlan: savePlan, addNewPlan: () => {
                        const newPlan = {
                            id: crypto.randomUUID(),
                            title: nextGfpTitle(selectedClient.plans),
                            date: todayYMD(),
                            dueDate: addDaysISO(todayYMD(), 21),
                            note: '',
                            staffInformed: false,
                            done: false,
                            status: 'pending'
                        };
                        const updatedPlans = [newPlan, ...selectedClient.plans];
                        savePlan({ plans: updatedPlans });
                    }, showDeletePlanConfirm: showDeletePlanConfirm })
            },
            {
                id: 'weekly',
                title: 'Veckodokumentation',
                status: weeklyDoc.status,
                headerActions: (_jsx("div", { onClick: (e) => e.stopPropagation(), children: _jsx(PeriodPicker, { type: "week", value: weekIdInput, onChange: setWeekIdInput }) })),
                children: _jsx(WeeklyDocContent, { weeklyDoc: weeklyDoc, saveWeeklyDoc: saveWeeklyDoc, weekIdInput: weekIdInput, clientId: selectedClient.id })
            },
            {
                id: 'monthly',
                title: 'Månadsrapport',
                status: monthlyReport.status,
                headerActions: (_jsx("div", { onClick: (e) => e.stopPropagation(), children: _jsx(PeriodPicker, { type: "month", value: monthIdInput, onChange: setMonthIdInput }) })),
                children: _jsx(MonthlyReportContent, { monthlyReport: monthlyReport, saveMonthlyReport: saveMonthlyReport, monthIdInput: monthIdInput, clientId: selectedClient.id })
            },
            {
                id: 'visma',
                title: 'Visma Tid',
                status: vismaWeek.status,
                headerActions: (_jsx("div", { onClick: (e) => e.stopPropagation(), children: _jsx(PeriodPicker, { type: "week", value: weekIdInput, onChange: setWeekIdInput }) })),
                children: _jsx(VismaContent, { vismaWeek: vismaWeek, saveVisma: saveVisma, weekIdInput: weekIdInput })
            }
        ];
        return (_jsxs("div", { children: [_jsxs("div", { style: headerBar, children: [_jsxs("div", { style: title, children: ["Klient: ", selectedClient.name] }), _jsxs("div", { style: { fontSize: 12, color: C.textLight }, children: ["V", getCurrentWeek(), " \u2022 ", getCurrentMonth()] })] }), _jsx(Accordion, { sections: accordionSections })] }));
    }
    // Desktop: Two-column card layout
    return (_jsxs("div", { children: [_jsxs("div", { style: headerBar, children: [_jsxs("div", { style: title, children: ["Klient: ", selectedClient.name] }), _jsxs("div", { style: { fontSize: 12, color: C.textLight }, children: ["Vecka: ", getCurrentWeek(), " \u2022 M\u00E5nad: ", getCurrentMonth()] })] }), _jsxs("div", { style: {
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))",
                    gap: 16,
                    alignItems: "start"
                }, children: [_jsx(Card, { title: "Plan (GFP)", status: planStatus, children: _jsx(PlanContent, { selectedClient: selectedClient, savePlan: savePlan, addNewPlan: () => {
                                const newPlan = {
                                    id: crypto.randomUUID(),
                                    title: nextGfpTitle(selectedClient.plans),
                                    date: todayYMD(),
                                    dueDate: addDaysISO(todayYMD(), 21),
                                    note: '',
                                    staffInformed: false,
                                    done: false,
                                    status: 'pending'
                                };
                                const updatedPlans = [newPlan, ...selectedClient.plans];
                                savePlan({ plans: updatedPlans });
                            }, showDeletePlanConfirm: showDeletePlanConfirm }) }), _jsx(WeeklyDocSection, { weeklyDoc: weeklyDoc, saveWeeklyDoc: saveWeeklyDoc, weekIdInput: weekIdInput, setWeekIdInput: setWeekIdInput, clientId: selectedClient.id }), _jsx(MonthlyReportSection, { monthlyReport: monthlyReport, saveMonthlyReport: saveMonthlyReport, monthIdInput: monthIdInput, setMonthIdInput: setMonthIdInput, clientId: selectedClient.id }), _jsx(VismaSection, { vismaWeek: vismaWeek, saveVisma: saveVisma, weekIdInput: weekIdInput, setWeekIdInput: setWeekIdInput })] }), _jsx(ConfirmDialog, { open: confirmDialog.open, title: confirmDialog.title, description: confirmDialog.description, impactSummary: confirmDialog.impactSummary, onConfirm: confirmDialog.onConfirm, onCancel: () => setConfirmDialog(prev => ({ ...prev, open: false })) })] }));
}
function Reports({ state }) {
    return (_jsxs("div", { children: [_jsx("div", { style: headerBar, children: _jsx("div", { style: title, children: "Rapporter & Export" }) }), _jsxs("div", { style: gridTwo, children: [_jsxs("div", { style: card(), children: [_jsx("div", { style: cardHeader, children: _jsx("div", { style: { fontWeight: 800 }, children: "Export" }) }), _jsxs("div", { style: { display: "flex", gap: 8, marginBottom: 12 }, children: [_jsx("button", { style: primaryBtn, onClick: () => exportToFile(state), children: "Ladda ner fil" }), _jsx("button", { style: btn, onClick: () => exportToClipboard(state), children: "Kopiera till urklipp" })] }), _jsx("div", { style: { fontSize: 12, color: C.textLight }, children: "Export inkluderar all data. Anv\u00E4nd f\u00F6r backup eller f\u00F6r att dela med kollega." })] }), _jsxs("div", { style: card(), children: [_jsx("div", { style: cardHeader, children: _jsx("div", { style: { fontWeight: 800 }, children: "Lagring" }) }), _jsxs("div", { style: { marginBottom: 8 }, children: [_jsx("div", { style: { fontSize: 12, color: C.textLight, marginBottom: 4 }, children: "Lagringstyp" }), _jsx("div", { style: { fontWeight: 700 }, children: getStorageType() })] }), _jsxs("div", { style: { marginBottom: 8 }, children: [_jsx("div", { style: { fontSize: 12, color: C.textLight, marginBottom: 4 }, children: "Senaste backup" }), _jsx("div", { style: { fontWeight: 700 }, children: state.lastBackup || "Aldrig" })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, color: C.textLight, marginBottom: 4 }, children: "Backups tillg\u00E4ngliga" }), _jsxs("div", { style: { fontWeight: 700 }, children: [getBackups().length, " st"] })] })] })] })] }));
}
function StaffDetail({ state, selectedStaff }) {
    if (!selectedStaff) {
        return (_jsxs("div", { children: [_jsx("div", { style: headerBar, children: _jsx("div", { style: title, children: "Personal Dashboard" }) }), _jsx("div", { style: card(), children: _jsx("div", { style: { color: C.textLight, textAlign: 'center', padding: 20 }, children: "V\u00E4lj en personal i Personal-vyn f\u00F6r att visa dashboard." }) })] }));
    }
    return (_jsx("div", { children: _jsx(StaffSummary, { staff: selectedStaff, state: state }) }));
}
function ArchiveView({ state, setState }) {
    const [staffQuery, setStaffQuery] = useState("");
    const [retentionDays, setRetentionDays] = useState(180);
    // NEW: Confirm dialog state for restore and cleanup
    const [confirmDialog, setConfirmDialog] = useState({
        open: false,
        title: '',
        description: '',
        onConfirm: () => { }
    });
    function restoreClient(clientId, staffId) {
        setState((prev) => ({
            ...prev,
            staff: prev.staff.map(s => s.id === staffId ? {
                ...s,
                clients: s.clients.map(c => c.id === clientId
                    ? { ...c, archivedAt: undefined, deletedAt: undefined }
                    : c)
            } : s)
        }));
    }
    function showRestoreClientConfirm(client) {
        setConfirmDialog({
            open: true,
            title: "Återställ klient",
            description: `Är du säker på att du vill återställa ${client.name}? Klienten kommer att visas i aktiva listor igen.`,
            onConfirm: () => {
                const staff = state.staff.find(s => s.clients.some(c => c.id === client.id));
                if (staff) {
                    restoreClient(client.id, staff.id);
                }
                setConfirmDialog(prev => ({ ...prev, open: false }));
            }
        });
    }
    // NEW: Cleanup functions
    function performRetentionCleanup() {
        const sweepResult = retentionSweep(retentionDays);
        if (sweepResult.toRemove.length === 0) {
            alert('Inga gamla poster att rensa.');
            return;
        }
        setConfirmDialog({
            open: true,
            title: "Rensa gamla arkiverade poster",
            description: `Är du säker på att du vill rensa ${sweepResult.toRemove.length} poster som är äldre än ${retentionDays} dagar? Denna åtgärd kan inte ångras.`,
            impactSummary: `Rensar ${sweepResult.toRemove.filter(item => item.type === 'client').length} klienter, ${sweepResult.toRemove.filter(item => item.type === 'plan').length} planer, ${sweepResult.toRemove.filter(item => item.type === 'weeklyDoc').length} veckorapporter, ${sweepResult.toRemove.filter(item => item.type === 'monthlyReport').length} månadsrapporter, ${sweepResult.toRemove.filter(item => item.type === 'vismaWeek').length} Visma-veckor`,
            onConfirm: () => {
                executeRetentionCleanup(sweepResult.toRemove);
                setConfirmDialog(prev => ({ ...prev, open: false }));
            }
        });
    }
    function exportBeforeCleanup() {
        const sweepResult = retentionSweep(retentionDays);
        if (sweepResult.toRemove.length === 0) {
            alert('Inga gamla poster att exportera.');
            return;
        }
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const exportData = sweepResult.toRemove.map(item => ({
            type: item.type,
            id: item.id,
            staffId: item.staffId,
            clientId: item.clientId,
            deletedAt: item.deletedAt,
            data: JSON.stringify(item.data)
        }));
        exportToJSON(exportData, `ungdomsstod-retention-export-${timestamp}.json`);
        exportToCSV(exportData, `ungdomsstod-retention-export-${timestamp}.csv`);
    }
    function executeRetentionCleanup(toRemove) {
        setState((prev) => {
            const newState = { ...prev };
            toRemove.forEach(item => {
                const staffIndex = newState.staff.findIndex(s => s.id === item.staffId);
                if (staffIndex === -1)
                    return;
                const staff = newState.staff[staffIndex];
                if (!staff)
                    return;
                if (item.type === 'client') {
                    // Remove entire client
                    staff.clients = staff.clients.filter(c => c.id !== item.id);
                }
                else if (item.clientId) {
                    // Remove individual items within client
                    const clientIndex = staff.clients.findIndex(c => c.id === item.clientId);
                    if (clientIndex === -1)
                        return;
                    const client = staff.clients[clientIndex];
                    if (!client)
                        return;
                    switch (item.type) {
                        case 'plan':
                            client.plans = client.plans.filter(p => p.id !== item.id);
                            break;
                        case 'weeklyDoc':
                            delete client.weeklyDocs[item.id];
                            break;
                        case 'monthlyReport':
                            delete client.monthlyReports[item.id];
                            break;
                        case 'vismaWeek':
                            delete client.visma[item.id];
                            break;
                    }
                }
            });
            return newState;
        });
        alert(`${toRemove.length} poster har rensats från arkivet.`);
    }
    // Get all archived and soft-deleted clients grouped by staff
    const archivedClientsByStaff = useMemo(() => {
        const result = [];
        state.staff.forEach(staff => {
            const archivedClients = staff.clients.filter(c => c.archivedAt || c.deletedAt);
            if (archivedClients.length > 0) {
                result.push({ staff, clients: archivedClients });
            }
        });
        return result;
    }, [state.staff]);
    const filteredStaff = archivedClientsByStaff.filter(({ staff }) => staff.name.toLowerCase().includes(staffQuery.toLowerCase()));
    return (_jsxs("div", { children: [_jsx("div", { style: headerBar, children: _jsx("div", { style: title, children: "Arkiverade & borttagna klienter" }) }), _jsxs("div", { style: card(), children: [_jsx("div", { style: cardHeader, children: _jsx("div", { style: { fontWeight: 800 }, children: "Rensa gamla arkiverade poster" }) }), _jsxs("div", { style: { marginBottom: 16 }, children: [_jsx("label", { style: { display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }, children: "Rensa poster \u00E4ldre \u00E4n (dagar):" }), _jsx("input", { type: "number", value: retentionDays, onChange: e => setRetentionDays(parseInt(e.target.value) || 180), min: "1", max: "3650", style: { ...inputBase, width: 120 } })] }), _jsxs("div", { style: { display: 'flex', gap: 12, flexWrap: 'wrap' }, children: [_jsx("button", { style: {
                                    ...primaryBtn,
                                    background: '#007aff',
                                    fontSize: 14
                                }, onClick: exportBeforeCleanup, children: "\uD83D\uDDC3\uFE0F Exportera gamla poster" }), _jsx("button", { style: {
                                    ...primaryBtn,
                                    background: '#ff3b30',
                                    fontSize: 14
                                }, onClick: performRetentionCleanup, children: "\uD83D\uDDD1\uFE0F Rensa gamla poster" })] })] }), _jsxs("div", { style: card(), children: [_jsx("div", { style: cardHeader, children: _jsx("div", { style: { fontWeight: 800 }, children: "Arkiverade & borttagna klienter" }) }), _jsx("input", { placeholder: "S\u00F6k personal\u2026", value: staffQuery, onChange: e => setStaffQuery(e.target.value), style: { ...inputBase, width: '100%', marginBottom: 16 } }), filteredStaff.length === 0 ? (_jsx("div", { style: { color: C.textLight, textAlign: 'center', padding: 20 }, children: staffQuery ? 'Inga arkiverade eller borttagna klienter hittades för denna personal.' : 'Inga arkiverade eller borttagna klienter.' })) : (_jsx("div", { style: { ...col(12) }, children: filteredStaff.map(({ staff, clients }) => (_jsxs("div", { style: card(), children: [_jsxs("div", { style: { fontWeight: 700, marginBottom: 12, color: ui.text }, children: [staff.name, " (", clients.length, " arkiverade/borttagna)"] }), _jsx("div", { style: { ...col(8) }, children: clients.map(client => (_jsxs("div", { style: {
                                            ...listItemStyle(false),
                                            display: "grid",
                                            gridTemplateColumns: "1fr auto",
                                            gap: 12,
                                            alignItems: "center"
                                        }, children: [_jsxs("div", { children: [_jsx("div", { style: nameStyle, children: client.name }), _jsxs("div", { style: metaStyle, children: [client.archivedAt && `Arkiverad: ${new Date(client.archivedAt).toLocaleDateString('sv-SE')}`, client.deletedAt && `Borttagen: ${new Date(client.deletedAt).toLocaleDateString('sv-SE')}`] })] }), _jsx("button", { style: {
                                                    ...primaryBtn,
                                                    fontSize: 12,
                                                    padding: "6px 12px"
                                                }, onClick: () => showRestoreClientConfirm(client), children: "\u00C5terst\u00E4ll" })] }, client.id))) })] }, staff.id))) }))] }), _jsx(ConfirmDialog, { open: confirmDialog.open, title: confirmDialog.title, description: confirmDialog.description, impactSummary: confirmDialog.impactSummary, onConfirm: confirmDialog.onConfirm, onCancel: () => setConfirmDialog(prev => ({ ...prev, open: false })) })] }));
}
/* ---------- App Render ---------- */
export default function App() {
    const [state, setState] = useState(() => loadState() ?? initialState());
    const [view, setView] = useState("overview");
    const [weekIdInput, setWeekIdInput] = useState(getCurrentWeek());
    const [monthIdInput, setMonthIdInput] = useState(getCurrentMonth());
    // NEW: Cleanup orphaned period data on app start
    useEffect(() => {
        const allClientIds = getAllClientIds(state);
        cleanupClientLocalStorage(allClientIds);
    }, [state]); // Run once on mount and when state changes
    // NEW: Cleanup orphaned period data when clients are removed
    useEffect(() => {
        const allClientIds = getAllClientIds(state);
        cleanupClientLocalStorage(allClientIds);
    }, [state.staff, state]); // Run when staff/clients change
    // SaveBar hanterar nu auto-save med debounce
    // useEffect för saveState borttaget
    // ★ Om vi hamnar i klientvyn utan vald klient: gå till Personal
    useEffect(() => {
        if (view === 'client' && !state.selectedClientId) {
            setView('staff');
        }
        if (view === 'staffDetail' && !state.selectedStaffId) {
            setView('staff');
        }
    }, [view, state.selectedClientId, state.selectedStaffId]);
    const selectedStaff = useMemo(() => state.staff.find((s) => s.id === state.selectedStaffId), [state.staff, state.selectedStaffId]);
    const selectedClient = useMemo(() => {
        const s = selectedStaff;
        if (!s)
            return undefined;
        return s.clients.find((c) => c.id === state.selectedClientId && !c.archivedAt && !c.deletedAt);
    }, [selectedStaff, state.selectedClientId]);
    const kpis = useMemo(() => {
        const nowWeek = getCurrentWeek();
        const nowMonth = getCurrentMonth();
        const today = todayYMD();
        let delayedPlan = 0, waitingPlan = 0, delayedDocs = 0, delayedMonthly = 0, delayedVisma = 0, totalClients = 0, totalPlansActive = 0, completedThisWeek = 0;
        state.staff.forEach(st => {
            st.clients.forEach(client => {
                // Skip archived and soft-deleted clients
                if (client.archivedAt || client.deletedAt)
                    return;
                totalClients += 1;
                // Använd senaste planen för KPI-beräkning
                const latest = latestPlan(client.plans);
                if (!latest) {
                    waitingPlan += 1;
                }
                else {
                    if (!latest.done) {
                        if (today > latest.dueDate)
                            delayedPlan += 1;
                        else
                            waitingPlan += 1;
                    }
                    else {
                        totalPlansActive += 1;
                    }
                }
                Object.values(client.weeklyDocs).forEach((wd) => {
                    if (compareWeekId(wd.weekId, nowWeek) === 0 && wd.status === "approved") {
                        completedThisWeek += 1;
                    }
                    if (compareWeekId(wd.weekId, nowWeek) < 0 && (wd.status !== "approved"))
                        delayedDocs += 1;
                });
                Object.values(client.monthlyReports).forEach((mr) => {
                    if (compareMonthId(mr.monthId, nowMonth) < 0 && (!mr.sent || mr.status !== "approved"))
                        delayedMonthly += 1;
                });
                Object.values(client.visma).forEach((vw) => {
                    if (compareWeekId(vw.weekId, nowWeek) < 0 && (vw.status !== "approved"))
                        delayedVisma += 1;
                });
            });
        });
        return {
            delayedPlan,
            waitingPlan,
            delayedDocs,
            delayedMonthly,
            delayedVisma,
            totalClients,
            totalPlansActive,
            completedThisWeek
        };
    }, [state.staff]);
    return (_jsxs("div", { style: app, children: [_jsxs("aside", { style: sidebar, "data-print-hide": true, children: [_jsx("div", { style: { fontWeight: 900, fontSize: 18, color: ui.text, marginBottom: 10 }, children: "V\u00E5rdadmin" }), _jsx("button", { style: navItemStyle(view === "overview"), onClick: () => setView("overview"), onMouseEnter: (e) => {
                            if (view !== "overview") {
                                e.currentTarget.style.background = ui.navHoverBg;
                            }
                        }, onMouseLeave: (e) => {
                            if (view !== "overview") {
                                e.currentTarget.style.background = 'transparent';
                            }
                        }, onFocus: (e) => {
                            e.currentTarget.style.outline = `2px solid ${ui.blue}`;
                            e.currentTarget.style.outlineOffset = '2px';
                        }, onBlur: (e) => {
                            e.currentTarget.style.outline = 'none';
                        }, children: "\u00D6versikt" }), _jsxs("button", { style: {
                            ...navItemStyle(view === "client"),
                            opacity: selectedClient ? 1 : 0.55,
                            cursor: selectedClient ? 'pointer' : 'not-allowed'
                        }, onClick: () => selectedClient && setView("client"), onMouseEnter: (e) => {
                            if (view !== "client" && selectedClient) {
                                e.currentTarget.style.background = ui.navHoverBg;
                            }
                        }, onMouseLeave: (e) => {
                            if (view !== "client") {
                                e.currentTarget.style.background = 'transparent';
                            }
                        }, onFocus: (e) => {
                            if (selectedClient) {
                                e.currentTarget.style.outline = `2px solid ${ui.blue}`;
                                e.currentTarget.style.outlineOffset = '2px';
                            }
                        }, onBlur: (e) => {
                            e.currentTarget.style.outline = 'none';
                        }, children: ["Klienten ", selectedClient ? `(${selectedClient.name})` : ""] }), _jsx("button", { style: navItemStyle(view === "staff"), onClick: () => setView("staff"), onMouseEnter: (e) => {
                            if (view !== "staff") {
                                e.currentTarget.style.background = ui.navHoverBg;
                            }
                        }, onMouseLeave: (e) => {
                            if (view !== "staff") {
                                e.currentTarget.style.background = 'transparent';
                            }
                        }, onFocus: (e) => {
                            e.currentTarget.style.outline = `2px solid ${ui.blue}`;
                            e.currentTarget.style.outlineOffset = '2px';
                        }, onBlur: (e) => {
                            e.currentTarget.style.outline = 'none';
                        }, children: "Personal" }), _jsxs("button", { style: {
                            ...navItemStyle(view === "staffDetail"),
                            opacity: selectedStaff ? 1 : 0.55,
                            cursor: selectedStaff ? 'pointer' : 'not-allowed'
                        }, onClick: () => selectedStaff && setView("staffDetail"), onMouseEnter: (e) => {
                            if (view !== "staffDetail" && selectedStaff) {
                                e.currentTarget.style.background = ui.navHoverBg;
                            }
                        }, onMouseLeave: (e) => {
                            if (view !== "staffDetail") {
                                e.currentTarget.style.background = 'transparent';
                            }
                        }, onFocus: (e) => {
                            if (selectedStaff) {
                                e.currentTarget.style.outline = `2px solid ${ui.blue}`;
                                e.currentTarget.style.outlineOffset = '2px';
                            }
                        }, onBlur: (e) => {
                            e.currentTarget.style.outline = 'none';
                        }, children: ["Dashboard ", selectedStaff ? `(${selectedStaff.name})` : ""] }), _jsx("button", { style: navItemStyle(view === "reports"), onClick: () => setView("reports"), onMouseEnter: (e) => {
                            if (view !== "reports") {
                                e.currentTarget.style.background = ui.navHoverBg;
                            }
                        }, onMouseLeave: (e) => {
                            if (view !== "reports") {
                                e.currentTarget.style.background = 'transparent';
                            }
                        }, onFocus: (e) => {
                            e.currentTarget.style.outline = `2px solid ${ui.blue}`;
                            e.currentTarget.style.outlineOffset = '2px';
                        }, onBlur: (e) => {
                            e.currentTarget.style.outline = 'none';
                        }, children: "Rapporter" }), _jsx("button", { style: navItemStyle(view === "archive"), onClick: () => setView("archive"), onMouseEnter: (e) => {
                            if (view !== "archive") {
                                e.currentTarget.style.background = ui.navHoverBg;
                            }
                        }, onMouseLeave: (e) => {
                            if (view !== "archive") {
                                e.currentTarget.style.background = 'transparent';
                            }
                        }, onFocus: (e) => {
                            e.currentTarget.style.outline = `2px solid ${ui.blue}`;
                            e.currentTarget.style.outlineOffset = '2px';
                        }, onBlur: (e) => {
                            e.currentTarget.style.outline = 'none';
                        }, children: "Arkiv" }), _jsx("div", { style: { flex: 1 } }), _jsx("button", { style: { ...navItemStyle(false), color: ui.textMute }, onMouseEnter: (e) => {
                            e.currentTarget.style.background = ui.navHoverBg;
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.background = 'transparent';
                        }, onFocus: (e) => {
                            e.currentTarget.style.outline = `2px solid ${ui.blue}`;
                            e.currentTarget.style.outlineOffset = '2px';
                        }, onBlur: (e) => {
                            e.currentTarget.style.outline = 'none';
                        }, children: "Logga ut" })] }), _jsxs("main", { style: main, children: [view === "overview" && _jsx(Overview, { state: state, kpis: kpis }), view === "staff" && _jsx(StaffView, { state: state, setState: setState, selectedStaff: selectedStaff, setView: setView }), view === "staffDetail" && _jsx(StaffDetail, { state: state, selectedStaff: selectedStaff }), view === "archive" && _jsx(ArchiveView, { state: state, setState: setState }), view === "client" && (_jsx(ClientWorkFull, { selectedClient: selectedClient, savePlan: (u) => {
                            if (!selectedStaff || !selectedClient)
                                return;
                            // NEW: Write GFP plans to history
                            if ('plans' in u && u.plans) {
                                u.plans.forEach(plan => {
                                    upsertHistory({
                                        periodType: 'week', // GFP plans are tracked weekly
                                        periodId: getCurrentWeek(), // Use current week for GFP tracking
                                        staffId: selectedStaff.id,
                                        clientId: selectedClient.id,
                                        metric: 'gfp',
                                        status: plan.status,
                                        value: plan.done ? 1 : 0
                                    });
                                });
                            }
                            setState((prev) => ({
                                ...prev,
                                staff: prev.staff.map((s) => s.id === selectedStaff.id
                                    ? {
                                        ...s,
                                        clients: s.clients.map((c) => c.id === selectedClient.id
                                            ? {
                                                ...c,
                                                ...('plans' in u ? { plans: u.plans } : { plan: { ...c.plan, ...u } })
                                            }
                                            : c)
                                    }
                                    : s)
                            }));
                        }, saveWeeklyDoc: (weekId, payload) => {
                            if (!selectedStaff || !selectedClient)
                                return;
                            // NEW: Save to period-based storage
                            savePeriodData(selectedClient.id, 'weekly', weekId, payload);
                            // NEW: Write to history
                            const daysCount = Object.values(payload.days).filter(Boolean).length;
                            upsertHistory({
                                periodType: 'week',
                                periodId: weekId,
                                staffId: selectedStaff.id,
                                clientId: selectedClient.id,
                                metric: 'weekDoc',
                                status: payload.status,
                                value: daysCount
                            });
                            setState((prev) => ({
                                ...prev,
                                staff: prev.staff.map((s) => s.id === selectedStaff.id
                                    ? { ...s, clients: s.clients.map((c) => (c.id === selectedClient.id ? { ...c, weeklyDocs: { ...c.weeklyDocs, [weekId]: payload } } : c)) }
                                    : s)
                            }));
                        }, saveMonthlyReport: (monthId, payload) => {
                            if (!selectedStaff || !selectedClient)
                                return;
                            // NEW: Save to period-based storage
                            savePeriodData(selectedClient.id, 'monthly', monthId, payload);
                            // NEW: Write to history
                            upsertHistory({
                                periodType: 'month',
                                periodId: monthId,
                                staffId: selectedStaff.id,
                                clientId: selectedClient.id,
                                metric: 'monthReport',
                                status: payload.status,
                                value: payload.sent ? 1 : 0
                            });
                            setState((prev) => ({
                                ...prev,
                                staff: prev.staff.map((s) => s.id === selectedStaff.id
                                    ? { ...s, clients: s.clients.map((c) => (c.id === selectedClient.id ? { ...c, monthlyReports: { ...c.monthlyReports, [monthId]: payload } } : c)) }
                                    : s)
                            }));
                        }, saveVisma: (weekId, payload) => {
                            if (!selectedStaff || !selectedClient)
                                return;
                            setState((prev) => ({
                                ...prev,
                                staff: prev.staff.map((s) => s.id === selectedStaff.id
                                    ? { ...s, clients: s.clients.map((c) => (c.id === selectedClient.id ? { ...c, visma: { ...c.visma, [weekId]: payload } } : c)) }
                                    : s)
                            }));
                        }, weekIdInput: weekIdInput, setWeekIdInput: setWeekIdInput, monthIdInput: monthIdInput, setMonthIdInput: setMonthIdInput })), view === "reports" && _jsx(Reports, { state: state })] }), _jsx(SaveBar, { state: state, "data-print-hide": true })] }));
}
