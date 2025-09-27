import React from 'react';
import { Staff } from '../types';
import { useStaffStats, WeeklyDocumentationStats } from '../hooks/useStaffStats';
import { AppState } from '../types';
import TuesdayAttendanceWidget from './TuesdayAttendanceWidget';

interface StaffSummaryProps {
  staff: Staff;
  state: AppState;
}

// KPI Card Component för personal dashboard
interface PersonalKpiCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  variant?: 'late' | 'waiting' | 'info' | 'neutral' | 'success';
  icon?: React.ReactNode;
}

function PersonalKpiCard({ title, value, subtitle, variant = 'info', icon }: PersonalKpiCardProps) {
  const colors = {
    late: { accent: '#ff3b30', bg: 'rgba(255,59,48,0.06)' },
    waiting: { accent: '#ff9500', bg: 'rgba(255,149,0,0.06)' },
    info: { accent: '#007aff', bg: 'rgba(0,122,255,0.06)' },
    success: { accent: '#16a34a', bg: 'rgba(22,163,74,0.06)' },
    neutral: { accent: '#6b7280', bg: 'rgba(107,114,128,0.06)' }
  };
  
  const c = colors[variant];
  
  return (
    <div className={`kpi-card kpi-${variant}`} style={{
      background: '#fff',
      border: '1px solid rgba(0,0,0,0.12)',
      borderRadius: 10,
      padding: 12,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      display: 'flex',
      gap: 12,
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
          <div style={{ color: '#111827', fontSize: 26, fontWeight: 700 }}>{value}</div>
          {subtitle && (
            <div style={{ color: '#6b7280', fontSize: 12 }}>{subtitle}</div>
          )}
        </div>
      </div>
      <div style={{ width: 6, alignSelf: 'stretch', borderRadius: 6, background: c.accent, opacity: 0.18 }} />
    </div>
  );
}

// Dokumentationsgrad graf - enkel bar chart
interface DocumentationChartProps {
  weeklyStats: WeeklyDocumentationStats[];
}

function DocumentationChart({ weeklyStats }: DocumentationChartProps) {
  const maxHeight = 80;
  const barWidth = 40;
  const barGap = 8;
  // Chart width calculation not needed for current layout
  
  return (
    <div className="chart-container" style={{
      background: '#fff',
      border: '1px solid rgba(0,0,0,0.12)',
      borderRadius: 10,
      padding: 16,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
    }}>
      <div style={{ 
        fontWeight: 800, 
        fontSize: 14, 
        marginBottom: 12,
        color: '#111827'
      }}>
        Dokumentationsgrad senaste 4 veckor
      </div>
      
      <div style={{
        display: 'flex',
        alignItems: 'end',
        justifyContent: 'center',
        gap: barGap,
        height: maxHeight + 40,
        paddingBottom: 20
      }}>
        {weeklyStats.map((weekStat) => {
          const barHeight = weekStat.total > 0 ? (weekStat.rate * maxHeight) : 0;
          const color = weekStat.rate >= 0.8 ? '#16a34a' : // Grön för > 80%
                      weekStat.rate >= 0.5 ? '#ff9500' : // Orange för 50-79%
                      '#ff3b30'; // Röd för < 50%
          
          // Extrahera veckonummer från weekId (YYYY-Wxx)
          const weekNumber = weekStat.weekId.split('-W')[1] || '';
          
          return (
            <div 
              key={weekStat.weekId}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8
              }}
            >
              <div style={{
                width: barWidth,
                height: barHeight,
                background: color,
                borderRadius: '4px 4px 0 0',
                position: 'relative',
                transition: 'all 0.3s ease'
              }}>
                {/* Procenttext ovanpå stapeln */}
                {weekStat.total > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: -20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#374151',
                    whiteSpace: 'nowrap'
                  }}>
                    {Math.round(weekStat.rate * 100)}%
                  </div>
                )}
              </div>
              
              {/* Vecka-etikett */}
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#6b7280',
                whiteSpace: 'nowrap'
              }}>
                V{weekNumber}
              </div>
              
              {/* Antal dokument tooltip info */}
              <div style={{
                fontSize: 9,
                color: '#9ca3af',
                textAlign: 'center',
                lineHeight: 1.2
              }}>
                {weekStat.approved}/{weekStat.total}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Förklaring */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 16,
        marginTop: 8,
        fontSize: 10,
        color: '#6b7280'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#16a34a' }} />
          ≥80%
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#ff9500' }} />
          50-79%
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#ff3b30' }} />
          &lt;50%
        </div>
      </div>
    </div>
  );
}

// Progress Ring för total dokumentationsgrad
interface ProgressRingProps {
  percentage: number;
  size?: number;
}

