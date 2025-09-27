import React, { useState, useEffect, useCallback } from 'react';
import { TuesdayAttendanceStatus } from '../types';
import { getCurrentWeek, addWeeks } from '../date';
import { aggregateTuesdayAttendance } from '../storage';

// Label/Color maps
const ATT_LABEL: Record<TuesdayAttendanceStatus, string> = {
  unregistered: 'Ej registrerad',
  excused_absence: 'Frånvaro (giltig)',
  on_time: 'Närvaro i tid',
  late: 'Närvaro försenad',
  unexcused_absence: 'Ogiltig frånvaro',
};

const ATT_COLOR: Record<TuesdayAttendanceStatus, string> = {
  unregistered: '#FFFFFF',
  excused_absence: '#007aff',
  on_time: '#34C759',
  late: '#ff9500',
  unexcused_absence: '#ff3b30',
};

const GroupAttendanceWidget: React.FC = () => {
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
  const [aggregatedData, setAggregatedData] = useState<Record<TuesdayAttendanceStatus, number>>({
    unregistered: 0,
    excused_absence: 0,
    on_time: 0,
    late: 0,
    unexcused_absence: 0,
  });

  // Load aggregated data
  const loadData = useCallback(() => {
    const data = aggregateTuesdayAttendance(selectedWeek);
    setAggregatedData(data as Record<TuesdayAttendanceStatus, number>);
  }, [selectedWeek]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for live updates
  useEffect(() => {
    const handleUpdate = (e: CustomEvent) => {
      if (e.detail.weekId === selectedWeek) {
        loadData();
      }
    };
    
    window.addEventListener('us:attTue:changed', handleUpdate as EventListener);
    return () => {
      window.removeEventListener('us:attTue:changed', handleUpdate as EventListener);
    };
  }, [selectedWeek, loadData]);

  // Navigate weeks with proper ISO handling
  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = addWeeks(selectedWeek, direction === 'next' ? 1 : -1);
    setSelectedWeek(newWeek);
  };

  const total = Object.values(aggregatedData).reduce((sum, count) => sum + count, 0);
  const maxCount = Math.max(...Object.values(aggregatedData), 1);

  return (
    <div style={{
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      padding: '16px',
      backgroundColor: 'white',
      marginBottom: '16px'
    }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>
        Närvaro tisdag/APT (grupp)
      </h3>
      
      {/* Week selector */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        marginBottom: '16px'
      }}>
        <button
          onClick={() => navigateWeek('prev')}
          aria-label="Föregående vecka"
          style={{
            padding: '4px 8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: 'white',
            cursor: 'pointer'
          }}
        >
          ◀
        </button>
        <span style={{ 
          flex: 1, 
          textAlign: 'center',
          fontWeight: 500
        }}>
          Vecka {selectedWeek}
        </span>
        <button
          onClick={() => navigateWeek('next')}
          aria-label="Nästa vecka"
          style={{
            padding: '4px 8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: 'white',
            cursor: 'pointer'
          }}
        >
          ▶
        </button>
      </div>

      {/* Bar chart or empty state */}
      {total === 0 ? (
        <div style={{
          padding: '24px',
          textAlign: 'center',
          color: '#999',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          marginBottom: '12px'
        }}>
          <div style={{ fontSize: '14px', marginBottom: '8px' }}>
            Ingen personal registrerad
          </div>
          <div style={{ fontSize: '12px' }}>
            Lägg till personal för att börja spåra närvaro
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '12px' }}>
          {(Object.keys(ATT_LABEL) as TuesdayAttendanceStatus[]).map(status => {
            const count = aggregatedData[status];
            const percentage = total > 0 ? (count / total * 100) : 0;
            const barWidth = maxCount > 0 ? (count / maxCount * 100) : 0;
            
            return (
              <div key={status} style={{ marginBottom: '8px' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  fontSize: '13px',
                  marginBottom: '2px'
                }}>
                  <span style={{ width: '140px' }}>{ATT_LABEL[status]}:</span>
                  <span style={{ fontWeight: 500 }}>{count} st</span>
                  {total > 0 && (
                    <span style={{ marginLeft: '8px', color: '#666' }}>
                      ({percentage.toFixed(0)}%)
                    </span>
                  )}
                </div>
                <div style={{
                  width: '100%',
                  height: '20px',
                  backgroundColor: '#f0f0f0',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${barWidth}%`,
                    height: '100%',
                    backgroundColor: status === 'unregistered' ? '#ccc' : ATT_COLOR[status],
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ 
        fontSize: '12px', 
        color: '#666',
        textAlign: 'center'
      }}>
        Totalt {total} personal · ISO-vecka {selectedWeek}
      </div>
    </div>
  );
};

export default GroupAttendanceWidget;
