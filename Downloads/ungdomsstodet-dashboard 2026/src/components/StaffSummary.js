import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useStaffStats } from '../hooks/useStaffStats';
import TuesdayAttendanceWidget from './TuesdayAttendanceWidget';
function PersonalKpiCard({ title, value, subtitle, variant = 'info', icon }) {
    const colors = {
        late: { accent: '#ff3b30', bg: 'rgba(255,59,48,0.06)' },
        waiting: { accent: '#ff9500', bg: 'rgba(255,149,0,0.06)' },
        info: { accent: '#007aff', bg: 'rgba(0,122,255,0.06)' },
        success: { accent: '#16a34a', bg: 'rgba(22,163,74,0.06)' },
        neutral: { accent: '#6b7280', bg: 'rgba(107,114,128,0.06)' }
    };
    const c = colors[variant];
    return (_jsxs("div", { className: `kpi-card kpi-${variant}`, style: {
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 10,
            padding: 12,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            display: 'flex',
            gap: 12,
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
                }, children: icon || (_jsx("svg", { width: 20, height: 20, viewBox: "0 0 24 24", "aria-hidden": "true", children: _jsx("circle", { cx: "12", cy: "12", r: "9", fill: c.accent, opacity: 0.9 }) })) }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { color: '#374151', fontSize: 12, fontWeight: 600 }, children: title }), _jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 8 }, children: [_jsx("div", { style: { color: '#111827', fontSize: 26, fontWeight: 700 }, children: value }), subtitle && (_jsx("div", { style: { color: '#6b7280', fontSize: 12 }, children: subtitle }))] })] }), _jsx("div", { style: { width: 6, alignSelf: 'stretch', borderRadius: 6, background: c.accent, opacity: 0.18 } })] }));
}
function DocumentationChart({ weeklyStats }) {
    const maxHeight = 80;
    const barWidth = 40;
    const barGap = 8;
    // Chart width calculation not needed for current layout
    return (_jsxs("div", { className: "chart-container", style: {
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 10,
            padding: 16,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
        }, children: [_jsx("div", { style: {
                    fontWeight: 800,
                    fontSize: 14,
                    marginBottom: 12,
                    color: '#111827'
                }, children: "Dokumentationsgrad senaste 4 veckor" }), _jsx("div", { style: {
                    display: 'flex',
                    alignItems: 'end',
                    justifyContent: 'center',
                    gap: barGap,
                    height: maxHeight + 40,
                    paddingBottom: 20
                }, children: weeklyStats.map((weekStat) => {
                    const barHeight = weekStat.total > 0 ? (weekStat.rate * maxHeight) : 0;
                    const color = weekStat.rate >= 0.8 ? '#16a34a' : // Grön för > 80%
                        weekStat.rate >= 0.5 ? '#ff9500' : // Orange för 50-79%
                            '#ff3b30'; // Röd för < 50%
                    // Extrahera veckonummer från weekId (YYYY-Wxx)
                    const weekNumber = weekStat.weekId.split('-W')[1] || '';
                    return (_jsxs("div", { style: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 8
                        }, children: [_jsx("div", { style: {
                                    width: barWidth,
                                    height: barHeight,
                                    background: color,
                                    borderRadius: '4px 4px 0 0',
                                    position: 'relative',
                                    transition: 'all 0.3s ease'
                                }, children: weekStat.total > 0 && (_jsxs("div", { style: {
                                        position: 'absolute',
                                        top: -20,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        fontSize: 10,
                                        fontWeight: 600,
                                        color: '#374151',
                                        whiteSpace: 'nowrap'
                                    }, children: [Math.round(weekStat.rate * 100), "%"] })) }), _jsxs("div", { style: {
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: '#6b7280',
                                    whiteSpace: 'nowrap'
                                }, children: ["V", weekNumber] }), _jsxs("div", { style: {
                                    fontSize: 9,
                                    color: '#9ca3af',
                                    textAlign: 'center',
                                    lineHeight: 1.2
                                }, children: [weekStat.approved, "/", weekStat.total] })] }, weekStat.weekId));
                }) }), _jsxs("div", { style: {
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 16,
                    marginTop: 8,
                    fontSize: 10,
                    color: '#6b7280'
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 4 }, children: [_jsx("div", { style: { width: 8, height: 8, borderRadius: 2, background: '#16a34a' } }), "\u226580%"] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 4 }, children: [_jsx("div", { style: { width: 8, height: 8, borderRadius: 2, background: '#ff9500' } }), "50-79%"] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 4 }, children: [_jsx("div", { style: { width: 8, height: 8, borderRadius: 2, background: '#ff3b30' } }), "<50%"] })] })] }));
}
function ProgressRing({ percentage, size = 120 }) {
    const stroke = 12;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - Math.max(0, Math.min(1, percentage)));
    const color = percentage >= 0.8 ? '#16a34a' :
        percentage >= 0.5 ? '#ff9500' :
            '#ff3b30';
    return (_jsx("div", { style: { position: 'relative', display: 'inline-block' }, children: _jsx("svg", { width: size, height: size, children: _jsxs("g", { transform: `translate(${size / 2},${size / 2})`, children: [_jsx("circle", { r: radius, fill: "none", stroke: "#eef2f7", strokeWidth: stroke }), _jsx("circle", { r: radius, fill: "none", stroke: color, strokeWidth: stroke, strokeDasharray: `${circumference} ${circumference}`, strokeDashoffset: offset, transform: "rotate(-90)", strokeLinecap: "round" }), _jsxs("text", { y: "6", textAnchor: "middle", style: {
                            fontWeight: 800,
                            fontSize: 20,
                            fill: '#111827'
                        }, children: [Math.round(percentage * 100), "%"] })] }) }) }));
}
export default function StaffSummary({ staff, state }) {
    const stats = useStaffStats(state, staff.id);
    // PRINT NEW: Print funktion
    const handlePrint = () => {
        window.print();
    };
    if (!stats) {
        return (_jsxs("div", { style: {
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 10,
                padding: 16,
                textAlign: 'center',
                color: '#6b7280'
            }, children: ["Kunde inte ladda statistik f\u00F6r ", staff.name] }));
    }
    const { kpis, weeklyStats } = stats;
    return (_jsxs("div", { "data-print-scope": "personal-dashboard", children: [_jsxs("div", { className: "print-only", style: { marginBottom: 20, textAlign: 'center' }, children: [_jsx("h1", { style: { fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 8px 0' }, children: staff.name }), _jsx("h2", { style: { fontSize: 18, fontWeight: 600, color: '#374151', margin: '0 0 16px 0' }, children: "Personal Dashboard" }), _jsxs("div", { style: { fontSize: 12, color: '#6b7280', marginBottom: 20 }, children: ["Genererad: ", new Date().toLocaleString('sv-SE', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                            })] })] }), _jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 20
                }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 20, fontWeight: 800, color: '#111827' }, children: staff.name }), _jsx("div", { style: { fontSize: 14, color: '#6b7280' }, children: "Personal Dashboard" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12 }, children: [_jsxs("div", { style: {
                                    fontSize: 12,
                                    color: '#6b7280',
                                    textAlign: 'right'
                                }, children: [kpis.totalClients, " klienter"] }), _jsxs("button", { onClick: handlePrint, "data-print-hide": true, style: {
                                    background: '#007aff',
                                    color: '#ffffff',
                                    border: '1px solid #007aff',
                                    borderRadius: 8,
                                    padding: '8px 16px',
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                }, onMouseOver: (e) => {
                                    e.currentTarget.style.background = '#0051d5';
                                    e.currentTarget.style.borderColor = '#0051d5';
                                }, onMouseOut: (e) => {
                                    e.currentTarget.style.background = '#007aff';
                                    e.currentTarget.style.borderColor = '#007aff';
                                }, "aria-label": "Skriv ut dashboard", children: [_jsx("svg", { width: 16, height: 16, viewBox: "0 0 24 24", "aria-hidden": "true", children: _jsx("path", { d: "M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }) }), "Skriv ut"] })] })] }), _jsxs("div", { className: "kpi-grid", style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 12,
                    marginBottom: 20
                }, children: [_jsx(PersonalKpiCard, { title: "Aktiva v\u00E5rdplaner", value: kpis.activePlans, subtitle: "GFP klara", variant: "success" }), _jsx(PersonalKpiCard, { title: "F\u00F6rsenade planer", value: kpis.delayedPlans, subtitle: "\u00F6ver 21 dagar", variant: "late" }), _jsx(PersonalKpiCard, { title: "V\u00E4ntar p\u00E5 GFP", value: kpis.waitingPlans, subtitle: "under process", variant: "waiting" }), _jsx(PersonalKpiCard, { title: "Klart denna vecka", value: kpis.completedThisWeek, subtitle: "godk\u00E4nda dokument", variant: "info" }), _jsx(PersonalKpiCard, { title: "F\u00F6rsenade dokument", value: kpis.delayedDocs, subtitle: "veckodokumentation", variant: "late" }), _jsx(PersonalKpiCard, { title: "F\u00F6rsenade rapporter", value: kpis.delayedMonthly, subtitle: "m\u00E5nadsrapporter", variant: "waiting" })] }), _jsxs("div", { className: "chart-grid", style: {
                    display: 'grid',
                    gridTemplateColumns: 'minmax(300px, 2fr) minmax(200px, 1fr)',
                    gap: 16,
                    alignItems: 'start'
                }, children: [_jsx(DocumentationChart, { weeklyStats: weeklyStats }), _jsxs("div", { className: "chart-container", style: {
                            background: '#fff',
                            border: '1px solid rgba(0,0,0,0.12)',
                            borderRadius: 10,
                            padding: 16,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                            textAlign: 'center'
                        }, children: [_jsx("div", { style: {
                                    fontWeight: 800,
                                    fontSize: 14,
                                    marginBottom: 16,
                                    color: '#111827'
                                }, children: "Total dokumentationsgrad" }), _jsx(ProgressRing, { percentage: kpis.documentationRate }), _jsxs("div", { style: {
                                    marginTop: 12,
                                    fontSize: 12,
                                    color: '#6b7280',
                                    lineHeight: 1.4
                                }, children: [stats.approvedDocuments, " av ", stats.totalDocuments, " dokument godk\u00E4nda"] })] })] }), _jsx(TuesdayAttendanceWidget, { staffId: staff.id }), _jsxs("div", { className: "print-footer print-only", children: ["Genererad: ", new Date().toLocaleString('sv-SE', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    }), " | Ungdomsst\u00F6d Dashboard"] })] }));
}
