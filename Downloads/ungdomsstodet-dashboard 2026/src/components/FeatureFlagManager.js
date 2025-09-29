import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Feature Flag Management Component
 * Admin interface for managing feature flags
 */
import { useState, useEffect, useCallback } from 'react';
const FeatureFlagManager = ({ apiUrl = '/api', token }) => {
    const [flags, setFlags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [_selectedFlag, setSelectedFlag] = useState(null);
    const [_showCreateForm, setShowCreateForm] = useState(false);
    const fetchFlags = useCallback(async () => {
        if (!token)
            return;
        try {
            setLoading(true);
            const response = await fetch(`${apiUrl}/feature-flags`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch flags: ${response.statusText}`);
            }
            const result = await response.json();
            if (result.success) {
                setFlags(result.data.flags);
            }
            else {
                throw new Error(result.message || 'Failed to fetch flags');
            }
        }
        catch (error) {
            console.error('Failed to fetch feature flags:', error);
            setError(error instanceof Error ? error.message : 'Unknown error');
        }
        finally {
            setLoading(false);
        }
    }, [apiUrl, token]);
    const updateFlag = async (flagName, updates) => {
        if (!token)
            return;
        try {
            const response = await fetch(`${apiUrl}/feature-flags/${flagName}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updates)
            });
            if (!response.ok) {
                throw new Error(`Failed to update flag: ${response.statusText}`);
            }
            const result = await response.json();
            if (result.success) {
                setFlags(prev => prev.map(flag => flag.name === flagName ? { ...flag, ...updates } : flag));
                setSelectedFlag(null);
            }
            else {
                throw new Error(result.message || 'Failed to update flag');
            }
        }
        catch (error) {
            console.error('Failed to update feature flag:', error);
            setError(error instanceof Error ? error.message : 'Unknown error');
        }
    };
    useEffect(() => {
        fetchFlags();
    }, [token, fetchFlags]);
    const toggleFlag = (flagName, enabled) => {
        updateFlag(flagName, { enabled });
    };
    const updateRolloutPercentage = (flagName, percentage) => {
        updateFlag(flagName, { rolloutPercentage: percentage });
    };
    if (loading) {
        return (_jsx("div", { style: { padding: '20px', textAlign: 'center' }, children: _jsx("p", { children: "Laddar feature flags..." }) }));
    }
    if (error) {
        return (_jsxs("div", { style: { padding: '20px', color: '#ff3b30' }, children: [_jsxs("p", { children: ["Fel vid h\u00E4mtning av feature flags: ", error] }), _jsx("button", { onClick: fetchFlags, style: {
                        padding: '8px 16px',
                        backgroundColor: '#007aff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }, children: "F\u00F6rs\u00F6k igen" })] }));
    }
    return (_jsxs("div", { style: { padding: '20px', maxWidth: '1200px', margin: '0 auto' }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px'
                }, children: [_jsx("h2", { style: { margin: 0, color: '#111111' }, children: "Feature Flags" }), _jsx("button", { onClick: () => setShowCreateForm(true), style: {
                            padding: '10px 20px',
                            backgroundColor: '#16a34a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }, children: "Skapa ny flagga" })] }), _jsx("div", { style: {
                    display: 'grid',
                    gap: '16px',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'
                }, children: flags.map(flag => (_jsxs("div", { style: {
                        border: '1px solid rgba(0,0,0,0.12)',
                        borderRadius: '8px',
                        padding: '16px',
                        backgroundColor: '#fff'
                    }, children: [_jsxs("div", { style: { marginBottom: '12px' }, children: [_jsx("h3", { style: {
                                        margin: '0 0 8px 0',
                                        color: '#111111',
                                        fontSize: '16px'
                                    }, children: flag.name }), _jsx("p", { style: {
                                        margin: '0 0 12px 0',
                                        color: '#374151',
                                        fontSize: '14px'
                                    }, children: flag.description })] }), _jsx("div", { style: { marginBottom: '12px' }, children: _jsxs("label", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '14px',
                                    color: '#111111'
                                }, children: [_jsx("input", { type: "checkbox", checked: flag.enabled, onChange: (e) => toggleFlag(flag.name, e.target.checked), style: { transform: 'scale(1.2)' } }), "Aktiverad"] }) }), _jsxs("div", { style: { marginBottom: '12px' }, children: [_jsxs("label", { style: {
                                        display: 'block',
                                        fontSize: '14px',
                                        color: '#111111',
                                        marginBottom: '4px'
                                    }, children: ["Rollout: ", flag.rolloutPercentage, "%"] }), _jsx("input", { type: "range", min: "0", max: "100", value: flag.rolloutPercentage, onChange: (e) => updateRolloutPercentage(flag.name, parseInt(e.target.value)), style: { width: '100%' } })] }), _jsxs("div", { style: {
                                fontSize: '12px',
                                color: '#6b7280',
                                borderTop: '1px solid rgba(0,0,0,0.12)',
                                paddingTop: '8px'
                            }, children: [_jsxs("div", { children: ["Milj\u00F6: ", flag.environment] }), _jsxs("div", { children: ["Skapad: ", new Date(flag.createdAt).toLocaleDateString('sv-SE')] }), flag.expiresAt && (_jsxs("div", { children: ["Utg\u00E5r: ", new Date(flag.expiresAt).toLocaleDateString('sv-SE')] }))] })] }, flag.id))) }), flags.length === 0 && (_jsx("div", { style: {
                    textAlign: 'center',
                    padding: '40px',
                    color: '#6b7280'
                }, children: _jsx("p", { children: "Inga feature flags hittades." }) }))] }));
};
export default FeatureFlagManager;
