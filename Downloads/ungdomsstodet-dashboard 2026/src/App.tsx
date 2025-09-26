import { useEffect, useMemo, useState } from "react";
import { AppState, DocStatus, WeekId, MonthId, Staff, Client, Plan, WeeklyDoc, MonthlyReport, VismaWeek, View } from "./types";
import { getStoredData, getBackups, getStorageType } from "./storage";
import { getCurrentWeek, getCurrentMonth, addWeeks, addMonths, addDaysISO, todayYMD } from "./date";
import SaveBar from "./components/SaveBar";
import StaffSummary from "./components/StaffSummary";

// NEW: Central status label mapping
const STATUS_LABEL: Record<DocStatus, string> = {
  approved: 'Godkänd',
  pending: 'Väntar', 
  rejected: 'Ej godkänt/komplettera'
};

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

// DueBadge Component - Visar GFP förfallodatum
interface DueBadgeProps {
  carePlanDate?: string;
  label?: string;
}

function DueBadge({ carePlanDate, label = "GFP förfaller" }: DueBadgeProps) {
  if (!carePlanDate) {
    return (
      <div style={{ 
        fontSize: 12, 
        color: '#6b7280', 
        fontStyle: 'italic' 
      }}>
        {label}: -
      </div>
    );
  }

  const dueDate = addDaysISO(carePlanDate, 21);
  const today = todayYMD();
  const isOverdue = today > dueDate;
  const isCloseToDeadline = !isOverdue && addDaysISO(today, 7) >= dueDate;

  // Colors are applied directly in the pill style

  return (
    <div style={{ 
      ...row(6),
      fontSize: 12 
    }}>
      <span style={{ color: '#374151', fontWeight: 600 }}>
        {label}:
      </span>
      <span style={{
        ...pill(isOverdue ? 'late' : isCloseToDeadline ? 'pending' : 'approved'),
        fontWeight: 700
      }}>
        {dueDate}
      </span>
      {isOverdue && (
        <span style={{ 
          color: '#ff3b30', 
          fontSize: 11, 
          fontWeight: 600 
        }}>
          (Försenad)
        </span>
      )}
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
    <div style={{
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
    if (raw) return JSON.parse(raw) as AppState;
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
    plan: { carePlanDate: undefined, hasGFP: false, staffNotified: false, notes: "" },
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
    state.staff.forEach(st => {
      st.clients.forEach(c => {
        Object.entries(c.weeklyDocs).forEach(([weekId, doc]) => {
          if (doc.status === "approved") {
            weeklyByWeek[weekId] = (weeklyByWeek[weekId] || 0) + 1;
          }
        });
      });
    });

    const sortedWeeks = Object.keys(weeklyByWeek).sort(compareWeekId).slice(-8);
    const series = sortedWeeks.map(w => weeklyByWeek[w] || 0);

    const totalDocs = state.staff.reduce(
      (sum, st) =>
        sum +
        st.clients.reduce(
          (cSum, c) => cSum + Object.keys(c.weeklyDocs).length + Object.keys(c.monthlyReports).length,
          0
        ),
      0
    );

    const approvedDocs = state.staff.reduce(
      (sum, st) =>
        sum +
        st.clients.reduce(
          (cSum, c) =>
            cSum +
            Object.values(c.weeklyDocs).filter(d => d.status === "approved").length +
            Object.values(c.monthlyReports).filter(d => d.status === "approved").length,
          0
        ),
      0
    );

    const quality = totalDocs ? approvedDocs / totalDocs : 0;

    return {
      series: series.length ? series : [0],
      quality
    };
  }, [state.staff]);

  return (
    <div>
      <div style={headerBar}>
        <div style={title}>Vårdadmin – Dashboard</div>
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
            </div>
            <Donut pct={overviewSamples.quality} />
          </div>
        </div>
      </div>

      <div style={gridThree}>
        <KpiCard title="Försenad plan" value={kpis.delayedPlan ?? 0} subtitle="GFP över 21 dagar" variant="late" />
        <KpiCard title="Försenad dokumentation" value={kpis.delayedDocs ?? 0} subtitle="Ej godkända veckor" variant="waiting" />
        <KpiCard title="Denna vecka" value={kpis.completedThisWeek ?? 0} subtitle="Godkända dokument" variant="success" />
        <KpiCard title="Totalt klienter" value={kpis.totalClients ?? 0} subtitle={`${state.staff.length} personal`} variant="neutral" />
        <KpiCard title="Försenad månadsrapport" value={kpis.delayedMonthly ?? 0} variant="info" />
        <KpiCard title="Försenad Visma-tid" value={kpis.delayedVisma ?? 0} variant="info" />
      </div>
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

  function addClientToSelected(name: string) {
    if (!selectedStaff || !name.trim()) return;
    setState((prev: AppState) => ({
      ...prev,
      staff: prev.staff.map(s =>
        s.id === selectedStaff.id ? { ...s, clients: [...s.clients, newClient(name.trim())] } : s
      )
    }));
  }

  function removeClient(clientId: string) {
    if (!selectedStaff) return;
    setState((prev: AppState) => ({
      ...prev,
      staff: prev.staff.map(s =>
        s.id === selectedStaff.id ? { ...s, clients: s.clients.filter(c => c.id !== clientId) } : s
      ),
      selectedClientId: prev.selectedClientId === clientId ? undefined : prev.selectedClientId
    }));
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
                  <div style={metaStyle}>{s.clients.length} klienter</div>
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
                <button style={{ ...btn, fontSize: 12, padding: "4px 8px" }} onClick={() => removeStaff(s.id)}>
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
                {/* NEW: Updated client list with proper contrast */}
                {selectedStaff.clients.map((c: Client) => (
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
                        Plan: {c.plan.carePlanDate || "Saknas"} • GFP: {c.plan.hasGFP ? "✓" : "–"}
                      </div>
                    </button>
                    <button style={primaryBtn} onClick={() => { setState((prev: AppState) => ({ ...prev, selectedClientId: c.id })); setView("client"); }}>
                      Öppna
                    </button>
                    <button style={{ ...btn, fontSize: 12 }} onClick={() => removeClient(c.id)}>
                      Ta bort
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- ClientWork Section Content Components ---------- */

// Veckodokumentation innehåll
function WeeklyDocContent({ weeklyDoc, saveWeeklyDoc, weekIdInput }: {
  weeklyDoc: WeeklyDoc;
  saveWeeklyDoc: (weekId: WeekId, doc: WeeklyDoc) => void;
  weekIdInput: WeekId;
}) {
  const handleDayChange = (day: string, checked: boolean) => {
    const newDoc = { 
      ...weeklyDoc, 
      days: { ...weeklyDoc.days, [day]: checked },
      lastUpdated: new Date().toISOString()
    };
    saveWeeklyDoc(weekIdInput, newDoc);
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
    </>
  );
}

function WeeklyDocSection({ weeklyDoc, saveWeeklyDoc, weekIdInput, setWeekIdInput }: {
  weeklyDoc: WeeklyDoc;
  saveWeeklyDoc: (weekId: WeekId, doc: WeeklyDoc) => void;
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
      title="Veckodokumentation"
      status={weeklyDoc.status}
      headerActions={headerActions}
    >
      <WeeklyDocContent 
        weeklyDoc={weeklyDoc}
        saveWeeklyDoc={saveWeeklyDoc}
        weekIdInput={weekIdInput}
      />
    </Card>
  );
}

// Månadsrapport innehåll
function MonthlyReportContent({ monthlyReport, saveMonthlyReport, monthIdInput }: {
  monthlyReport: MonthlyReport;
  saveMonthlyReport: (monthId: MonthId, report: MonthlyReport) => void;
  monthIdInput: MonthId;
}) {
  return (
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
  );
}

function MonthlyReportSection({ monthlyReport, saveMonthlyReport, monthIdInput, setMonthIdInput }: {
  monthlyReport: MonthlyReport;
  saveMonthlyReport: (monthId: MonthId, report: MonthlyReport) => void;
  monthIdInput: MonthId;
  setMonthIdInput: (monthId: MonthId) => void;
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

// Plan innehåll
function PlanContent({ selectedClient, savePlan }: {
  selectedClient: Client;
  savePlan: (updates: Partial<Plan>) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, alignItems: "start" }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 4 }}>Datum (vårdplan)</div>
        <input
          type="date"
          value={selectedClient.plan.carePlanDate ?? ""}
          onChange={(e) => savePlan({ carePlanDate: e.target.value || undefined })}
          style={inputBase}
          aria-label="Vårdplan datum"
        />
      </div>
      
      <div>
        <DueBadge carePlanDate={selectedClient.plan.carePlanDate} />
      </div>

      <div>
        <label style={{ ...row(8) }}>
          <input
            type="checkbox"
            checked={selectedClient.plan.staffNotified}
            onChange={(e) => savePlan({ staffNotified: e.target.checked })}
          />
          Personal tillsagd
        </label>
      </div>
      
      <div>
        <label style={{ ...row(8) }}>
          <input
            type="checkbox"
            checked={selectedClient.plan.hasGFP}
            onChange={(e) => savePlan({ hasGFP: e.target.checked })}
          />
          GFP klar
        </label>
      </div>

      <div style={{ gridColumn: "1 / -1" }}>
        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 4 }}>Anteckning</div>
        <textarea
          value={selectedClient.plan.notes}
          onChange={(e) => savePlan({ notes: e.target.value })}
          placeholder="Skriv anteckning…"
          style={textareaBase}
        />
      </div>
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
  savePlan: (updates: Partial<Plan>) => void;
  saveWeeklyDoc: (weekId: WeekId, doc: WeeklyDoc) => void;
  saveMonthlyReport: (monthId: MonthId, report: MonthlyReport) => void;
  saveVisma: (weekId: WeekId, visma: VismaWeek) => void;
  weekIdInput: WeekId;
  setWeekIdInput: (weekId: WeekId) => void;
  monthIdInput: MonthId;
  setMonthIdInput: (monthId: MonthId) => void;
}) {
  const [isMobile, setIsMobile] = useState(false);

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

  const weeklyDoc = selectedClient.weeklyDocs[weekIdInput] || {
    weekId: weekIdInput,
    days: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false },
    status: "pending" as DocStatus
  };

  const monthlyReport = selectedClient.monthlyReports[monthIdInput] || {
    monthId: monthIdInput,
    sent: false,
    status: "pending" as DocStatus
  };

  const vismaWeek = selectedClient.visma[weekIdInput] || {
    weekId: weekIdInput,
    days: { mon: false, tue: false, wed: false, thu: false, fri: false },
    status: "pending" as DocStatus
  };

  // Plan status beräkning
  const getPlanStatus = (): DocStatus => {
    if (!selectedClient.plan.carePlanDate) return "pending";
    if (!selectedClient.plan.hasGFP) {
      const today = todayYMD();
      const due = addDaysISO(selectedClient.plan.carePlanDate, 21);
      if (today > due) return "rejected"; // Försenad
    }
    return selectedClient.plan.hasGFP ? "approved" : "pending";
  };

  const planStatus = getPlanStatus();

  if (isMobile) {
    // Mobile: Accordion layout
    const accordionSections = [
      {
        id: 'plan',
        title: 'Plan (GFP)',
        status: planStatus,
        children: <PlanContent selectedClient={selectedClient} savePlan={savePlan} />
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
        children: <WeeklyDocContent weeklyDoc={weeklyDoc} saveWeeklyDoc={saveWeeklyDoc} weekIdInput={weekIdInput} />
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
        children: <MonthlyReportContent monthlyReport={monthlyReport} saveMonthlyReport={saveMonthlyReport} monthIdInput={monthIdInput} />
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
          <PlanContent selectedClient={selectedClient} savePlan={savePlan} />
        </Card>

        <WeeklyDocSection
          weeklyDoc={weeklyDoc}
          saveWeeklyDoc={saveWeeklyDoc}
          weekIdInput={weekIdInput}
          setWeekIdInput={setWeekIdInput}
        />
        
        <MonthlyReportSection
          monthlyReport={monthlyReport}
          saveMonthlyReport={saveMonthlyReport}
          monthIdInput={monthIdInput}
          setMonthIdInput={setMonthIdInput}
        />
        
        <VismaSection
          vismaWeek={vismaWeek}
          saveVisma={saveVisma}
          weekIdInput={weekIdInput}
          setWeekIdInput={setWeekIdInput}
        />
      </div>
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

/* ---------- App Render ---------- */
export default function App() {
  const [state, setState] = useState<AppState>(() => loadState() ?? initialState());
  const [view, setView] = useState<View>("overview");
  const [weekIdInput, setWeekIdInput] = useState<WeekId>(getCurrentWeek());
  const [monthIdInput, setMonthIdInput] = useState<MonthId>(getCurrentMonth());

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
    return s.clients.find((c) => c.id === state.selectedClientId);
  }, [selectedStaff, state.selectedClientId]);

  const kpis = useMemo((): Record<string, number> => {
    const nowWeek = getCurrentWeek();
    const nowMonth = getCurrentMonth();
    const today = todayYMD();

    let delayedPlan = 0, waitingPlan = 0, delayedDocs = 0, delayedMonthly = 0, delayedVisma = 0, totalClients = 0, totalPlansActive = 0, completedThisWeek = 0;

    state.staff.forEach(st => {
      st.clients.forEach(client => {
        totalClients += 1;
        const cp = client.plan.carePlanDate;
        if (!cp) {
          waitingPlan += 1;
        } else {
          const due = addDaysISO(cp, 21);
          if (!client.plan.hasGFP) {
            if (today > due) delayedPlan += 1;
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
      <aside style={sidebar}>
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
        {view === "client" && (
          <ClientWorkFull
            selectedClient={selectedClient}
            savePlan={(u: Partial<Plan>) => {
              if (!selectedStaff || !selectedClient) return;
              setState((prev) => ({
                ...prev,
                staff: prev.staff.map((s) =>
                  s.id === selectedStaff.id
                    ? { ...s, clients: s.clients.map((c) => (c.id === selectedClient.id ? { ...c, plan: { ...c.plan, ...u } } : c)) }
                    : s
                )
              }));
            }}
            saveWeeklyDoc={(weekId: WeekId, payload: WeeklyDoc) => {
              if (!selectedStaff || !selectedClient) return;
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
      
      <SaveBar state={state} />
    </div>
  );
}