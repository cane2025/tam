/**
 * Feature Flag Management Component
 * Admin interface for managing feature flags
 */

import React, { useState, useEffect, useCallback } from 'react';
// useFeatureFlags not used in this component

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetUsers: string[];
  targetRoles: string[];
  environment: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  metadata: Record<string, unknown>;
}

interface FeatureFlagManagerProps {
  apiUrl?: string;
  token?: string;
}

const FeatureFlagManager: React.FC<FeatureFlagManagerProps> = ({ 
  apiUrl = '/api', 
  token 
}) => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [_selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [_showCreateForm, setShowCreateForm] = useState(false);

  const fetchFlags = useCallback(async () => {
    if (!token) return;

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
      } else {
        throw new Error(result.message || 'Failed to fetch flags');
      }
    } catch (error) {
      console.error('Failed to fetch feature flags:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token]);

  const updateFlag = async (flagName: string, updates: Partial<FeatureFlag>) => {
    if (!token) return;

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
        setFlags(prev => prev.map(flag => 
          flag.name === flagName ? { ...flag, ...updates } : flag
        ));
        setSelectedFlag(null);
      } else {
        throw new Error(result.message || 'Failed to update flag');
      }
    } catch (error) {
      console.error('Failed to update feature flag:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  useEffect(() => {
    fetchFlags();
  }, [token, fetchFlags]);

  const toggleFlag = (flagName: string, enabled: boolean) => {
    updateFlag(flagName, { enabled });
  };

  const updateRolloutPercentage = (flagName: string, percentage: number) => {
    updateFlag(flagName, { rolloutPercentage: percentage });
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Laddar feature flags...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: '#ff3b30' }}>
        <p>Fel vid hämtning av feature flags: {error}</p>
        <button 
          onClick={fetchFlags}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007aff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Försök igen
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: 0, color: '#111111' }}>Feature Flags</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#16a34a',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Skapa ny flagga
        </button>
      </div>

      <div style={{
        display: 'grid',
        gap: '16px',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'
      }}>
        {flags.map(flag => (
          <div
            key={flag.id}
            style={{
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: '8px',
              padding: '16px',
              backgroundColor: '#fff'
            }}
          >
            <div style={{ marginBottom: '12px' }}>
              <h3 style={{ 
                margin: '0 0 8px 0', 
                color: '#111111',
                fontSize: '16px'
              }}>
                {flag.name}
              </h3>
              <p style={{ 
                margin: '0 0 12px 0', 
                color: '#374151',
                fontSize: '14px'
              }}>
                {flag.description}
              </p>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                color: '#111111'
              }}>
                <input
                  type="checkbox"
                  checked={flag.enabled}
                  onChange={(e) => toggleFlag(flag.name, e.target.checked)}
                  style={{ transform: 'scale(1.2)' }}
                />
                Aktiverad
              </label>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ 
                display: 'block',
                fontSize: '14px',
                color: '#111111',
                marginBottom: '4px'
              }}>
                Rollout: {flag.rolloutPercentage}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={flag.rolloutPercentage}
                onChange={(e) => updateRolloutPercentage(flag.name, parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ 
              fontSize: '12px', 
              color: '#6b7280',
              borderTop: '1px solid rgba(0,0,0,0.12)',
              paddingTop: '8px'
            }}>
              <div>Miljö: {flag.environment}</div>
              <div>Skapad: {new Date(flag.createdAt).toLocaleDateString('sv-SE')}</div>
              {flag.expiresAt && (
                <div>Utgår: {new Date(flag.expiresAt).toLocaleDateString('sv-SE')}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {flags.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          color: '#6b7280'
        }}>
          <p>Inga feature flags hittades.</p>
        </div>
      )}
    </div>
  );
};

export default FeatureFlagManager;