function ProgressRing({ percentage, size = 120 }: ProgressRingProps) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(1, percentage)));
  
  const color = percentage >= 0.8 ? '#16a34a' : 
                percentage >= 0.5 ? '#ff9500' : 
                '#ff3b30';
  
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <svg width={size} height={size}>
        <g transform={`translate(${size / 2},${size / 2})`}>
          {/* Bakgrund */}
          <circle
            r={radius}
            fill="none"
            stroke="#eef2f7"
            strokeWidth={stroke}
          />
          {/* Progress */}
          <circle
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            transform="rotate(-90)"
            strokeLinecap="round"
          />
          {/* Procenttext */}
          <text 
            y="6" 
            textAnchor="middle" 
            style={{ 
              fontWeight: 800, 
              fontSize: 20,
              fill: '#111827'
            }}
          >
            {Math.round(percentage * 100)}%
          </text>
        </g>
      </svg>
    </div>
  );
}

export default function StaffSummary({ staff, state }: StaffSummaryProps) {
  const stats = useStaffStats(state, staff.id);
  
  // PRINT NEW: Print funktion
  const handlePrint = () => {
    window.print();
  };
  
  if (!stats) {
    return (
      <div style={{
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 10,
        padding: 16,
        textAlign: 'center',
        color: '#6b7280'
      }}>
        Kunde inte ladda statistik för {staff.name}
      </div>
    );
  }
  
  const { kpis, weeklyStats } = stats;
  
  return (
    <div data-print-scope="personal-dashboard">
      {/* PRINT NEW: Print-specifika rubriker (dolda i skärmläge) */}
      <div className="print-only" style={{ marginBottom: 20, textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 8px 0' }}>
          {staff.name}
        </h1>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#374151', margin: '0 0 16px 0' }}>
          Personal Dashboard
        </h2>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20 }}>
          Genererad: {new Date().toLocaleString('sv-SE', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>
            {staff.name}
          </div>
          <div style={{ fontSize: 14, color: '#6b7280' }}>
            Personal Dashboard
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            fontSize: 12,
            color: '#6b7280',
            textAlign: 'right'
          }}>
            {kpis.totalClients} klienter
          </div>
          {/* PRINT NEW: Skriv ut-knapp */}
          <button
            onClick={handlePrint}
            data-print-hide
            style={{
              background: '#007aff',
              color: '#ffffff',
              border: '1px solid #007aff',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#0051d5';
              e.currentTarget.style.borderColor = '#0051d5';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#007aff';
              e.currentTarget.style.borderColor = '#007aff';
            }}
            aria-label="Skriv ut dashboard"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" 
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Skriv ut
          </button>
        </div>
      </div>
      
      {/* KPI Cards Grid */}
      <div className="kpi-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        marginBottom: 20
      }}>
        <PersonalKpiCard 
          title="Aktiva vårdplaner" 
          value={kpis.activePlans} 
          subtitle="GFP klara"
          variant="success"
        />
        <PersonalKpiCard 
          title="Försenade planer" 
          value={kpis.delayedPlans} 
          subtitle="över 21 dagar"
          variant="late"
        />
        <PersonalKpiCard 
          title="Väntar på GFP" 
          value={kpis.waitingPlans} 
          subtitle="under process"
          variant="waiting"
        />
        <PersonalKpiCard 
          title="Klart denna vecka" 
          value={kpis.completedThisWeek} 
          subtitle="godkända dokument"
          variant="info"
        />
        <PersonalKpiCard 
          title="Försenade dokument" 
          value={kpis.delayedDocs} 
          subtitle="veckodokumentation"
          variant="late"
        />
        <PersonalKpiCard 
          title="Försenade rapporter" 
          value={kpis.delayedMonthly} 
          subtitle="månadsrapporter"
          variant="waiting"
        />
      </div>
      
      {/* Dokumentationsgrad sektion */}
      <div className="chart-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(300px, 2fr) minmax(200px, 1fr)',
        gap: 16,
        alignItems: 'start'
      }}>
        {/* Veckovis graf */}
        <DocumentationChart weeklyStats={weeklyStats} />
        
        {/* Total dokumentationsgrad */}
        <div className="chart-container" style={{
          background: '#fff',
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: 10,
          padding: 16,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          textAlign: 'center'
        }}>
          <div style={{ 
            fontWeight: 800, 
            fontSize: 14, 
            marginBottom: 16,
            color: '#111827'
          }}>
            Total dokumentationsgrad
          </div>
          
          <ProgressRing percentage={kpis.documentationRate} />
          
          <div style={{
            marginTop: 12,
            fontSize: 12,
            color: '#6b7280',
            lineHeight: 1.4
          }}>
            {stats.approvedDocuments} av {stats.totalDocuments} dokument godkända
          </div>
        </div>
      </div>

      {/* Tuesday Attendance Widget */}
      <TuesdayAttendanceWidget staffId={staff.id} />

      {/* PRINT NEW: Print-footer (dold i skärmläge) */}
      <div className="print-footer print-only">
        Genererad: {new Date().toLocaleString('sv-SE', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit' 
        })} | Ungdomsstöd Dashboard
      </div>
    </div>
  );
}
