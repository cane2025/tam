/**
 * React Hook for Feature Flags
 * Provides easy access to feature flags in React components
 */
export interface FeatureFlagEvaluation {
    flagName: string;
    enabled: boolean;
    reason: string;
    metadata?: Record<string, unknown>;
}
interface UseFeatureFlagsOptions {
    apiUrl?: string;
    token?: string;
    refreshInterval?: number;
}
export declare function useFeatureFlags(flagNames: string[], options?: UseFeatureFlagsOptions): {
    isEnabled: (flagName: string) => boolean;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
};
/**
 * Hook for evaluating a single feature flag
 */
export declare function useFeatureFlag(flagName: string, options?: UseFeatureFlagsOptions): {
    enabled: boolean;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
};
/**
 * Hook for conditional rendering based on feature flags
 */
export declare function useFeatureFlagComponent(flagName: string, options?: UseFeatureFlagsOptions): {
    enabled: boolean;
    isLoading: boolean;
    error: string | null;
    render: (children: React.ReactNode) => import("react").ReactNode;
    renderIf: (condition: boolean, children: React.ReactNode) => import("react").ReactNode;
};
export default useFeatureFlags;
