import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { TuesdayAttendance, TuesdayAttendanceStatus } from '../types';
import { getCurrentWeek, addWeeks } from '../date';
import { loadTuesdayAttendance, saveTuesdayAttendance } from '../storage';

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

// Color contrast helper
function getContrastColor(bgColor: string): string {
  const colors: Record<string, string> = {
    '#FFFFFF': '#333',
    '#007aff': 'white',
    '#34C759': '#333',
    '#ff9500': '#333',
    '#ff3b30': 'white'
  };
  return colors[bgColor] || '#333';
}

interface TuesdayAttendanceWidgetProps {
  staffId: string;
}

const TuesdayAttendanceWidget: React.FC<TuesdayAttendanceWidgetProps> = ({ staffId }) => {
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
  const [attendance, setAttendance] = useState<TuesdayAttendance | null>(null);
  const [note, setNote] = useState('');
  const [noteDebounceTimer, setNoteDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [lastSaved, setLastSaved] = useState<string>('');

  // Load attendance data for selected week
  useEffect(() => {
    const record = loadTuesdayAttendance(staffId, selectedWeek);
    if (record) {
      setAttendance(record as TuesdayAttendance);
      setNote((record.note as string) || '');
    } else {
      setAttendance(null);
      setNote('');
    }
  }, [staffId, selectedWeek]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (noteDebounceTimer) {
        clearTimeout(noteDebounceTimer);
      }
    };
  }, [noteDebounceTimer]);

  // Navigate weeks with proper ISO handling
  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = addWeeks(selectedWeek, direction === 'next' ? 1 : -1);
    setSelectedWeek(newWeek);
  };

  // Update status
  const updateStatus = (status: TuesdayAttendanceStatus) => {
    const record: TuesdayAttendance = {
      staffId,
      weekId: selectedWeek,
      status,
      note: note || undefined,
      ts: new Date().toISOString()
    };
    saveTuesdayAttendance(record);
    setAttendance(record);
    setLastSaved(format(new Date(), 'HH:mm'));
  };

  // Handle note change with debounce
  const handleNoteChange = (newNote: string) => {
    setNote(newNote);
    
    if (noteDebounceTimer) {
      clearTimeout(noteDebounceTimer);
    }
    
    const timer = setTimeout(() => {
      if (attendance) {
        const record: TuesdayAttendance = {
          ...attendance,
          note: newNote || undefined,
          ts: new Date().toISOString()
        };
        saveTuesdayAttendance(record);
        setAttendance(record);
        setLastSaved(format(new Date(), 'HH:mm'));
      }
    }, 400);
    
    setNoteDebounceTimer(timer);
  };

  const currentStatus = attendance?.status || 'unregistered';

  return (
    <div style={{
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      padding: '12px',
      marginTop: '12px',
      backgroundColor: '#fafafa'
    }}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>
        Närvaro tisdag/APT
      </h4>
      
      {/* Week selector */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        marginBottom: '12px'
      }}>
        <button
          onClick={() => navigateWeek('prev')}
          aria-label="Föregående vecka"
          style={{
            padding: '4px 8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: 'white',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ◀
        </button>
        <span style={{ 
          flex: 1, 
          textAlign: 'center',
          fontSize: '14px',
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
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ▶
        </button>
      </div>

      {/* Status buttons */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '4px',
        marginBottom: '12px'
      }}>
        {(Object.keys(ATT_LABEL) as TuesdayAttendanceStatus[]).map(status => {
          const bgColor = status === 'unregistered' ? '#f0f0f0' : ATT_COLOR[status];
          const textColor = status === 'unregistered' ? '#333' : getContrastColor(ATT_COLOR[status]);
          
          return (
            <button
              key={status}
              onClick={() => updateStatus(status)}
              aria-label={`Sätt status till ${ATT_LABEL[status]}`}
              style={{
                padding: '6px 10px',
                border: currentStatus === status ? '2px solid #333' : '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: bgColor,
                color: textColor,
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: currentStatus === status ? 600 : 400,
                transition: 'all 0.2s'
              }}
            >
              {ATT_LABEL[status]}
            </button>
          );
        })}
      </div>

      {/* Note field */}
      <textarea
        value={note}
        onChange={(e) => handleNoteChange(e.target.value)}
        onBlur={() => {
          if (attendance) {
            const record: TuesdayAttendance = {
              ...attendance,
              note: note || undefined,
              ts: new Date().toISOString()
            };
            saveTuesdayAttendance(record);
            setLastSaved(format(new Date(), 'HH:mm'));
          }
        }}
        placeholder="Kommentar..."
        aria-label="Kommentar"
        style={{
          width: '100%',
          minHeight: '50px',
          padding: '6px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '13px',
          resize: 'vertical'
        }}
      />

      {/* Last saved indicator */}
      {lastSaved && (
        <div style={{ 
          marginTop: '8px',
          fontSize: '11px',
          color: '#666'
        }}>
          Sparat {lastSaved}
        </div>
      )}
    </div>
  );
};

export default TuesdayAttendanceWidget;
