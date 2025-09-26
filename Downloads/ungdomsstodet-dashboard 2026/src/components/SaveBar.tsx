import { useState, useEffect, useCallback } from 'react';
import { AppState, Toast, ToastType } from '../types';
import { setStoredData, getStorageType } from '../storage';

interface SaveBarProps {
  state: AppState;
  onSaveComplete?: (success: boolean) => void;
}

interface ToastNotificationProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

function ToastNotification({ toast, onRemove }: ToastNotificationProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const bgColor = {
    success: '#16a34a',
    error: '#ff3b30',
    info: '#007aff'
  }[toast.type];

  return (
    <div
      style={{
        background: bgColor,
        color: '#ffffff',
        padding: '12px 16px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        minWidth: '300px',
        animation: 'slideInUp 0.3s ease-out',
        fontSize: '14px',
        fontWeight: '600'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{getToastIcon(toast.type)}</span>
        <span>{toast.message}</span>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#ffffff',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '4px',
          opacity: 0.8,
          fontSize: '16px',
          lineHeight: 1
        }}
        aria-label="Stäng meddelande"
      >
        ×
      </button>
    </div>
  );
}

function getToastIcon(type: ToastType): string {
  switch (type) {
    case 'success': return '✓';
    case 'error': return '✗';
    case 'info': return 'ℹ';
    default: return '';
  }
}

export default function SaveBar({ state, onSaveComplete }: SaveBarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<number | null>(null);

  const addToast = useCallback((message: string, type: ToastType, duration = 3000) => {
    const toast: Toast = {
      id: crypto.randomUUID(),
      message,
      type,
      duration
    };
    setToasts(prev => [...prev, toast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const saveData = useCallback(async () => {
    setIsSaving(true);
    
    try {
      // Lägg till timestamp för senaste uppdatering
      const stateToSave = {
        ...state,
        lastBackup: new Date().toLocaleString('sv-SE')
      };

      const dataString = JSON.stringify(stateToSave);
      const success = setStoredData(dataString);
      
      if (success) {
        setLastSaved(new Date().toLocaleString('sv-SE'));
        addToast('Sparat', 'success');
      } else {
        addToast('Kunde inte spara – ändringar finns lokalt (minnes-läge)', 'error', 5000);
      }
      
      onSaveComplete?.(success);
    } catch (error) {
      console.error('Save failed:', error);
      addToast('Fel vid sparande', 'error');
      onSaveComplete?.(false);
    } finally {
      setIsSaving(false);
    }
  }, [state, addToast, onSaveComplete]);

  // Auto-save med debounce
  useEffect(() => {
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    const timeout = setTimeout(() => {
      saveData();
    }, 400); // 400ms debounce

    setAutoSaveTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [state]); // Triggas när state ändras

  // Cleanup timeout vid unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    };
  }, [autoSaveTimeout]);

  const storageType = getStorageType();
  const isMemoryMode = storageType === 'Minne';

  return (
    <>
      {/* Toast container */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: 'none'
        }}
      >
        {toasts.map(toast => (
          <div key={toast.id} style={{ pointerEvents: 'auto' }}>
            <ToastNotification toast={toast} onRemove={removeToast} />
          </div>
        ))}
      </div>

      {/* Memory mode banner */}
      {isMemoryMode && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            background: '#ff9500',
            color: '#ffffff',
            padding: '8px',
            textAlign: 'center',
            fontSize: '12px',
            fontWeight: '600',
            zIndex: 9999,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          ⚠️ Kunde inte spara – ändringar finns lokalt (minnes-läge). Data försvinner vid siduppdatering.
        </div>
      )}

      {/* Sticky save bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#ffffff',
          borderTop: '1px solid rgba(0,0,0,0.12)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          zIndex: 1000,
          boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
          minHeight: '56px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#6b7280' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Lagring:</span>
            <span style={{ fontWeight: '600', color: isMemoryMode ? '#ff9500' : '#16a34a' }}>
              {storageType}
            </span>
          </div>
          {lastSaved && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Senast sparat:</span>
              <span style={{ fontWeight: '600', color: '#111111' }}>{lastSaved}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isSaving && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280', fontSize: '12px' }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  border: '2px solid #e5e7eb',
                  borderTop: '2px solid #007aff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}
              />
              <span>Sparar...</span>
            </div>
          )}
          
          <button
            onClick={saveData}
            disabled={isSaving}
            style={{
              background: '#007aff',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,122,255,0.2)'
            }}
            onMouseOver={(e) => {
              if (!isSaving) {
                e.currentTarget.style.background = '#0051d5';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,122,255,0.3)';
              }
            }}
            onMouseOut={(e) => {
              if (!isSaving) {
                e.currentTarget.style.background = '#007aff';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,122,255,0.2)';
              }
            }}
          >
            {isSaving ? 'Sparar...' : 'Spara'}
          </button>
        </div>
      </div>

      {/* CSS animations inline */}
      <style>
        {`
          @keyframes slideInUp {
            from {
              transform: translateY(100%);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
          
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </>
  );
}
