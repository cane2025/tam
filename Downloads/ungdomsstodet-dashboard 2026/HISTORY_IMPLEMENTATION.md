# Historiska KPI - Implementation

## Översikt
Implementerat historiska KPI som bevaras trots arkivering/borttagning av klienter. Data från tidigare veckor/månader syns kvar i grafer och dashboards även efter att klienter arkiverats eller tagits bort.

## Ändringar

### 1. Typuppdateringar (`src/types.ts`)
- **HistoryEntry-typ**: Ny typ för att lagra historiska KPI-data
  ```typescript
  export type HistoryEntry = {
    id: string;
    periodType: 'week' | 'month';
    periodId: string; // WeekId eller MonthId
    staffId: string;
    clientId: string;
    metric: 'weekDoc' | 'monthReport' | 'gfp';
    status: DocStatus;
    value?: number; // För numeriska värden (t.ex. antal dagar)
    ts: string; // ISO timestamp när entry skapades/uppdaterades
  };
  ```

### 2. History Management (`src/App.tsx`)

#### Nya funktioner:
- **`loadHistory()`**: Laddar history från localStorage
- **`saveHistory()`**: Sparar history till localStorage
- **`upsertHistory()`**: Idempotent upsert per (periodType,periodId,staffId,clientId,metric)
- **LS-nyckel**: `'us:history'` (array av HistoryEntry)

#### Idempotent upsert:
```typescript
function upsertHistory(entry: Omit<HistoryEntry, 'id' | 'ts'>): void {
  // Hittar befintlig entry baserat på unik nyckel
  // Uppdaterar befintlig eller skapar ny
  // Sparar alltid med ny timestamp
}
```

### 3. Automatisk history-skrivning

#### Veckodokumentation:
```typescript
// Vid saveWeeklyDoc
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
```

#### Månadsrapport:
```typescript
// Vid saveMonthlyReport
upsertHistory({
  periodType: 'month',
  periodId: monthId,
  staffId: selectedStaff.id,
  clientId: selectedClient.id,
  metric: 'monthReport',
  status: payload.status,
  value: payload.sent ? 1 : 0
});
```

#### GFP-planer:
```typescript
// Vid savePlan
u.plans.forEach(plan => {
  upsertHistory({
    periodType: 'week',
    periodId: getCurrentWeek(),
    staffId: selectedStaff.id,
    clientId: selectedClient.id,
    metric: 'gfp',
    status: plan.status,
    value: plan.done ? 1 : 0
  });
});
```

### 4. Dashboard-uppdateringar

#### Overview - Sparkline:
- **Passerade veckor**: Läser från history (inkluderar arkiverade/borttagna klienter)
- **Nuvarande vecka**: Läser från aktiva klienter
- **Aggregering**: Kombinerar history + aktiva klienter

```typescript
// Get history for past weeks (including archived clients)
const history = loadHistory();
const pastWeeks = history
  .filter(h => h.periodType === 'week' && h.metric === 'weekDoc' && compareWeekId(h.periodId, currentWeek) < 0)
  .filter(h => h.status === 'approved');

// Add current week data from active clients only
state.staff.forEach(st => {
  st.clients.forEach(c => {
    if (c.archivedAt) return; // Skip archived clients for current week
    // ... add current week data
  });
});
```

#### Dokumentstatistik:
- **Totala dokument**: History + nuvarande aktiva klienter
- **Godkända dokument**: History + nuvarande aktiva klienter
- **Kvalitetsberäkning**: Baserat på kombinerad data

### 5. Användarupplevelse

#### Text under diagram:
```
"Historik inkluderar arkiverade klienter"
```

#### Beteende:
- **Passerade perioder**: Data från history (alla klienter, inklusive arkiverade/borttagna)
- **Nuvarande period**: Data från aktiva klienter
- **Grafer**: Visar kontinuerlig historik även efter arkivering/borttagning

### 6. Cleanup-säkerhet

