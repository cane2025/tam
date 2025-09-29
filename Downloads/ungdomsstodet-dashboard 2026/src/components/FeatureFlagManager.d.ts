/**
 * Feature Flag Management Component
 * Admin interface for managing feature flags
 */
import React from 'react';
interface FeatureFlagManagerProps {
    apiUrl?: string;
    token?: string;
}
declare const FeatureFlagManager: React.FC<FeatureFlagManagerProps>;
export default FeatureFlagManager;
