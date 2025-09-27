import { useEffect, useMemo, useState, useRef } from "react";
import { AppState, DocStatus, WeekId, MonthId, Staff, Client, Plan, GFPPlan, WeeklyDoc, MonthlyReport, VismaWeek, View, HistoryEntry } from "./types";
import { getStoredData, getBackups, getStorageType } from "./storage";
import { getCurrentWeek, getCurrentMonth, addWeeks, addMonths, addDaysISO, todayYMD } from "./date";
import SaveBar from "./components/SaveBar";
import StaffSummary from "./components/StaffSummary";
import GroupAttendanceWidget from "./components/GroupAttendanceWidget";

// NEW: UI Tokens for consistent styling
const UI_TOKENS = {
  colors: {
    primary: '#007aff',
    orange: '#ff9500',
    red: '#ff3b30',
    green: '#16a34a',
    textPrimary: '#111111',
    textSecondary: '#374151',
    border: 'rgba(0,0,0,0.12)',
    sidebarActive: '#e9f2ff'
  },
  inputBase: {
    padding: '8px 12px',
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: '#ffffff',
    color: '#111111'
  },
  selectBase: {
    padding: '8px 12px',
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: '#ffffff',
    color: '#111111'
  },
  textareaBase: {
    padding: '8px 12px',
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: '#ffffff',
    color: '#111111',
    resize: 'vertical' as const
  }
};

// NEW: Central status label mapping
const STATUS_LABEL: Record<DocStatus, string> = {
  approved: 'Godkänd',
  pending: 'Väntar', 
  rejected: 'Ej godkänt/komplettera'
};

// NEW: Debounce helper for note saving
function debounceNote(fn: (noteValue: string) => void, ms: number = 500): (noteValue: string) => void {
  let timeoutId: number;
  return (noteValue: string) => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(noteValue), ms);
  };
}

// NEW: Period-based data persistence helpers with proper isolation
const PERIOD_DATA_PREFIX = 'us:';

function getPeriodKey(clientId: string, periodType: 'weekly' | 'monthly', periodId: string): string {
  return `${PERIOD_DATA_PREFIX}${clientId}:${periodType}:${periodId}`;
}

function savePeriodData(clientId: string, periodType: 'weekly' | 'monthly', periodId: string, data: WeeklyDoc | MonthlyReport): void {
  try {
    const key = getPeriodKey(clientId, periodType, periodId);
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn(`Failed to save ${periodType} data for ${clientId}:${periodId}:`, error);
  }
}

function loadPeriodData<T extends WeeklyDoc | MonthlyReport>(
  clientId: string, 
  periodType: 'weekly' | 'monthly', 
  periodId: string, 
  defaultData: T
): T {
  try {
    const key = getPeriodKey(clientId, periodType, periodId);
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as T;
      return { ...defaultData, ...parsed };
    }
  } catch (error) {
    console.warn(`Failed to load ${periodType} data for ${clientId}:${periodId}:`, error);
  }
  return defaultData;
}

// NEW: Cleanup orphaned period data for clients that no longer exist (but preserve archived clients' history and us:history)
function cleanupClientLocalStorage(allClientIds: Set<string>): void {
  try {
    const keysToRemove: string[] = [];
    
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
  } catch (error) {
    console.warn('Failed to cleanup orphaned period data:', error);
  }
}

// NEW: Get all client IDs from state (including archived ones to preserve history)
function getAllClientIds(state: AppState): Set<string> {
  const clientIds = new Set<string>();
  state.staff.forEach(staff => {
    staff.clients.forEach(client => {
      clientIds.add(client.id);
    });
  });
  return clientIds;
}

// NEW: History management functions
const HISTORY_KEY = 'us:history';

function loadHistory(): HistoryEntry[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      return JSON.parse(stored) as HistoryEntry[];
    }
  } catch (error) {
    console.warn('Failed to load history:', error);
  }
  return [];
}

function saveHistory(history: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.warn('Failed to save history:', error);
  }
}