#### Uppdaterad cleanup-funktion:
```typescript
function cleanupClientLocalStorage(allClientIds: Set<string>): void {
  // ... existing cleanup logic
  
  // Remove orphaned keys (but NEVER touch us:history)
  keysToRemove.forEach(key => {
    if (key !== HISTORY_KEY) { // Extra safety check
      localStorage.removeItem(key);
    }
  });
}
```

- **Säkerhet**: `us:history` rörs ALDRIG av cleanup
- **Loggning**: "Cleaned up X orphaned period data entries (preserved history)"

## Testfall (`tests/history.test.ts`)

### 1. HistoryEntry skapas korrekt
- Verifierar att veckodokumentation, månadsrapporter och GFP skapar korrekta entries
- Kontrollerar att alla fält är korrekt ifyllda

### 2. upsertHistory() är idempotent
- Testar att samma data uppdaterar befintlig entry istället för att skapa ny
- Verifierar att olika metrics skapar separata entries
- Kontrollerar att ID bevaras vid uppdatering

### 3. Historik bevaras efter arkivering
- Simulerar arkivering av klient
- Verifierar att history-entries fortfarande finns kvar
- Kontrollerar att data är tillgänglig för dashboards

### 4. Historik bevaras efter borttagning
- Simulerar borttagning av klient
- Verifierar att history-entries bevaras i localStorage
- Kontrollerar att data från borttagna klienter fortfarande är tillgänglig

### 5. Dashboards läser från history
- Testar att passerade perioder läses från history
- Verifierar att nuvarande period läses från aktiva klienter
- Kontrollerar att sparkline-data aggregeras korrekt

### 6. cleanup rör inte us:history
- Simulerar cleanup-process
- Verifierar att perioddata tas bort för borttagna klienter
- Kontrollerar att `us:history` ALDRIG tas bort
- Testar extra säkerhetskontroll

## Tekniska detaljer

### Datastruktur:
```typescript
// localStorage structure
{
  'us:history': [
    {
      id: 'uuid',
      periodType: 'week',
      periodId: '2024-W01',
      staffId: 'staff-1',
      clientId: 'client-1',
      metric: 'weekDoc',
      status: 'approved',
      value: 3,
      ts: '2024-01-01T10:00:00.000Z'
    }
  ]
}
```

### Idempotent nyckel:
```typescript
// Unik nyckel för idempotency
const key = `${periodType}:${periodId}:${staffId}:${clientId}:${metric}`;
```

### Dashboard-logik:
```typescript
// Kombinera history + aktiva klienter
const pastData = history.filter(h => h.periodId < currentPeriod);
const currentData = activeClients.filter(c => !c.archivedAt);
const combinedData = [...pastData, ...currentData];
```

## Acceptance Criteria ✅

- [x] HistoryEntry med alla nödvändiga fält
- [x] LS-nyckel: 'us:history' (array)
- [x] upsertHistory() idempotent per (periodType,periodId,staffId,clientId,metric)
- [x] Skriv till history vid save av vecka/månad/GFP
- [x] Dashboards aggregerar från history för passerade perioder
- [x] "Nuvarande" KPI för aktiva bygger på state
- [x] Arkivering/radering raderar ALDRIG history
- [x] Text under diagram: "Historik inkluderar arkiverade klienter"
- [x] cleanup rör inte us:history
- [x] 6 testfall skapade och dokumenterade

## Kompatibilitet

- **Bakåtkompatibilitet**: Befintliga dashboards fungerar som tidigare
- **Migration**: Ingen migration behövs - history byggs upp automatiskt
- **Performance**: History läses endast vid behov, cachar inte
- **Storage**: History växer över tid men rensas aldrig automatiskt

## Framtida utvidgningar

### Valfria funktioner:
- **Toggle "Exkludera arkiverade i historik"**: Kan implementeras genom att filtrera history
- **History-export**: Kan inkluderas i export-funktionalitet
- **History-cleanup**: Manuell cleanup av gamla history-entries
- **History-visualisering**: Dedikerad vy för att visa historisk data

### Prestanda-optimering:
- **History-indexering**: Indexera history per period för snabbare sökning
- **History-pagination**: Paginera stora history-datamängder
- **History-compression**: Komprimera gamla history-entries
