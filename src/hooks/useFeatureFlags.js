/**
 * React Hook for Feature Flags
 * Provides easy access to feature flags in React components
 */
import { useState, useEffect, useCallback } from 'react';
export function useFeatureFlags(flagNames, options = {}) {
    const { apiUrl = '/api', token, refreshInterval = 5 * 60 * 1000 // 5 minutes
     } = options;
    const [state, setState] = useState({
        flags: {},
        loading: true,
        error: null
    });
    const fetchFeatureFlags = useCallback(async () => {
        if (!token || flagNames.length === 0) {
            setState(prev => ({ ...prev, loading: false }));
            return;
        }
        try {
            setState(prev => ({ ...prev, loading: true, error: null }));
            const response = await fetch(`${apiUrl}/feature-flags/evaluate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ flagNames })
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch feature flags: ${response.statusText}`);
            }
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.message || 'Failed to fetch feature flags');
            }
            const evaluations = result.data;
            const flags = {};
            evaluations.forEach(evaluation => {
                flags[evaluation.flagName] = evaluation.enabled;
            });
            setState({
                flags,
                loading: false,
                error: null
            });
        }
        catch (error) {
            console.error('Failed to fetch feature flags:', error);
            setState(prev => ({
                ...prev,
                loading: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }));
        }
    }, [flagNames, apiUrl, token]);
    useEffect(() => {
        fetchFeatureFlags();
        if (refreshInterval > 0) {
            const interval = setInterval(fetchFeatureFlags, refreshInterval);
            return () => clearInterval(interval);
        }
        return undefined;
    }, [fetchFeatureFlags, refreshInterval]);
    const isEnabled = useCallback((flagName) => {
        return state.flags[flagName] || false;
    }, [state.flags]);
    const isLoading = state.loading;
    const error = state.error;
    return {
        isEnabled,
        isLoading,
        error,
        refresh: fetchFeatureFlags
    };
}
/**
 * Hook for evaluating a single feature flag
 */
export function useFeatureFlag(flagName, options = {}) {
    const { isEnabled, isLoading, error, refresh } = useFeatureFlags([flagName], options);
    return {
        enabled: isEnabled(flagName),
        isLoading,
        error,
        refresh
    };
}
/**
 * Hook for conditional rendering based on feature flags
 */
export function useFeatureFlagComponent(flagName, options = {}) {
    const { enabled, isLoading, error } = useFeatureFlag(flagName, options);
    return {
        enabled,
        isLoading,
        error,
        render: (children) => enabled ? children : null,
        renderIf: (condition, children) => enabled && condition ? children : null
    };
}
export default useFeatureFlags;