function upsertHistory(entry: Omit<HistoryEntry, 'id' | 'ts'>): void {
  const history = loadHistory();
  const now = new Date().toISOString();
  
  // Create unique key for idempotency (commented out as not used in current implementation)
  // const key = `${entry.periodType}:${entry.periodId}:${entry.staffId}:${entry.clientId}:${entry.metric}`;
  
  // Find existing entry
  const existingIndex = history.findIndex(h => 
    h.periodType === entry.periodType &&
    h.periodId === entry.periodId &&
    h.staffId === entry.staffId &&
    h.clientId === entry.clientId &&
    h.metric === entry.metric
  );
  
  const newEntry: HistoryEntry = {
    id: existingIndex >= 0 ? history[existingIndex]!.id : crypto.randomUUID(),
    ...entry,
    ts: now
  };
  
  if (existingIndex >= 0) {
    // Update existing entry
    history[existingIndex] = newEntry;
  } else {
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
function retentionSweep(cutoffDays: number): { 
  toRemove: Array<{ type: 'client' | 'plan' | 'weeklyDoc' | 'monthlyReport' | 'vismaWeek'; 
                   id: string; 
                   staffId: string; 
                   clientId?: string; 
                   data: Client | GFPPlan | WeeklyDoc | MonthlyReport | VismaWeek; 
                   deletedAt: string }>;
  cutoffDate: string;
} {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);
  const cutoffISO = cutoffDate.toISOString();
  
  const toRemove: Array<{ type: 'client' | 'plan' | 'weeklyDoc' | 'monthlyReport' | 'vismaWeek'; 
                         id: string; 
                         staffId: string; 
                         clientId?: string; 
                         data: Client | GFPPlan | WeeklyDoc | MonthlyReport | VismaWeek; 
                         deletedAt: string }> = [];
  
  // Scan all staff and clients for old archived/deleted items
  const currentState = loadState();
  const allStaff: Staff[] = currentState?.staff || [];
  
  allStaff.forEach((staff: Staff) => {
    staff.clients.forEach((client: Client) => {
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
      } else if (client.deletedAt && client.deletedAt < cutoffISO) {
        toRemove.push({
          type: 'client',
          id: client.id,
          staffId: staff.id,
          clientId: client.id,
          data: client,
          deletedAt: client.deletedAt
        });
      } else {
        // Check individual items within active clients
        // GFP Plans
        client.plans.forEach((plan: GFPPlan) => {
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
        Object.values(client.weeklyDocs).forEach((doc: WeeklyDoc) => {
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
        Object.values(client.monthlyReports).forEach((report: MonthlyReport) => {
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
        Object.values(client.visma).forEach((visma: VismaWeek) => {
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

function exportToJSON(data: unknown[], filename: string): void {
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

function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return;
  
  const firstRow = data[0];
  if (!firstRow) return;
  
  const headers = Object.keys(firstRow);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape CSV values
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
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
function countClientData(client: Client): { plans: number; weeks: number; months: number } {
  return {
    plans: client.plans.length,
    weeks: Object.keys(client.weeklyDocs).length,
    months: Object.keys(client.monthlyReports).length
  };
}

function countStaffData(staff: Staff): { clients: number; totalPlans: number; totalWeeks: number; totalMonths: number } {
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

// NEW: Enhanced ConfirmDialog component with impact summary
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  impactSummary?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ open, title, description, impactSummary, onConfirm, onCancel }: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Autofokus på "Ta bort"-knappen när dialog öppnas
  useEffect(() => {
    if (open && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [open]);

  // Keyboard handling
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter') {
      onConfirm();
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16
      }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          padding: 24,
          maxWidth: 450,
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid rgba(0, 0, 0, 0.1)'
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <h3
          id="confirm-dialog-title"
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: '#111827',
            margin: '0 0 12px 0',
            lineHeight: 1.4
          }}
        >
          {title}
        </h3>
        
        <p
          id="confirm-dialog-description"
          style={{
            fontSize: 14,
            color: '#374151',
            margin: '0 0 16px 0',
            lineHeight: 1.5
          }}
        >
          {description}
        </p>
        
        {impactSummary && (
          <div
            style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: 8,
              padding: 12,
              margin: '0 0 24px 0'
            }}
          >
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#92400e',
              marginBottom: 4
            }}>
              Detta påverkar:
            </div>
            <div style={{
              fontSize: 14,
              color: '#92400e',
              lineHeight: 1.4
            }}>
              {impactSummary}
            </div>
          </div>
        )}
        
        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'flex-end'
          }}
        >
          <button
            onClick={onCancel}
            style={{
              background: '#f8fafc',
              color: '#374151',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#e2e8f0';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }}
          >
            Avbryt
          </button>
          
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            style={{
              background: '#ff3b30',
              color: '#ffffff',
              border: '1px solid #ff3b30',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#e53e3e';
              e.currentTarget.style.borderColor = '#e53e3e';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#ff3b30';
              e.currentTarget.style.borderColor = '#ff3b30';
            }}
          >
            Ta bort
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- GFP Plan Helper Functions ---------- */
function nextGfpTitle(plans: GFPPlan[]): string { 
  return `GFP ${plans.length + 1}`; 
}

function latestPlan(plans: GFPPlan[] | undefined): GFPPlan | undefined {
  if (!plans || plans.length === 0) return undefined;
  // Filter out soft-deleted plans and return the first (newest) active plan
  const activePlans = plans.filter(p => !p.deletedAt);
  return activePlans[0]; // Nyaste först
}

/**
 * Ungdomsstöd Admin – Komplett version
 * - LocalStorage + fallback till minne
 * - Export/Import (fil + clipboard, med fallback)
 * - Automatisk backup (senaste 7)
 * - Dashboard, KPI:er, Personal, Klient, Rapporter, Inställningar
 * - Inline-styles (medveten designbeslut för enkelhet och portabilitet)
 * - Typ-säkring vid import
 * - SaveBar med auto-save och toast-meddelanden
 * - Responsiv klientvy med accordion på mobil
 * 
 * NOTE: Inline-styles används medvetet enligt projektreglerna.
 * Webhint-varningar om "no-inline-styles" kan ignoreras.
 */

/* ---------- Helper Components ---------- */

// StatusPill Component
interface StatusPillProps {
  status: DocStatus;
  size?: 'small' | 'medium';
}

function StatusPill({ status, size = 'small' }: StatusPillProps) {
  const colors = {
    approved: '#16a34a',
    pending: '#ff9500', 
    rejected: '#ff3b30'
  };
  
  // UPDATED: Use central STATUS_LABEL mapping instead of local labels
  const pillSize = size === 'small' ? { padding: '2px 8px', fontSize: '11px' } : { padding: '4px 12px', fontSize: '12px' };
  
  return (
    <span style={{
      ...pillSize,
      background: colors[status],
      color: '#ffffff',
      borderRadius: '12px',
      fontWeight: '600',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
      display: 'inline-block',
      whiteSpace: 'nowrap' as const
    }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// Card Component  
interface CardProps {
  title: string;
  status?: DocStatus;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function Card({ title, status, headerActions, children }: CardProps) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid rgba(0,0,0,0.12)',
      borderRadius: 14,
      padding: 12,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      height: 'fit-content'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        flexWrap: 'wrap',
        gap: 8
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{title}</div>
          {status && <StatusPill status={status} />}
        </div>
        {headerActions && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {headerActions}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// Accordion Component
interface AccordionProps {
  sections: Array<{
    id: string;
    title: string;
    status?: DocStatus;
    headerActions?: React.ReactNode;
    children: React.ReactNode;
  }>;
}

function Accordion({ sections }: AccordionProps) {
  const [openSection, setOpenSection] = useState<string | null>(sections[0]?.id || null);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sections.map((section) => {
        const isOpen = openSection === section.id;
        return (
          <div key={section.id} style={{
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}>
            <button
              onClick={() => setOpenSection(isOpen ? null : section.id)}
              style={{
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
              }}
              aria-expanded={isOpen}
              aria-controls={`accordion-content-${section.id}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{section.title}</span>
                {section.status && <StatusPill status={section.status} />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {section.headerActions}
                <svg 
                  width={16} 
                  height={16} 
                  viewBox="0 0 24 24" 
                  style={{ 
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}
                  aria-hidden="true"
                >
                  <path d="M7 10l5 5 5-5" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </button>
            {isOpen && (
              <div 
                id={`accordion-content-${section.id}`}
                style={{ padding: '0 16px 16px 16px' }}
              >
                {section.children}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// PeriodPicker Component - Navigation för veckor och månader
interface PeriodPickerProps {
  type: 'week' | 'month';
  value: string;
  onChange: (newValue: string) => void;
}

function PeriodPicker({ type, value, onChange }: PeriodPickerProps) {
  const goBack = () => {
    if (type === 'week') {
      onChange(addWeeks(value, -1));
    } else {
      onChange(addMonths(value, -1));
    }
  };

  const goForward = () => {
    if (type === 'week') {
      onChange(addWeeks(value, 1));
    } else {
      onChange(addMonths(value, 1));
    }
  };

  const goToCurrent = () => {
    if (type === 'week') {
      onChange(getCurrentWeek());
    } else {
      onChange(getCurrentMonth());
    }
  };

  const inputWidth = type === 'week' ? 92 : 92;
  const placeholder = type === 'week' ? 'YYYY-WXX' : 'YYYY-MM';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        onClick={goBack}
        style={{
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
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = '#e2e8f0';
          e.currentTarget.style.borderColor = '#007aff';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = '#f8fafc';
          e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)';
        }}
        aria-label={`Föregående ${type === 'week' ? 'vecka' : 'månad'}`}
      >
        ◀
      </button>
      
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ 
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
        }}
        aria-label={`${type === 'week' ? 'Vecka' : 'Månad'} input`}
      />
      
      <button
        onClick={goForward}
        style={{
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
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = '#e2e8f0';
          e.currentTarget.style.borderColor = '#007aff';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = '#f8fafc';
          e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)';
        }}
        aria-label={`Nästa ${type === 'week' ? 'vecka' : 'månad'}`}
      >
        ▶
      </button>
      
      <button
        onClick={goToCurrent}
        style={{
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
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = '#0051d5';
          e.currentTarget.style.borderColor = '#0051d5';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = '#007aff';
          e.currentTarget.style.borderColor = '#007aff';
        }}
      >
        Nu
      </button>
    </div>
  );
}


// DayMatrix Component - Kompakt dagmatris för vecko- och Visma-data
interface DayMatrixProps {
  days: Record<string, boolean>;
  weekId: WeekId;
  onChange: (day: string, checked: boolean) => void;
  type: 'weekly' | 'visma';
}

function DayMatrix({ days, weekId, onChange, type }: DayMatrixProps) {
  // Dag-etiketter och ordning
  const dayLabels = type === 'weekly' 
    ? ['må', 'ti', 'on', 'to', 'fr', 'lö', 'sö']
    : ['må', 'ti', 'on', 'to', 'fr']; // Visma bara vardagar
    
  const dayKeys = type === 'weekly'
    ? ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    : ['mon', 'tue', 'wed', 'thu', 'fri'];

  // Beräkna verkliga datum för tooltips
  const getDateForDay = (dayIndex: number): string => {
    try {
      // Parse ISO week: YYYY-Wxx
      const match = weekId.match(/^(\d{4})-W(\d{2})$/);
      if (!match) return '';
      
      const year = parseInt(match[1]!, 10);
      const week = parseInt(match[2]!, 10);
      
      // Skapa måndagen för den veckan
      const jan4 = new Date(year, 0, 4);
      const startOfYear = new Date(jan4.getTime() - (jan4.getDay() - 1) * 24 * 60 * 60 * 1000);
      const monday = new Date(startOfYear.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
      
      // Lägg till dagar för att få rätt dag
      const targetDate = new Date(monday.getTime() + dayIndex * 24 * 60 * 60 * 1000);
      
      return targetDate.toLocaleDateString('sv-SE');
    } catch {
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

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Dagmatris */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: `repeat(${dayLabels.length}, 1fr)`, 
        gap: 4, 
        marginBottom: 8,
        maxWidth: 280
      }}>
        {dayLabels.map((label, index) => {
          const dayKey = dayKeys[index]!;
          const isChecked = days[dayKey] || false;
          const dateStr = getDateForDay(index);
          const tooltip = `${label} ${dateStr} (${weekId})`;
          
          return (
            <label 
              key={dayKey}
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: 3,
                cursor: 'pointer',
                padding: 2
              }}
              title={tooltip}
            >
              <div style={{ 
                fontSize: 11, 
                fontWeight: 600, 
                color: '#374151',
                lineHeight: 1
              }}>
                {label}
              </div>
              <div style={{
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
              }}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => onChange(dayKey, e.target.checked)}
                  style={{
                    width: 16,
                    height: 16,
                    cursor: 'pointer',
                    accentColor: '#007aff'
                  }}
                  aria-label={tooltip}
                />
              </div>
            </label>
          );
        })}
      </div>
      
      {/* Knapprad */}
      <div style={{ 
        display: 'flex', 
        gap: 6, 
        flexWrap: 'wrap',
        alignItems: 'center' 
      }}>
        <button
          onClick={markWorkDays}
          style={{
            background: '#f0f7ff',
            color: '#007aff',
            border: '1px solid #007aff',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#007aff';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#f0f7ff';
            e.currentTarget.style.color = '#007aff';
          }}
        >
          Markera arbetsdagar
        </button>
        
        <button
          onClick={clearAll}
          style={{
            background: '#f8fafc',
            color: '#6b7280',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#fee2e2';
            e.currentTarget.style.color = '#dc2626';
            e.currentTarget.style.borderColor = '#fecaca';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#f8fafc';
            e.currentTarget.style.color = '#6b7280';
            e.currentTarget.style.borderColor = '#e5e7eb';
          }}
        >
          Rensa alla
        </button>
      </div>

      {/* Tomt-läge meddelande */}
      {!hasSelectedDays && (
        <div style={{
          fontSize: 11,
          color: '#9ca3af',
          textAlign: 'center',
          fontStyle: 'italic',
          marginTop: 8,
          padding: '4px 8px'
        }}>
          {type === 'weekly' 
            ? 'Ingen dokumentation vald denna vecka' 
            : 'Ingen tid registrerad denna vecka'
          }
        </div>
      )}
    </div>
  );
}

// KPI Card Component
type KpiVariant = 'late' | 'waiting' | 'info' | 'neutral' | 'success';

const KPI_COLORS: Record<KpiVariant, {accent: string; text: string; bg: string;}> = {
  late:    { accent: '#ff3b30', text: '#111827', bg: 'rgba(255,59,48,0.06)' },
  waiting: { accent: '#ff9500', text: '#111827', bg: 'rgba(255,149,0,0.06)' },
  info:    { accent: '#007aff', text: '#111827', bg: 'rgba(0,122,255,0.06)' },
  success: { accent: '#16a34a', text: '#111827', bg: 'rgba(22,163,74,0.06)' },
  neutral: { accent: '#6b7280', text: '#111827', bg: 'rgba(107,114,128,0.06)' },
};

interface KpiCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  variant?: KpiVariant;
  icon?: React.ReactNode;
}

function KpiCard({ title, value, subtitle, variant = 'info', icon }: KpiCardProps) {
  const c = KPI_COLORS[variant];
  return (
    <div 
      className={`kpi-card kpi-${variant}`}
      style={{
        ...card(),
        display: 'flex',
        gap: ui.gap,
        alignItems: 'center',
        minHeight: 82
      }}>
      <div style={{
        background: c.bg,
        width: 36,
        height: 36,
        minWidth: 36,
        borderRadius: 10,
        display: 'grid',
        placeItems: 'center'
      }}>
        {icon || (
          <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill={c.accent} opacity={0.9} />
          </svg>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#374151', fontSize: 12, fontWeight: 600 }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ color: c.text, fontSize: 26, fontWeight: 700 }}>{value}</div>
          {subtitle && (
            <div style={{ color: '#6b7280', fontSize: 12 }}>{subtitle}</div>
          )}
        </div>
      </div>
      <div style={{ width: 6, alignSelf: 'stretch', borderRadius: 6, background: c.accent, opacity: 0.18 }} />
    </div>
  );
}

// Typer importeras nu från types.ts

/* ---------- Utils ---------- */
function formatDateTime(): string {
  return new Date().toLocaleString("sv-SE");
}

function compareWeekId(a: WeekId, b: WeekId): number {
  const [ya, wa] = a.split("-W");
  const [yb, wb] = b.split("-W");
  if (ya !== yb) return Number(ya) - Number(yb);
  return Number(wa) - Number(wb);
}

function compareMonthId(a: MonthId, b: MonthId): number {
  return a.localeCompare(b);
}

/* ---------- Lagring ---------- */
function loadState(): AppState | undefined {
  try {
    const raw = getStoredData();
    if (raw) {
      const state = JSON.parse(raw) as AppState;
      
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
              const legacyPlan: GFPPlan = {
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
  } catch (error) {
    console.warn("Failed to load state:", error);
  }
  return undefined;
}

// SaveBar hanterar nu sparning automatiskt med debounce

/* ---------- Init-data ---------- */
function newClient(name: string): Client {
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

function initialState(): AppState {
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
function exportToFile(state: AppState): void {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ungdomsstod_export_${todayYMD()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToClipboard(state: AppState): void {
  const data = btoa(JSON.stringify(state));
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(data).then(
      () => alert("Data kopierat! Dela med kollega via email/chat."),
      () => fallback()
    );
  } else {
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
    } catch {
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
function card(): React.CSSProperties {
  return {
    background: ui.bg,
    border: `1px solid ${ui.border}`,
    borderRadius: ui.radius,
    padding: ui.pad,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
  };
}

function row(gap = ui.gap): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap
  };
}

function col(gap = ui.gap): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap
  };
}

function pill(status: 'approved' | 'pending' | 'rejected' | 'late' | 'info'): React.CSSProperties {
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
const inputBase: React.CSSProperties = {
  background: '#ffffff',
  color: C.text,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: '8px 10px',
  outline: 'none',
  boxShadow: '0 1px 1px rgba(0,0,0,0.02)'
};

const inputSmall: React.CSSProperties = {
  ...inputBase,
  borderRadius: 6,
  padding: '4px 8px'
};

const selectBase: React.CSSProperties = {
  ...inputSmall,
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  backgroundImage:
    'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\'><path d=\'M4 6l4 4 4-4\' stroke=\'%236b7280\' stroke-width=\'2\' fill=\'none\' stroke-linecap=\'round\'/></svg>")',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  paddingRight: 28
} as React.CSSProperties;

const textareaBase: React.CSSProperties = {
  ...inputBase,
  minHeight: 80,
  resize: 'vertical'
};

// NEW: Helper functions for consistent contrast styling
const navItemStyle = (active: boolean): React.CSSProperties => ({
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

const listItemStyle = (selected: boolean): React.CSSProperties => ({
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

const nameStyle: React.CSSProperties = { fontWeight: 600, color: ui.text };
const metaStyle: React.CSSProperties = { fontSize: 12, color: ui.textMute };

const app: React.CSSProperties = {
  display: "flex",
  height: "100vh",
  minWidth: 280,
  background: "#f5f7fb",
  fontFamily: "system-ui, -apple-system, sans-serif"
};

const sidebar: React.CSSProperties = {
  width: 280,
  minWidth: 240,
  background: C.sidebarBg,
  color: C.text,              // 🔥 säkerställ mörk text
  borderRight: `1px solid ${C.border}`,
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12
};

// REMOVED: Legacy navItem function replaced by navItemStyle with better contrast

const main: React.CSSProperties = {
  flex: 1,
  padding: 16,
  paddingBottom: 80, // Utrymme för SaveBar
  overflow: "auto"
};

const headerBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 14
};

const title: React.CSSProperties = { fontSize: 20, fontWeight: 800 };

const gridTwo: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 12,
  marginBottom: 12
};

const gridThree: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 12
};

// Legacy card constant removed - use card() helper instead

const cardHeader: React.CSSProperties = {
  ...row(),
  justifyContent: "space-between",
  marginBottom: 8
};

const btn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  background: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s"
};

const primaryBtn: React.CSSProperties = {
  ...btn,
  background: C.blue,
  color: C.white,
  borderColor: C.blue
};

// smallBtn style removed - now using PeriodPicker component

/* ---------- Småkomponenter ---------- */
function Sparkline({ points }: { points: number[] }) {
  if (!points.length) return null;
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
  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      <path d={d} fill="none" stroke={C.blue} strokeWidth={2} />
      <circle cx={W} cy={H - ((points[points.length - 1]! - min) / range) * H} r={3} fill={C.blue} />
    </svg>
  );
}

function Donut({ pct }: { pct: number }) {
  const size = 120;
  const stroke = 12;
  const R = (size - stroke) / 2;
  const CIRC = 2 * Math.PI * R;
  const off = CIRC * (1 - Math.max(0, Math.min(1, pct)));
  return (
    <svg width={size} height={size}>
      <g transform={`translate(${size / 2},${size / 2})`}>
        <circle r={R} fill="none" stroke="#eef2f7" strokeWidth={stroke} />
        <circle
          r={R}
          fill="none"
          stroke={C.blue}
          strokeWidth={stroke}
          strokeDasharray={`${CIRC} ${CIRC}`}
          strokeDashoffset={off}
          transform="rotate(-90)"
          strokeLinecap="round"
        />
        <text y="6" textAnchor="middle" fontWeight="800" fontSize="20">
          {Math.round(pct * 100)}%
        </text>
      </g>
    </svg>
  );
}


/* ---------- Views ---------- */
function Overview({ state, kpis }: { state: AppState; kpis: Record<string, number> }) {
    const overviewSamples = useMemo(() => {
    const weeklyByWeek: Record<string, number> = {};
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
        if (c.archivedAt || c.deletedAt) return;
        
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
    const totalDocs = allHistory.length + state.staff.reduce(
      (sum, st) =>
        sum +
        st.clients.reduce(
          (cSum, c) => {
            // Skip archived and soft-deleted clients
            if (c.archivedAt || c.deletedAt) return cSum;
            // Only count current period docs from active clients
            let count = 0;
            Object.entries(c.weeklyDocs).forEach(([weekId]) => {
              if (compareWeekId(weekId, currentWeekForDocs) >= 0) count++;
            });
            Object.entries(c.monthlyReports).forEach(([monthId]) => {
              if (compareMonthId(monthId, currentMonthForDocs) >= 0) count++;
            });
            return cSum + count;
          },
          0
        ),
      0
    );

    // Count approved docs from history + current active clients
    const approvedFromHistory = allHistory.filter(h => h.status === 'approved').length;
    const approvedFromCurrent = state.staff.reduce(
      (sum, st) =>
        sum +
        st.clients.reduce(
          (cSum, c) => {
            // Skip archived and soft-deleted clients
            if (c.archivedAt || c.deletedAt) return cSum;
            let count = 0;
            Object.values(c.weeklyDocs).forEach(doc => {
              if (doc.status === "approved" && compareWeekId(doc.weekId, currentWeekForDocs) >= 0) count++;
            });
            Object.values(c.monthlyReports).forEach(report => {
              if (report.status === "approved" && compareMonthId(report.monthId, currentMonthForDocs) >= 0) count++;
            });
            return cSum + count;
          },
          0
        ),
      0
    );
    
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

  return (
    <div data-print-scope="personal-dashboard">
      <div style={headerBar}>
        <div style={title}>Vårdadmin – Dashboard</div>
        {/* PRINT NEW: Print button */}
        <button
          onClick={handlePrint}
          data-print-keep
          style={{
            background: '#007aff',
            color: '#ffffff',
            border: '1px solid #007aff',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#0051d5';
            e.currentTarget.style.borderColor = '#0051d5';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#007aff';
            e.currentTarget.style.borderColor = '#007aff';
          }}
        >
          🖨️ Skriv ut
        </button>
      </div>

      <div style={gridTwo}>
        <div style={card()}>
          <div style={cardHeader}>
            <div style={{ fontWeight: 800 }}>Vårdplaner - Status</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.green }}>{kpis.totalPlansActive}</div>
              <div style={{ fontSize: 12, color: C.textLight }}>Aktiva med GFP</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.orange }}>{kpis.waitingPlan}</div>
              <div style={{ fontSize: 12, color: C.textLight }}>Inväntar</div>
            </div>
          </div>
        </div>

        <div style={card()}>
          <div style={cardHeader}>
            <div style={{ fontWeight: 800 }}>Veckodokumentation</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, color: C.textLight, marginBottom: 6 }}>Godkända per vecka</div>
              <Sparkline points={overviewSamples.series} />
              <div style={{ fontSize: 11, color: C.textLight, marginTop: 4, fontStyle: 'italic' }}>
                Historik inkluderar arkiverade klienter
              </div>
            </div>
            <Donut pct={overviewSamples.quality} />
          </div>
        </div>
      </div>

      <div style={gridThree} className="kpi-grid">
        <KpiCard title="Försenad plan" value={kpis.delayedPlan ?? 0} subtitle="GFP över 21 dagar" variant="late" />
        <KpiCard title="Försenad dokumentation" value={kpis.delayedDocs ?? 0} subtitle="Ej godkända veckor" variant="waiting" />
        <KpiCard title="Denna vecka" value={kpis.completedThisWeek ?? 0} subtitle="Godkända dokument" variant="success" />
        <KpiCard title="Totalt klienter" value={kpis.totalClients ?? 0} subtitle={`${state.staff.length} personal`} variant="neutral" />
        <KpiCard title="Försenad månadsrapport" value={kpis.delayedMonthly ?? 0} variant="info" />
        <KpiCard title="Försenad Visma-tid" value={kpis.delayedVisma ?? 0} variant="info" />
      </div>

      {/* Tuesday Attendance Group Widget */}
      <GroupAttendanceWidget />
    </div>
  );
}

function StaffView({ state, setState, selectedStaff, setView }: { 
  state: AppState; 
  setState: (fn: (prev: AppState) => AppState) => void; 
  selectedStaff: Staff | undefined; 
  setView: (view: View) => void; 
}) {
  const [newStaffName, setNewStaffName] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [staffQuery, setStaffQuery] = useState("");
  
  // NEW: Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    impactSummary?: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    impactSummary: undefined,
    onConfirm: () => {}
  });

  function addStaff(name: string) {
    if (!name.trim()) return;
    setState((p: AppState) => ({
      ...p,
      staff: [...p.staff, { id: crypto.randomUUID(), name: name.trim(), clients: [] }]
    }));
  }

  function removeStaff(id: string) {
    setState((prev: AppState) => {
      const nextStaff = prev.staff.filter(s => s.id !== id);
      const nextSelectedStaffId = prev.selectedStaffId === id ? undefined : prev.selectedStaffId;
      return { ...prev, staff: nextStaff, selectedStaffId: nextSelectedStaffId, selectedClientId: undefined };
    });
  }

  // NEW: Show confirm dialog for staff deletion with impact summary
  function showDeleteStaffConfirm(staff: Staff) {
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

  function addClientToSelected(name: string) {
    if (!selectedStaff || !name.trim()) return;
    setState((prev: AppState) => ({
      ...prev,
      staff: prev.staff.map(s =>
        s.id === selectedStaff.id ? { ...s, clients: [...s.clients, newClient(name.trim())] } : s
      )
    }));
  }

  function softDeleteClient(clientId: string) {
    if (!selectedStaff) return;
    setState((prev: AppState) => ({
      ...prev,
      staff: prev.staff.map(s =>
        s.id === selectedStaff.id ? { 
          ...s, 
          clients: s.clients.map(c => 
            c.id === clientId 
              ? { ...c, deletedAt: new Date().toISOString() }
              : c
          )
        } : s
      ),
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
  function showDeleteClientConfirm(client: Client) {
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

  const filtered = state.staff.filter((s: Staff) => s.name.toLowerCase().includes(staffQuery.toLowerCase()));

  return (
    <div>
      <div style={headerBar}>
        <div style={title}>Personal & Klienter</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 340px) 1fr", gap: 12 }}>
        <div style={card()}>
          <div style={cardHeader}>
            <div style={{ fontWeight: 800 }}>Personal ({state.staff.length})</div>
          </div>

          <input
            placeholder="Sök personal…"
            value={staffQuery}
            onChange={e => setStaffQuery(e.target.value)}
            style={{ ...inputBase, width: '100%', marginBottom: 8 }}
          />

          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input
              placeholder="Namn på ny personal"
              value={newStaffName}
              onChange={e => setNewStaffName(e.target.value)}
              style={{ ...inputBase, flex: 1 }}
            />
            <button style={primaryBtn} onClick={() => { addStaff(newStaffName); setNewStaffName(""); }}>
              Lägg till
            </button>
          </div>

          <div style={{ ...col(6), maxHeight: 400, overflow: "auto" }}>
            {/* NEW: Updated staff list with proper contrast */}
            {filtered.map((s: Staff) => (
              <div
                key={s.id}
                style={listItemStyle(state.selectedStaffId === s.id)}
                onMouseEnter={(e) => {
                  if (state.selectedStaffId !== s.id) {
                    e.currentTarget.style.background = ui.navHoverBg;
                  }
                }}
                onMouseLeave={(e) => {
                  if (state.selectedStaffId !== s.id) {
                    e.currentTarget.style.background = ui.cardBg;
                  }
                }}
              >
                <button
                  style={{ 
                    flex: 1, 
                    textAlign: "left", 
                    border: "none", 
                    background: "transparent", 
                    padding: 0,
                    cursor: 'pointer',
                    color: ui.text
                  }}
                  onClick={() =>
                    setState((prev: AppState) => ({ ...prev, selectedStaffId: s.id, selectedClientId: undefined }))
                  }
                  onFocus={(e) => {
                    e.currentTarget.style.outline = `2px solid ${ui.blue}`;
                    e.currentTarget.style.outlineOffset = '2px';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = 'none';
                  }}
                >
                  <div style={nameStyle}>{s.name}</div>
                  <div style={metaStyle}>{s.clients.filter(c => !c.archivedAt && !c.deletedAt).length} klienter</div>
                </button>
                <button 
                  style={{ ...primaryBtn, fontSize: 12, padding: "4px 8px" }} 
                  onClick={() => { 
                    setState((prev: AppState) => ({ ...prev, selectedStaffId: s.id, selectedClientId: undefined })); 
                    setView("staffDetail"); 
                  }}
                >
                  Dashboard
                </button>
                <button style={{ ...btn, fontSize: 12, padding: "4px 8px" }} onClick={() => showDeleteStaffConfirm(s)}>
                  Ta bort
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={card()}>
          <div style={cardHeader}>
            <div style={{ fontWeight: 800 }}>
              Klienter {selectedStaff ? `– ${selectedStaff.name}` : ""}
            </div>
          </div>
          {!selectedStaff ? (
            <div style={{ color: C.textLight }}>Välj en personal till vänster.</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <input
                  placeholder="Klient initialer (t.ex. AB)"
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  style={{ ...inputBase, flex: 1 }}
                />
                <button style={primaryBtn} onClick={() => { addClientToSelected(newClientName); setNewClientName(""); }}>
                  Lägg till
                </button>
              </div>

              <div style={{ ...col(6), maxHeight: 450, overflow: "auto" }}>
                {/* NEW: Updated client list with proper contrast - only show active clients */}
                {selectedStaff.clients.filter(c => !c.archivedAt && !c.deletedAt).map((c: Client) => (
                  <div
                    key={c.id}
                    style={{
                      ...listItemStyle(state.selectedClientId === c.id),
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      gap: 6,
                      alignItems: "center"
                    }}
                    onMouseEnter={(e) => {
                      if (state.selectedClientId !== c.id) {
                        e.currentTarget.style.background = ui.navHoverBg;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (state.selectedClientId !== c.id) {
                        e.currentTarget.style.background = ui.cardBg;
                      }
                    }}
                  >
                    <button
                      style={{ 
                        textAlign: "left", 
                        border: "none", 
                        background: "transparent", 
                        padding: 0,
                        cursor: 'pointer',
                        color: ui.text
                      }}
                      onClick={() => setState((prev: AppState) => ({ ...prev, selectedClientId: c.id }))}
                      onFocus={(e) => {
                        e.currentTarget.style.outline = `2px solid ${ui.blue}`;
                        e.currentTarget.style.outlineOffset = '2px';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.outline = 'none';
                      }}
                    >
                      <div style={nameStyle}>{c.name}</div>
                      <div style={metaStyle}>
                        Planer: {c.plans.length} • Senaste: {latestPlan(c.plans)?.title || "Ingen"}
                      </div>
                    </button>
                    <button style={primaryBtn} onClick={() => { setState((prev: AppState) => ({ ...prev, selectedClientId: c.id })); setView("client"); }}>
                      Öppna
                    </button>
                    <button style={{ ...btn, fontSize: 12 }} onClick={() => showDeleteClientConfirm(c)}>
                      Ta bort
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* NEW: Confirm dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        impactSummary={confirmDialog.impactSummary}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
}

/* ---------- ClientWork Section Content Components ---------- */

// Veckodokumentation innehåll
function WeeklyDocContent({ weeklyDoc, saveWeeklyDoc, weekIdInput, clientId }: {
  weeklyDoc: WeeklyDoc;
  saveWeeklyDoc: (weekId: WeekId, doc: WeeklyDoc) => void;
  weekIdInput: WeekId;
  clientId: string;
}) {
  const [note, setNote] = useState(weeklyDoc.note || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSaved, setLastSaved] = useState<string>('');
  
  // NEW: Debounced save with period-based storage
  const debouncedSave = useRef(debounceNote((noteValue: string) => {
    const updatedDoc = { ...weeklyDoc, note: noteValue };
    savePeriodData(clientId, 'weekly', weekIdInput, updatedDoc);
    setSaveStatus('saved');
    setLastSaved(new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }));
  }, 500));

  // NEW: Load data when period changes (ensures isolation)
  useEffect(() => {
    const defaultDoc: WeeklyDoc = {
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

  const handleDayChange = (day: string, checked: boolean) => {
    const newDoc = { 
      ...weeklyDoc, 
      days: { ...weeklyDoc.days, [day]: checked },
      lastUpdated: new Date().toISOString()
    };
    saveWeeklyDoc(weekIdInput, newDoc);
    // NEW: Also save to period-based storage
    savePeriodData(clientId, 'weekly', weekIdInput, newDoc);
  };

  const handleNoteChange = (value: string) => {
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

  return (
    <>
      <DayMatrix
        days={weeklyDoc.days}
        weekId={weekIdInput}
        onChange={handleDayChange}
        type="weekly"
      />
      
      <div style={{ ...row(8), flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>Status:</div>
        <select
          value={weeklyDoc.status}
          onChange={(e) => saveWeeklyDoc(weekIdInput, { ...weeklyDoc, status: e.target.value as DocStatus })}
          style={selectBase}
          aria-label="Veckodokumentation status"
        >
          {/* UPDATED: Use STATUS_LABEL for all option labels */}
          <option value="pending">{STATUS_LABEL.pending}</option>
          <option value="approved">{STATUS_LABEL.approved}</option>
          <option value="rejected">{STATUS_LABEL.rejected}</option>
        </select>
      </div>

      {/* NEW: Note section */}
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Notis för veckan</div>
          <div style={{ fontSize: 11, color: ui.textMute }}>
            {saveStatus === 'saving' && 'Sparar...'}
            {saveStatus === 'saved' && lastSaved && `Sparat ${lastSaved}`}
          </div>
        </div>
        <textarea
          value={note}
          onChange={(e) => handleNoteChange(e.target.value)}
          onBlur={handleNoteBlur}
          placeholder="Kort notis för veckan…"
          style={{
            ...textareaBase,
            height: 64,
            fontSize: 14,
            borderRadius: 8,
            border: '1px solid #E5E7EB',
            background: '#ffffff',
            color: '#111111'
          }}
          aria-label="Veckodokumentation notis"
        />
      </div>
    </>
  );
}

function WeeklyDocSection({ weeklyDoc, saveWeeklyDoc, weekIdInput, setWeekIdInput, clientId }: {
  weeklyDoc: WeeklyDoc;
  saveWeeklyDoc: (weekId: WeekId, doc: WeeklyDoc) => void;
  weekIdInput: WeekId;
  setWeekIdInput: (weekId: WeekId) => void;
  clientId: string;
}) {
  const headerActions = (
    <PeriodPicker
      type="week"
      value={weekIdInput}
      onChange={setWeekIdInput}
    />
  );
  
  return (
    <Card
      title="Veckodokumentation"
      status={weeklyDoc.status}
      headerActions={headerActions}
    >
      <WeeklyDocContent 
        weeklyDoc={weeklyDoc}
        saveWeeklyDoc={saveWeeklyDoc}
        weekIdInput={weekIdInput}
        clientId={clientId}
      />
    </Card>
  );
}

// Månadsrapport innehåll
function MonthlyReportContent({ monthlyReport, saveMonthlyReport, monthIdInput, clientId }: {
  monthlyReport: MonthlyReport;
  saveMonthlyReport: (monthId: MonthId, report: MonthlyReport) => void;
  monthIdInput: MonthId;
  clientId: string;
}) {
  const [note, setNote] = useState(monthlyReport.note || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSaved, setLastSaved] = useState<string>('');
  
  // NEW: Debounced save with period-based storage
  const debouncedSave = useRef(debounceNote((noteValue: string) => {
    const updatedReport = { ...monthlyReport, note: noteValue };
    savePeriodData(clientId, 'monthly', monthIdInput, updatedReport);
    setSaveStatus('saved');
    setLastSaved(new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }));
  }, 500));

  // NEW: Load data when period changes (ensures isolation)
  useEffect(() => {
    const defaultReport: MonthlyReport = {
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

  const handleNoteChange = (value: string) => {
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

  return (
    <>
      <div style={{ ...row(12), flexWrap: "wrap" }}>
        <label style={{ ...row(8) }}>
          <input
            type="checkbox"
            checked={monthlyReport.sent}
            onChange={(e) => saveMonthlyReport(monthIdInput, { ...monthlyReport, sent: e.target.checked })}
          />
          Skickad
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Status:</div>
          <select
            value={monthlyReport.status}
            onChange={(e) => saveMonthlyReport(monthIdInput, { ...monthlyReport, status: e.target.value as DocStatus })}
            style={selectBase}
            aria-label="Månadsrapport status"
          >
            {/* UPDATED: Use STATUS_LABEL for all option labels */}
            <option value="pending">{STATUS_LABEL.pending}</option>
            <option value="approved">{STATUS_LABEL.approved}</option>
            <option value="rejected">{STATUS_LABEL.rejected}</option>
          </select>
        </div>
      </div>

      {/* NEW: Note section */}
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Notis för månaden</div>
          <div style={{ fontSize: 11, color: ui.textMute }}>
            {saveStatus === 'saving' && 'Sparar...'}
            {saveStatus === 'saved' && lastSaved && `Sparat ${lastSaved}`}
          </div>
        </div>
        <textarea
          value={note}
          onChange={(e) => handleNoteChange(e.target.value)}
          onBlur={handleNoteBlur}
          placeholder="Kort notis för månaden…"
          style={{
            ...textareaBase,
            height: 64,
            fontSize: 14,
            borderRadius: 8,
            border: '1px solid #E5E7EB',
            background: '#ffffff',
            color: '#111111'
          }}
          aria-label="Månadsrapport notis"
        />
      </div>
    </>
  );
}

function MonthlyReportSection({ monthlyReport, saveMonthlyReport, monthIdInput, setMonthIdInput, clientId }: {
  monthlyReport: MonthlyReport;
  saveMonthlyReport: (monthId: MonthId, report: MonthlyReport) => void;
  monthIdInput: MonthId;
  setMonthIdInput: (monthId: MonthId) => void;
  clientId: string;
}) {
  const headerActions = (
    <PeriodPicker
      type="month"
      value={monthIdInput}
      onChange={setMonthIdInput}
    />
  );
  
  return (
    <Card
      title="Månadsrapport"
      status={monthlyReport.status}
      headerActions={headerActions}
    >
      <MonthlyReportContent 
        monthlyReport={monthlyReport}
        saveMonthlyReport={saveMonthlyReport}
        monthIdInput={monthIdInput}
        clientId={clientId}
      />
    </Card>
  );
}

// Visma innehåll
function VismaContent({ vismaWeek, saveVisma, weekIdInput }: {
  vismaWeek: VismaWeek;
  saveVisma: (weekId: WeekId, visma: VismaWeek) => void;
  weekIdInput: WeekId;
}) {
  const handleDayChange = (day: string, checked: boolean) => {
    const newVisma = { 
      ...vismaWeek, 
      days: { ...vismaWeek.days, [day]: checked },
      lastUpdated: new Date().toISOString()
    };
    saveVisma(weekIdInput, newVisma);
  };

  return (
    <>
      <DayMatrix
        days={vismaWeek.days}
        weekId={weekIdInput}
        onChange={handleDayChange}
        type="visma"
      />
      
      <div style={{ ...row(8), flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>Status:</div>
        <select
          value={vismaWeek.status}
          onChange={(e) => saveVisma(weekIdInput, { ...vismaWeek, status: e.target.value as DocStatus })}
          style={selectBase}
          aria-label="Visma tid status"
        >
          {/* UPDATED: Use STATUS_LABEL for all option labels */}
          <option value="pending">{STATUS_LABEL.pending}</option>
          <option value="approved">{STATUS_LABEL.approved}</option>
          <option value="rejected">{STATUS_LABEL.rejected}</option>
        </select>
      </div>
    </>
  );
}

function VismaSection({ vismaWeek, saveVisma, weekIdInput, setWeekIdInput }: {
  vismaWeek: VismaWeek;
  saveVisma: (weekId: WeekId, visma: VismaWeek) => void;
  weekIdInput: WeekId;
  setWeekIdInput: (weekId: WeekId) => void;
}) {
  const headerActions = (
    <PeriodPicker
      type="week"
      value={weekIdInput}
      onChange={setWeekIdInput}
    />
  );
  
  return (
    <Card
      title="Visma Tid"
      status={vismaWeek.status}
      headerActions={headerActions}
    >
      <VismaContent 
        vismaWeek={vismaWeek}
        saveVisma={saveVisma}
        weekIdInput={weekIdInput}
      />
    </Card>
  );
}

// Plan innehåll - Uppdaterad för flera GFP-planer
function PlanContent({ selectedClient, savePlan, addNewPlan, showDeletePlanConfirm }: {
  selectedClient: Client;
  savePlan: (updates: Partial<Plan> | { plans: GFPPlan[] }) => void;
  addNewPlan: () => void;
  showDeletePlanConfirm: (plan: GFPPlan) => void;
}) {
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  
  // Filter out soft-deleted plans
  const activePlans = selectedClient.plans.filter(p => !p.deletedAt);
  const currentPlan = activePlans[selectedPlanIndex];
  
  const saveCurrentPlan = (updates: Partial<GFPPlan>) => {
    if (!currentPlan) return;
    
    const updatedPlans = [...selectedClient.plans];
    updatedPlans[selectedPlanIndex] = { ...currentPlan, ...updates };
    
    // Uppdatera genom savePlan (som kommer att hantera state-uppdatering)
    savePlan({ plans: updatedPlans });
  };

  return (
    <div>
      {/* Flikar/Chips för planer + Ny plan-knapp */}
      <div style={{ ...row(8), marginBottom: 16, flexWrap: "wrap" }}>
        {activePlans.map((plan, index) => (
          <div key={plan.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setSelectedPlanIndex(index)}
              style={{
                background: selectedPlanIndex === index ? ui.blue : ui.bgAlt,
                color: selectedPlanIndex === index ? '#ffffff' : ui.text,
                border: `1px solid ${selectedPlanIndex === index ? ui.blue : ui.border}`,
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {plan.title}
            </button>
            {/* NEW: Delete plan button */}
            {activePlans.length > 1 && (
              <button
                onClick={() => showDeletePlanConfirm(plan)}
                style={{
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
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#fecaca';
                  e.currentTarget.style.borderColor = '#fca5a5';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#fee2e2';
                  e.currentTarget.style.borderColor = '#fecaca';
                }}
                title={`Ta bort ${plan.title}`}
                aria-label={`Ta bort ${plan.title}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addNewPlan}
          style={{
            background: ui.green,
            color: '#ffffff',
            border: `1px solid ${ui.green}`,
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          + Ny plan
        </button>
      </div>

      {/* Innehåll för vald plan */}
      {currentPlan ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 4 }}>Datum (vårdplan)</div>
            <input
              type="date"
              value={currentPlan.date}
              onChange={(e) => saveCurrentPlan({ date: e.target.value, dueDate: addDaysISO(e.target.value, 21) })}
              style={inputBase}
              aria-label="Vårdplan datum"
            />
          </div>
          
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 4 }}>Förfallodatum</div>
            <div style={{ ...pill(currentPlan.done ? 'approved' : (todayYMD() > currentPlan.dueDate ? 'rejected' : 'pending')), fontWeight: 700 }}>
              {currentPlan.dueDate}
            </div>
            {todayYMD() > currentPlan.dueDate && !currentPlan.done && (
              <div style={{ color: ui.red, fontSize: 11, fontWeight: 600, marginTop: 4 }}>
                (Försenad)
              </div>
            )}
          </div>

          <div>
            <label style={{ ...row(8) }}>
              <input
                type="checkbox"
                checked={currentPlan.staffInformed}
                onChange={(e) => saveCurrentPlan({ staffInformed: e.target.checked })}
              />
              Personal tillsagd
            </label>
          </div>
          
          <div>
            <label style={{ ...row(8) }}>
              <input
                type="checkbox"
                checked={currentPlan.done}
                onChange={(e) => saveCurrentPlan({ done: e.target.checked, status: e.target.checked ? 'approved' : 'pending' })}
              />
              GFP klar
            </label>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 4 }}>Anteckning</div>
            <textarea
              value={currentPlan.note}
              onChange={(e) => saveCurrentPlan({ note: e.target.value })}
              placeholder="Skriv anteckning…"
              style={textareaBase}
            />
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: ui.textMute, padding: 20 }}>
          Inga planer än. Klicka "Ny plan" för att skapa en.
        </div>
      )}
    </div>
  );
}

function ClientWorkFull({
  selectedClient,
  savePlan,
  saveWeeklyDoc,
  saveMonthlyReport,
  saveVisma,
  weekIdInput,
  setWeekIdInput,
  monthIdInput,
  setMonthIdInput
}: {
  selectedClient: Client | undefined;
  savePlan: (updates: Partial<Plan> | { plans: GFPPlan[] }) => void;
  saveWeeklyDoc: (weekId: WeekId, doc: WeeklyDoc) => void;
  saveMonthlyReport: (monthId: MonthId, report: MonthlyReport) => void;
  saveVisma: (weekId: WeekId, visma: VismaWeek) => void;
  weekIdInput: WeekId;
  setWeekIdInput: (weekId: WeekId) => void;
  monthIdInput: MonthId;
  setMonthIdInput: (monthId: MonthId) => void;
}) {
  const [isMobile, setIsMobile] = useState(false);
  
  // NEW: Confirm dialog state for plan deletion
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    impactSummary?: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    impactSummary: undefined,
    onConfirm: () => {}
  });

  // NEW: Show confirm dialog for plan soft deletion with impact summary
  function showDeletePlanConfirm(plan: GFPPlan) {
    setConfirmDialog({
      open: true,
      title: "Ta bort plan",
      description: `Är du säker på att du vill ta bort ${plan.title}? Planen försvinner från aktiva listor men all historik bevaras.`,
      impactSummary: "Mjuk-raderar 1 plan",
      onConfirm: () => {
        if (!selectedClient) return;
        const updatedPlans = selectedClient.plans.map(p => 
          p.id === plan.id 
            ? { ...p, deletedAt: new Date().toISOString() }
            : p
        );
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
    return (
      <div>
        <div style={headerBar}>
          <div style={title}>Klient – Arbete</div>
        </div>
        <div style={{ ...card, color: C.textLight }}>
          Välj en klient i Personal-vyn för att börja arbeta.
        </div>
      </div>
    );
  }

  // NEW: Load period data with proper isolation
  const weeklyDoc = (() => {
    const defaultDoc: WeeklyDoc = {
      weekId: weekIdInput,
      days: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false },
      status: "pending" as DocStatus,
      note: ''
    };
    return loadPeriodData(selectedClient.id, 'weekly', weekIdInput, defaultDoc);
  })();

  const monthlyReport = (() => {
    const defaultReport: MonthlyReport = {
      monthId: monthIdInput,
      sent: false,
      status: "pending" as DocStatus,
      note: ''
    };
    return loadPeriodData(selectedClient.id, 'monthly', monthIdInput, defaultReport);
  })();

  const vismaWeek = selectedClient.visma[weekIdInput] || {
    weekId: weekIdInput,
    days: { mon: false, tue: false, wed: false, thu: false, fri: false },
    status: "pending" as DocStatus
  };

  // Plan status beräkning - använd senaste planen
  const getPlanStatus = (): DocStatus => {
    const latest = latestPlan(selectedClient.plans);
    if (!latest) return "pending";
    if (!latest.done) {
      const today = todayYMD();
      if (today > latest.dueDate) return "rejected"; // Försenad
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
        children: <PlanContent selectedClient={selectedClient} savePlan={savePlan} addNewPlan={() => {
          const newPlan: GFPPlan = {
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
        }} showDeletePlanConfirm={showDeletePlanConfirm} />
      },
      {
        id: 'weekly',
        title: 'Veckodokumentation',
        status: weeklyDoc.status,
        headerActions: (
          <div onClick={(e) => e.stopPropagation()}>
            <PeriodPicker
              type="week"
              value={weekIdInput}
              onChange={setWeekIdInput}
            />
          </div>
        ),
        children: <WeeklyDocContent weeklyDoc={weeklyDoc} saveWeeklyDoc={saveWeeklyDoc} weekIdInput={weekIdInput} clientId={selectedClient.id} />
      },
      {
        id: 'monthly',
        title: 'Månadsrapport',
        status: monthlyReport.status,
        headerActions: (
          <div onClick={(e) => e.stopPropagation()}>
            <PeriodPicker
              type="month"
              value={monthIdInput}
              onChange={setMonthIdInput}
            />
          </div>
        ),
        children: <MonthlyReportContent monthlyReport={monthlyReport} saveMonthlyReport={saveMonthlyReport} monthIdInput={monthIdInput} clientId={selectedClient.id} />
      },
      {
        id: 'visma',
        title: 'Visma Tid',
        status: vismaWeek.status,
        headerActions: (
          <div onClick={(e) => e.stopPropagation()}>
            <PeriodPicker
              type="week"
              value={weekIdInput}
              onChange={setWeekIdInput}
            />
          </div>
        ),
        children: <VismaContent vismaWeek={vismaWeek} saveVisma={saveVisma} weekIdInput={weekIdInput} />
      }
    ];

    return (
      <div>
        <div style={headerBar}>
          <div style={title}>Klient: {selectedClient.name}</div>
          <div style={{ fontSize: 12, color: C.textLight }}>
            V{getCurrentWeek()} • {getCurrentMonth()}
          </div>
        </div>
        <Accordion sections={accordionSections} />
      </div>
    );
  }

  // Desktop: Two-column card layout
  return (
    <div>
      <div style={headerBar}>
        <div style={title}>Klient: {selectedClient.name}</div>
        <div style={{ fontSize: 12, color: C.textLight }}>
          Vecka: {getCurrentWeek()} • Månad: {getCurrentMonth()}
        </div>
      </div>

      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))", 
        gap: 16,
        alignItems: "start"
      }}>
        <Card
          title="Plan (GFP)"
          status={planStatus}
        >
          <PlanContent selectedClient={selectedClient} savePlan={savePlan} addNewPlan={() => {
            const newPlan: GFPPlan = {
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
          }} showDeletePlanConfirm={showDeletePlanConfirm} />
        </Card>

        <WeeklyDocSection
          weeklyDoc={weeklyDoc}
          saveWeeklyDoc={saveWeeklyDoc}
          weekIdInput={weekIdInput}
          setWeekIdInput={setWeekIdInput}
          clientId={selectedClient.id}
        />
        
        <MonthlyReportSection
          monthlyReport={monthlyReport}
          saveMonthlyReport={saveMonthlyReport}
          monthIdInput={monthIdInput}
          setMonthIdInput={setMonthIdInput}
          clientId={selectedClient.id}
        />
        
        <VismaSection
          vismaWeek={vismaWeek}
          saveVisma={saveVisma}
          weekIdInput={weekIdInput}
          setWeekIdInput={setWeekIdInput}
        />
      </div>
      
      {/* NEW: Confirm dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        impactSummary={confirmDialog.impactSummary}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
}

function Reports({ state }: { state: AppState }) {
  return (
    <div>
      <div style={headerBar}>
        <div style={title}>Rapporter & Export</div>
      </div>

      <div style={gridTwo}>
        <div style={card()}>
          <div style={cardHeader}>
            <div style={{ fontWeight: 800 }}>Export</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button style={primaryBtn} onClick={() => exportToFile(state)}>
              Ladda ner fil
            </button>
            <button style={btn} onClick={() => exportToClipboard(state)}>
              Kopiera till urklipp
            </button>
          </div>
          <div style={{ fontSize: 12, color: C.textLight }}>
            Export inkluderar all data. Använd för backup eller för att dela med kollega.
          </div>
        </div>

        <div style={card()}>
          <div style={cardHeader}>
            <div style={{ fontWeight: 800 }}>Lagring</div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: C.textLight, marginBottom: 4 }}>Lagringstyp</div>
            <div style={{ fontWeight: 700 }}>{getStorageType()}</div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: C.textLight, marginBottom: 4 }}>Senaste backup</div>
            <div style={{ fontWeight: 700 }}>{state.lastBackup || "Aldrig"}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.textLight, marginBottom: 4 }}>Backups tillgängliga</div>
            <div style={{ fontWeight: 700 }}>{getBackups().length} st</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StaffDetail({ state, selectedStaff }: { state: AppState; selectedStaff: Staff | undefined }) {
  if (!selectedStaff) {
    return (
      <div>
        <div style={headerBar}>
          <div style={title}>Personal Dashboard</div>
        </div>
        <div style={card()}>
          <div style={{ color: C.textLight, textAlign: 'center', padding: 20 }}>
            Välj en personal i Personal-vyn för att visa dashboard.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StaffSummary staff={selectedStaff} state={state} />
    </div>
  );
}

function ArchiveView({ state, setState }: { state: AppState; setState: (fn: (prev: AppState) => AppState) => void }) {
  const [staffQuery, setStaffQuery] = useState("");
  const [retentionDays, setRetentionDays] = useState(180);
  
  // NEW: Confirm dialog state for restore and cleanup
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    impactSummary?: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  function restoreClient(clientId: string, staffId: string) {
    setState((prev: AppState) => ({
      ...prev,
      staff: prev.staff.map(s =>
        s.id === staffId ? { 
          ...s, 
          clients: s.clients.map(c => 
            c.id === clientId 
              ? { ...c, archivedAt: undefined, deletedAt: undefined }
              : c
          )
        } : s
      )
    }));
  }

  function showRestoreClientConfirm(client: Client) {
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

  function executeRetentionCleanup(toRemove: Array<{ type: string; id: string; staffId: string; clientId?: string }>) {
    setState((prev: AppState) => {
      const newState = { ...prev };
      
      toRemove.forEach(item => {
        const staffIndex = newState.staff.findIndex(s => s.id === item.staffId);
        if (staffIndex === -1) return;

        const staff = newState.staff[staffIndex];
        if (!staff) return;

        if (item.type === 'client') {
          // Remove entire client
          staff.clients = staff.clients.filter(c => c.id !== item.id);
        } else if (item.clientId) {
          // Remove individual items within client
          const clientIndex = staff.clients.findIndex(c => c.id === item.clientId);
          if (clientIndex === -1) return;

          const client = staff.clients[clientIndex];
          if (!client) return;
          
          switch (item.type) {
            case 'plan':
              client.plans = client.plans.filter(p => p.id !== item.id);
              break;
            case 'weeklyDoc':
              delete client.weeklyDocs[item.id as WeekId];
              break;
            case 'monthlyReport':
              delete client.monthlyReports[item.id as MonthId];
              break;
            case 'vismaWeek':
              delete client.visma[item.id as WeekId];
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
    const result: Array<{ staff: Staff; clients: Client[] }> = [];
    
    state.staff.forEach(staff => {
      const archivedClients = staff.clients.filter(c => c.archivedAt || c.deletedAt);
      if (archivedClients.length > 0) {
        result.push({ staff, clients: archivedClients });
      }
    });
    
    return result;
  }, [state.staff]);

  const filteredStaff = archivedClientsByStaff.filter(({ staff }) => 
    staff.name.toLowerCase().includes(staffQuery.toLowerCase())
  );

  return (
    <div>
      <div style={headerBar}>
        <div style={title}>Arkiverade & borttagna klienter</div>
      </div>

      {/* NEW: Retention cleanup controls */}
      <div style={card()}>
        <div style={cardHeader}>
          <div style={{ fontWeight: 800 }}>Rensa gamla arkiverade poster</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>
            Rensa poster äldre än (dagar):
          </label>
          <input
            type="number"
            value={retentionDays}
            onChange={e => setRetentionDays(parseInt(e.target.value) || 180)}
            min="1"
            max="3650"
            style={{ ...inputBase, width: 120 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            style={{
              ...primaryBtn,
              background: '#007aff',
              fontSize: 14
            }}
            onClick={exportBeforeCleanup}
          >
            🗃️ Exportera gamla poster
          </button>
          <button
            style={{
              ...primaryBtn,
              background: '#ff3b30',
              fontSize: 14
            }}
            onClick={performRetentionCleanup}
          >
            🗑️ Rensa gamla poster
          </button>
        </div>
      </div>

      <div style={card()}>
        <div style={cardHeader}>
          <div style={{ fontWeight: 800 }}>Arkiverade & borttagna klienter</div>
        </div>

        <input
          placeholder="Sök personal…"
          value={staffQuery}
          onChange={e => setStaffQuery(e.target.value)}
          style={{ ...inputBase, width: '100%', marginBottom: 16 }}
        />

        {filteredStaff.length === 0 ? (
          <div style={{ color: C.textLight, textAlign: 'center', padding: 20 }}>
            {staffQuery ? 'Inga arkiverade eller borttagna klienter hittades för denna personal.' : 'Inga arkiverade eller borttagna klienter.'}
          </div>
        ) : (
          <div style={{ ...col(12) }}>
            {filteredStaff.map(({ staff, clients }) => (
              <div key={staff.id} style={card()}>
                <div style={{ fontWeight: 700, marginBottom: 12, color: ui.text }}>
                  {staff.name} ({clients.length} arkiverade/borttagna)
                </div>
                <div style={{ ...col(8) }}>
                  {clients.map(client => (
                    <div
                      key={client.id}
                      style={{
                        ...listItemStyle(false),
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 12,
                        alignItems: "center"
                      }}
                    >
                      <div>
                        <div style={nameStyle}>{client.name}</div>
                        <div style={metaStyle}>
                          {client.archivedAt && `Arkiverad: ${new Date(client.archivedAt).toLocaleDateString('sv-SE')}`}
                          {client.deletedAt && `Borttagen: ${new Date(client.deletedAt).toLocaleDateString('sv-SE')}`}
                        </div>
                      </div>
                      <button 
                        style={{
                          ...primaryBtn,
                          fontSize: 12,
                          padding: "6px 12px"
                        }}
                        onClick={() => showRestoreClientConfirm(client)}
                      >
                        Återställ
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        impactSummary={confirmDialog.impactSummary}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
}

/* ---------- App Render ---------- */
export default function App() {
  const [state, setState] = useState<AppState>(() => loadState() ?? initialState());
  const [view, setView] = useState<View>("overview");
  const [weekIdInput, setWeekIdInput] = useState<WeekId>(getCurrentWeek());
  const [monthIdInput, setMonthIdInput] = useState<MonthId>(getCurrentMonth());

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

  const selectedStaff = useMemo(
    () => state.staff.find((s) => s.id === state.selectedStaffId),
    [state.staff, state.selectedStaffId]
  );

  const selectedClient = useMemo(() => {
    const s = selectedStaff;
    if (!s) return undefined;
    return s.clients.find((c) => c.id === state.selectedClientId && !c.archivedAt && !c.deletedAt);
  }, [selectedStaff, state.selectedClientId]);

  const kpis = useMemo((): Record<string, number> => {
    const nowWeek = getCurrentWeek();
    const nowMonth = getCurrentMonth();
    const today = todayYMD();

    let delayedPlan = 0, waitingPlan = 0, delayedDocs = 0, delayedMonthly = 0, delayedVisma = 0, totalClients = 0, totalPlansActive = 0, completedThisWeek = 0;

    state.staff.forEach(st => {
      st.clients.forEach(client => {
        // Skip archived and soft-deleted clients
        if (client.archivedAt || client.deletedAt) return;
        
        totalClients += 1;
        
        // Använd senaste planen för KPI-beräkning
        const latest = latestPlan(client.plans);
        if (!latest) {
          waitingPlan += 1;
        } else {
          if (!latest.done) {
            if (today > latest.dueDate) delayedPlan += 1;
            else waitingPlan += 1;
          } else {
            totalPlansActive += 1;
          }
        }
        Object.values(client.weeklyDocs).forEach((wd) => {
          if (compareWeekId(wd.weekId, nowWeek) === 0 && wd.status === "approved") {
            completedThisWeek += 1;
          }
          if (compareWeekId(wd.weekId, nowWeek) < 0 && (wd.status !== "approved")) delayedDocs += 1;
        });
        Object.values(client.monthlyReports).forEach((mr) => {
          if (compareMonthId(mr.monthId, nowMonth) < 0 && (!mr.sent || mr.status !== "approved")) delayedMonthly += 1;
        });
        Object.values(client.visma).forEach((vw) => {
          if (compareWeekId(vw.weekId, nowWeek) < 0 && (vw.status !== "approved")) delayedVisma += 1;
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

  return (
    <div style={app}>
      <aside style={sidebar} data-print-hide>
        <div style={{ fontWeight: 900, fontSize: 18, color: ui.text, marginBottom: 10 }}>Vårdadmin</div>
        {/* NEW: Updated navigation with proper contrast */}
        <button 
          style={navItemStyle(view === "overview")} 
          onClick={() => setView("overview")}
          onMouseEnter={(e) => {
            if (view !== "overview") {
              e.currentTarget.style.background = ui.navHoverBg;
            }
          }}
          onMouseLeave={(e) => {
            if (view !== "overview") {
              e.currentTarget.style.background = 'transparent';
            }
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = `2px solid ${ui.blue}`;
            e.currentTarget.style.outlineOffset = '2px';
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none';
          }}
        >
          Översikt
        </button>
        <button
          style={{
            ...navItemStyle(view === "client"),
            opacity: selectedClient ? 1 : 0.55,
            cursor: selectedClient ? 'pointer' : 'not-allowed'
          }}
          onClick={() => selectedClient && setView("client")}
          onMouseEnter={(e) => {
            if (view !== "client" && selectedClient) {
              e.currentTarget.style.background = ui.navHoverBg;
            }
          }}
          onMouseLeave={(e) => {
            if (view !== "client") {
              e.currentTarget.style.background = 'transparent';
            }
          }}
          onFocus={(e) => {
            if (selectedClient) {
              e.currentTarget.style.outline = `2px solid ${ui.blue}`;
              e.currentTarget.style.outlineOffset = '2px';
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none';
          }}
        >
          Klienten {selectedClient ? `(${selectedClient.name})` : ""}
        </button>
        <button 
          style={navItemStyle(view === "staff")} 
          onClick={() => setView("staff")}
          onMouseEnter={(e) => {
            if (view !== "staff") {
              e.currentTarget.style.background = ui.navHoverBg;
            }
          }}
          onMouseLeave={(e) => {
            if (view !== "staff") {
              e.currentTarget.style.background = 'transparent';
            }
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = `2px solid ${ui.blue}`;
            e.currentTarget.style.outlineOffset = '2px';
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none';
          }}
        >
          Personal
        </button>
        <button
          style={{
            ...navItemStyle(view === "staffDetail"),
            opacity: selectedStaff ? 1 : 0.55,
            cursor: selectedStaff ? 'pointer' : 'not-allowed'
          }}
          onClick={() => selectedStaff && setView("staffDetail")}
          onMouseEnter={(e) => {
            if (view !== "staffDetail" && selectedStaff) {
              e.currentTarget.style.background = ui.navHoverBg;
            }
          }}
          onMouseLeave={(e) => {
            if (view !== "staffDetail") {
              e.currentTarget.style.background = 'transparent';
            }
          }}
          onFocus={(e) => {
            if (selectedStaff) {
              e.currentTarget.style.outline = `2px solid ${ui.blue}`;
              e.currentTarget.style.outlineOffset = '2px';
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none';
          }}
        >
          Dashboard {selectedStaff ? `(${selectedStaff.name})` : ""}
        </button>
        <button 
          style={navItemStyle(view === "reports")} 
          onClick={() => setView("reports")}
          onMouseEnter={(e) => {
            if (view !== "reports") {
              e.currentTarget.style.background = ui.navHoverBg;
            }
          }}
          onMouseLeave={(e) => {
            if (view !== "reports") {
              e.currentTarget.style.background = 'transparent';
            }
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = `2px solid ${ui.blue}`;
            e.currentTarget.style.outlineOffset = '2px';
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none';
          }}
        >
          Rapporter
        </button>
        <button 
          style={navItemStyle(view === "archive")} 
          onClick={() => setView("archive")}
          onMouseEnter={(e) => {
            if (view !== "archive") {
              e.currentTarget.style.background = ui.navHoverBg;
            }
          }}
          onMouseLeave={(e) => {
            if (view !== "archive") {
              e.currentTarget.style.background = 'transparent';
            }
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = `2px solid ${ui.blue}`;
            e.currentTarget.style.outlineOffset = '2px';
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none';
          }}
        >
          Arkiv
        </button>
        <div style={{ flex: 1 }} />
        <button 
          style={{ ...navItemStyle(false), color: ui.textMute }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = ui.navHoverBg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = `2px solid ${ui.blue}`;
            e.currentTarget.style.outlineOffset = '2px';
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none';
          }}
        >
          Logga ut
        </button>
      </aside>

      <main style={main}>
        {view === "overview" && <Overview state={state} kpis={kpis} />}
        {view === "staff" && <StaffView state={state} setState={setState} selectedStaff={selectedStaff} setView={setView} />}
        {view === "staffDetail" && <StaffDetail state={state} selectedStaff={selectedStaff} />}
        {view === "archive" && <ArchiveView state={state} setState={setState} />}
        {view === "client" && (
          <ClientWorkFull
            selectedClient={selectedClient}
            savePlan={(u: Partial<Plan> | { plans: GFPPlan[] }) => {
              if (!selectedStaff || !selectedClient) return;
              
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
                staff: prev.staff.map((s) =>
                  s.id === selectedStaff.id
                    ? { 
                        ...s, 
                        clients: s.clients.map((c) => 
                          c.id === selectedClient.id 
                            ? { 
                                ...c, 
                                ...('plans' in u ? { plans: u.plans } : { plan: { ...c.plan, ...u } })
                              } 
                            : c
                        ) 
                      }
                    : s
                )
              }));
            }}
            saveWeeklyDoc={(weekId: WeekId, payload: WeeklyDoc) => {
              if (!selectedStaff || !selectedClient) return;
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
                staff: prev.staff.map((s) =>
                  s.id === selectedStaff.id
                    ? { ...s, clients: s.clients.map((c) => (c.id === selectedClient.id ? { ...c, weeklyDocs: { ...c.weeklyDocs, [weekId]: payload } } : c)) }
                    : s
                )
              }));
            }}
            saveMonthlyReport={(monthId: MonthId, payload: MonthlyReport) => {
              if (!selectedStaff || !selectedClient) return;
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
                staff: prev.staff.map((s) =>
                  s.id === selectedStaff.id
                    ? { ...s, clients: s.clients.map((c) => (c.id === selectedClient.id ? { ...c, monthlyReports: { ...c.monthlyReports, [monthId]: payload } } : c)) }
                    : s
                )
              }));
            }}
            saveVisma={(weekId: WeekId, payload: VismaWeek) => {
              if (!selectedStaff || !selectedClient) return;
              setState((prev) => ({
                ...prev,
                staff: prev.staff.map((s) =>
                  s.id === selectedStaff.id
                    ? { ...s, clients: s.clients.map((c) => (c.id === selectedClient.id ? { ...c, visma: { ...c.visma, [weekId]: payload } } : c)) }
                    : s
                )
              }));
            }}
            weekIdInput={weekIdInput}
            setWeekIdInput={setWeekIdInput}
            monthIdInput={monthIdInput}
            setMonthIdInput={setMonthIdInput}
          />
        )}
        {view === "reports" && <Reports state={state} />}
      </main>
      
      <SaveBar state={state} data-print-hide />
    </div>
  );
}