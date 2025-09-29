# Arkivering av klienter - Implementation

## Översikt
Ersatt hård radering av klienter med arkivering för att bevara historik och uppslag.

## Ändringar

### 1. Typuppdateringar (`src/types.ts`)
- **Client-typ**: Lade till `archivedAt?: string` för att markera när klienten arkiverades
- **View-typ**: Lade till `"archive"` för den nya arkiv-vyn

### 2. Arkiveringsflöde (`src/App.tsx`)

#### Ersatt radering med arkivering:
- **Tidigare**: `removeClient()` - tog bort klient helt
- **Nu**: `archiveClient()` - sätter `archivedAt = new Date().toISOString()`
- **Bekräftelsedialog**: Uppdaterad text från "Ta bort" till "Arkivera" med förklaring om att historik bevaras

#### Återställningsfunktionalitet:
- **Ny funktion**: `restoreClient()` - tar bort `archivedAt` för att återställa klient
- **Arkiv-vy**: Ny `ArchiveView` komponent för att visa och hantera arkiverade klienter

### 3. Filtrering av arkiverade klienter

#### KPI-beräkningar:
- Alla KPI-beräkningar ignorerar nu klienter med `archivedAt`
- `totalClients`, `delayedPlan`, `waitingPlan`, etc. räknar bara aktiva klienter

#### Vyer:
- **StaffView**: Klientlista visar bara aktiva klienter (`!c.archivedAt`)
- **Overview**: Sparkline och dokumentstatistik ignorerar arkiverade klienter
- **selectedClient**: Filtrerar bort arkiverade klienter

### 4. Arkiv-vy (`ArchiveView`)
- **Navigation**: Ny "Arkiv"-knapp i sidomenyn
- **Funktionalitet**:
  - Visar alla arkiverade klienter grupperade per personal
  - Sökfunktion för att filtrera per personal
  - "Återställ"-knapp för varje arkiverad klient
  - Bekräftelsedialog vid återställning
  - Visar arkiveringsdatum för varje klient

### 5. Historikbevarande
- **cleanupClientLocalStorage**: Uppdaterad för att inte ta bort perioddata för arkiverade klienter
- **Funktionsnamn**: `getActiveClientIds()` → `getAllClientIds()` för att inkludera arkiverade klienter
- **Perioddata**: Veckodokumentation och månadsrapporter bevaras för arkiverade klienter

## Testfall (`tests/archive.test.ts`)

### 1. Arkivering
- Verifierar att `archivedAt` sätts till korrekt ISO-datum
- Kontrollerar att klientdata bevaras

### 2. Filtrering
- Testar att arkiverade klienter filtreras bort från aktiva listor
- Verifierar att bara aktiva klienter visas

### 3. Återställning
- Testar att `archivedAt` kan tas bort för att återställa klient
- Kontrollerar att all data bevaras vid återställning

### 4. Historikbevarande
- Verifierar att all historik (veckodokumentation, månadsrapporter, planer) bevaras
- Testar att specifik data finns kvar efter arkivering

### 5. Bonus: KPI-beräkningar
- Kontrollerar att KPI:er ignorerar arkiverade klienter
- Verifierar att bara aktiva klienter räknas i statistik

## Användarupplevelse

### Före:
1. Användare klickar "Ta bort" på klient
2. Bekräftelsedialog: "Detta går inte att ångra"
3. Klient och all historik raderas permanent

### Efter:
1. Användare klickar "Arkivera" på klient
2. Bekräftelsedialog: "Klienten försvinner från aktiva listor men all historik bevaras"
3. Klient arkiveras (försvinner från aktiva listor)
4. Användare kan gå till "Arkiv"-vyn för att se arkiverade klienter
5. Användare kan klicka "Återställ" för att återställa klienten

## Tekniska detaljer

### Datastruktur:
```typescript
type Client = {
  // ... befintliga fält
  archivedAt?: string; // ISO datum när klienten arkiverades
}
```

### Filtrering:
```typescript
// Aktiva klienter
const activeClients = staff.clients.filter(c => !c.archivedAt);

// Arkiverade klienter  
const archivedClients = staff.clients.filter(c => c.archivedAt);
```

### Arkivering:
```typescript
const archivedClient = {
  ...client,
  archivedAt: new Date().toISOString()
};
```

### Återställning:
```typescript
const restoredClient = {
  ...client,
  archivedAt: undefined
};
```

## Acceptance Criteria ✅

- [x] Client får `archivedAt?: string`
- [x] Listor/KPI ignorerar arkiverade (default)
- [x] Toggle "Visa arkiverade" för att lista dem separat (Arkiv-vy)
- [x] Knapp "Återställ" tar bort `archivedAt`
- [x] Arkiverad klient försvinner från aktiva listor, kan återställas
- [x] Ingen historik raderas av arkivering
- [x] `cleanupClientLocalStorage` tar INTE bort history (om finns)
- [x] 4 testfall skapade och dokumenterade

## Kompatibilitet

- **Bakåtkompatibilitet**: Befintliga klienter utan `archivedAt` behandlas som aktiva
- **Migration**: Ingen migration behövs - fältet är optional
- **Export/Import**: Arkiverade klienter inkluderas i export/import
- **Backup**: Arkiverade klienter inkluderas i automatiska backups
