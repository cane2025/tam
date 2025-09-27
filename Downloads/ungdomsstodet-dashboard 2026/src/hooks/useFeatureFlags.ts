/**
 * React Hook for Feature Flags
 * Provides easy access to feature flags in React components
 */

import { useState, useEffect, useCallback } from 'react';

export interface FeatureFlagEvaluation {
  flagName: string;
  enabled: boolean;
  reason: string;
  metadata?: Record<string, any>;
}

interface FeatureFlagsState {
  flags: Record<string, boolean>;
  loading: boolean;
  error: string | null;
}

interface UseFeatureFlagsOptions {
  apiUrl?: string;
  token?: string;
  refreshInterval?: number;
}

export function useFeatureFlags(
  flagNames: string[],
  options: UseFeatureFlagsOptions = {}
) {
  const {
    apiUrl = '/api',
    token,
    refreshInterval = 5 * 60 * 1000 // 5 minutes
  } = options;

  const [state, setState] = useState<FeatureFlagsState>({
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

      const evaluations: FeatureFlagEvaluation[] = result.data;
      const flags: Record<string, boolean> = {};

      evaluations.forEach(evaluation => {
        flags[evaluation.flagName] = evaluation.enabled;
      });

      setState({
        flags,
        loading: false,
        error: null
      });
    } catch (error) {
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
  }, [fetchFeatureFlags, refreshInterval]);

  const isEnabled = useCallback((flagName: string): boolean => {
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
export function useFeatureFlag(
  flagName: string,
  options: UseFeatureFlagsOptions = {}
) {
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
export function useFeatureFlagComponent(
  flagName: string,
  options: UseFeatureFlagsOptions = {}
) {
  const { enabled, isLoading, error } = useFeatureFlag(flagName, options);

  return {
    enabled,
    isLoading,
    error,
    render: (children: React.ReactNode) => enabled ? children : null,
    renderIf: (condition: boolean, children: React.ReactNode) => 
      enabled && condition ? children : null
  };
}

export default useFeatureFlags;
