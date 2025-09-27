import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { getCurrentWeek, addWeeks } from '../date';
import { aggregateTuesdayAttendance } from '../storage';
// Label/Color maps
const ATT_LABEL = {
    unregistered: 'Ej registrerad',
    excused_absence: 'Frånvaro (giltig)',
    on_time: 'Närvaro i tid',
    late: 'Närvaro försenad',
    unexcused_absence: 'Ogiltig frånvaro',
};
const ATT_COLOR = {
    unregistered: '#FFFFFF',
    excused_absence: '#007aff',
    on_time: '#34C759',
    late: '#ff9500',
    unexcused_absence: '#ff3b30',
};
const GroupAttendanceWidget = () => {
    const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
    const [aggregatedData, setAggregatedData] = useState({
        unregistered: 0,
        excused_absence: 0,
        on_time: 0,
        late: 0,
        unexcused_absence: 0,
    });
    // Load aggregated data
    const loadData = useCallback(() => {
        const data = aggregateTuesdayAttendance(selectedWeek);
        setAggregatedData(data);
    }, [selectedWeek]);
    useEffect(() => {
        loadData();
    }, [loadData]);
    // Listen for live updates
    useEffect(() => {
        const handleUpdate = (e) => {
            if (e.detail.weekId === selectedWeek) {
                loadData();
            }
        };
        window.addEventListener('tuesdayAttendanceUpdate', handleUpdate);
        return () => {
            window.removeEventListener('tuesdayAttendanceUpdate', handleUpdate);
        };
    }, [selectedWeek, loadData]);
    // Navigate weeks with proper ISO handling
    const navigateWeek = (direction) => {
        const newWeek = addWeeks(selectedWeek, direction === 'next' ? 1 : -1);
        setSelectedWeek(newWeek);
    };
    const total = Object.values(aggregatedData).reduce((sum, count) => sum + count, 0);
    const maxCount = Math.max(...Object.values(aggregatedData), 1);
    return (_jsxs("div", { style: {
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '16px',
            backgroundColor: 'white',
            marginBottom: '16px'
        }, children: [_jsx("h3", { style: { margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }, children: "N\u00E4rvaro tisdag/APT (grupp)" }), _jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '16px'
                }, children: [_jsx("button", { onClick: () => navigateWeek('prev'), "aria-label": "F\u00F6reg\u00E5ende vecka", style: {
                            padding: '4px 8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            backgroundColor: 'white',
                            cursor: 'pointer'
                        }, children: "\u25C0" }), _jsxs("span", { style: {
                            flex: 1,
                            textAlign: 'center',
                            fontWeight: 500
                        }, children: ["Vecka ", selectedWeek] }), _jsx("button", { onClick: () => navigateWeek('next'), "aria-label": "N\u00E4sta vecka", style: {
                            padding: '4px 8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            backgroundColor: 'white',
                            cursor: 'pointer'
                        }, children: "\u25B6" })] }), total === 0 ? (_jsxs("div", { style: {
                    padding: '24px',
                    textAlign: 'center',
                    color: '#999',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '8px',
                    marginBottom: '12px'
                }, children: [_jsx("div", { style: { fontSize: '14px', marginBottom: '8px' }, children: "Ingen personal registrerad" }), _jsx("div", { style: { fontSize: '12px' }, children: "L\u00E4gg till personal f\u00F6r att b\u00F6rja sp\u00E5ra n\u00E4rvaro" })] })) : (_jsx("div", { style: { marginBottom: '12px' }, children: Object.keys(ATT_LABEL).map(status => {
                    const count = aggregatedData[status];
                    const percentage = total > 0 ? (count / total * 100) : 0;
                    const barWidth = maxCount > 0 ? (count / maxCount * 100) : 0;
                    return (_jsxs("div", { style: { marginBottom: '8px' }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '13px',
                                    marginBottom: '2px'
                                }, children: [_jsxs("span", { style: { width: '140px' }, children: [ATT_LABEL[status], ":"] }), _jsxs("span", { style: { fontWeight: 500 }, children: [count, " st"] }), total > 0 && (_jsxs("span", { style: { marginLeft: '8px', color: '#666' }, children: ["(", percentage.toFixed(0), "%)"] }))] }), _jsx("div", { style: {
                                    width: '100%',
                                    height: '20px',
                                    backgroundColor: '#f0f0f0',
                                    borderRadius: '4px',
                                    overflow: 'hidden'
                                }, children: _jsx("div", { style: {
                                        width: `${barWidth}%`,
                                        height: '100%',
                                        backgroundColor: status === 'unregistered' ? '#ccc' : ATT_COLOR[status],
                                        transition: 'width 0.3s ease'
                                    } }) })] }, status));
                }) })), _jsxs("div", { style: {
                    fontSize: '12px',
                    color: '#666',
                    textAlign: 'center'
                }, children: ["Totalt ", total, " personal \u00B7 ISO-vecka ", selectedWeek] })] }));
};
export default GroupAttendanceWidget;
