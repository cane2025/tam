# Mjuk-radering via deletedAt - Implementation

## Översikt
Implementerat mjuk-radering via `deletedAt` för alla entiteter (Client, GFPPlan, WeeklyDoc, MonthlyReport, VismaWeek, Plan). Soft-deleted poster syns inte i aktiva listor/KPI men bevaras för historik och kan återställas.

## Ändringar

### 1. Typuppdateringar (`src/types.ts`)

#### Alla entiteter får `deletedAt?: string`:
```typescript
export type WeeklyDoc = {
  weekId: WeekId;
  days: { mon: boolean; tue: boolean; wed: boolean; thu: boolean; fri: boolean; sat: boolean; sun: boolean };
  status: DocStatus;
  note?: string;
  lastUpdated?: string;
  deletedAt?: string;      // NEW - ISO datum när dokumentet mjuk-raderades
};

export type MonthlyReport = {
  monthId: MonthId;
  sent: boolean;
  status: DocStatus;
  note?: string;
  lastUpdated?: string;
  deletedAt?: string;      // NEW - ISO datum när rapporten mjuk-raderades
};

export type VismaWeek = {
  weekId: WeekId;
  days: { mon: boolean; tue: boolean; wed: boolean; thu: boolean; fri: boolean };
  status: DocStatus;
  lastUpdated?: string;
  deletedAt?: string;      // NEW - ISO datum när Visma-veckan mjuk-raderades
};

export type Plan = {
  carePlanDate?: string;
  hasGFP: boolean;
  staffNotified: boolean;
  notes: string;
  lastUpdated?: string;
  deletedAt?: string;      // NEW - ISO datum när planen mjuk-raderades
};

export type GFPPlan = {
  id: string;
  title: string;
  date: string;
  dueDate: string;
  note: string;
  staffInformed: boolean;
  done: boolean;
  status: DocStatus;
  deletedAt?: string;  // NEW - ISO datum när GFP-planen mjuk-raderades
};

export type Client = {
  id: string;
  name: string;
  plan: Plan;
  plans: GFPPlan[];
  weeklyDocs: Record<WeekId, WeeklyDoc>;
  monthlyReports: Record<MonthId, MonthlyReport>;
  visma: Record<WeekId, VismaWeek>;
  createdAt: string;
  archivedAt?: string;
  deletedAt?: string;  // NEW - ISO datum när klienten mjuk-raderades
};
```

### 2. Uppdaterade radera-flöden (`src/App.tsx`)

#### Klient mjuk-radering:
```typescript
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
```

#### GFP-plan mjuk-radering:
```typescript
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
```

#### Bekräftelsedialog för klienter:
```typescript
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
```

### 3. UI/KPI filtrering för "nuet"

#### KPI-beräkningar filtrerar bort mjuk-raderade:
```typescript
state.staff.forEach(st => {
  st.clients.forEach(client => {
    // Skip archived and soft-deleted clients
    if (client.archivedAt || client.deletedAt) return;
    
    totalClients += 1;
    // ... rest of KPI calculations
  });
});
```

#### Klientlistor filtrerar bort mjuk-raderade:
```typescript
// Staff view - client count
<div style={metaStyle}>{s.clients.filter(c => !c.archivedAt && !c.deletedAt).length} klienter</div>

// Staff view - client list
{selectedStaff.clients.filter(c => !c.archivedAt && !c.deletedAt).map((c: Client) => (
  // ... client list items
))}
```

#### GFP-planer filtrerar bort mjuk-raderade:
```typescript
function latestPlan(plans: GFPPlan[] | undefined): GFPPlan | undefined {
  if (!plans || plans.length === 0) return undefined;
  // Filter out soft-deleted plans and return the first (newest) active plan
  const activePlans = plans.filter(p => !p.deletedAt);
  return activePlans[0]; // Nyaste först
}

// Plan content - only show active plans
const activePlans = selectedClient.plans.filter(p => !p.deletedAt);
{activePlans.map((plan, index) => (
  // ... plan tabs
))}
```

#### Overview filtrerar bort mjuk-raderade:
```typescript
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
```

### 4. Återställningsfunktionalitet

#### Återställning av klienter:
```typescript
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
```

#### Uppdaterad arkiv-vy:
```typescript
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
```

#### Status-visning i arkiv-vy:
```typescript
<div style={metaStyle}>
  {client.archivedAt && `Arkiverad: ${new Date(client.archivedAt).toLocaleDateString('sv-SE')}`}
  {client.deletedAt && `Borttagen: ${new Date(client.deletedAt).toLocaleDateString('sv-SE')}`}
</div>
```

### 5. Historik bevaras

#### Historik (us:history) påverkas inte:
- Mjuk-radering sätter endast `deletedAt` på entiteter
- Historik-entries i `us:history` lämnas orörda
- Dashboards kan fortfarande läsa historisk data
- Cleanup-funktionen rör inte `us:history`

## Testfall (`tests/soft-delete.test.ts`)

### 1. Alla entiteter får deletedAt?: string
- Verifierar att alla entiteter (Client, GFPPlan, WeeklyDoc, MonthlyReport, VismaWeek, Plan) har `deletedAt`-fält
- Kontrollerar att `deletedAt` är korrekt formaterat ISO-datum
- Testar att fältet är valfritt (optional)

### 2. UI/KPI filtrerar bort deletedAt != null i "nuet"
- Testar att aktiva klienter visas i listor
- Verifierar att mjuk-raderade klienter filtreras bort från UI
- Kontrollerar att KPI-beräkningar endast inkluderar aktiva klienter
- Testar GFP-planer filtrering

### 3. Historik (us:history) lämnas orörd
- Simulerar mjuk-radering av klient
- Verifierar att historik-entries fortfarande finns kvar
- Kontrollerar att historik är tillgänglig för dashboards
- Testar att historik inte påverkas av mjuk-radering

### 4. Återställning möjlig för soft-deleted poster
- Testar återställning av mjuk-raderad klient (ta bort `deletedAt`)
- Verifierar återställning av GFP-planer
- Kontrollerar återställning av veckodokument
- Testar återställning av månadsrapporter
- Verifierar återställning av Visma-veckor

## Tekniska detaljer

### Datastruktur:
```typescript
// Exempel på mjuk-raderad entitet
const softDeletedClient: Client = {
  id: 'client-1',
  name: 'Test Klient',
  // ... other fields
  deletedAt: '2024-01-15T10:00:00.000Z'  // ISO timestamp
};
```

### Filtreringslogik:
```typescript
// Aktiva entiteter (syns i UI/KPI)
const activeEntities = entities.filter(e => !e.deletedAt && !e.archivedAt);

// Mjuk-raderade entiteter (syns i arkiv-vy)
const softDeletedEntities = entities.filter(e => e.deletedAt);

// Arkiverade entiteter (syns i arkiv-vy)
const archivedEntities = entities.filter(e => e.archivedAt);
```

### Återställningslogik:
```typescript
// Återställ mjuk-raderad entitet
const restoredEntity = {
  ...softDeletedEntity,
  deletedAt: undefined  // Ta bort deletedAt för att återställa
};
```

## Acceptance Criteria ✅

- [x] Alla entiteter får `deletedAt?: string`
- [x] UI/KPI filtrerar bort `deletedAt != null` i "nuet"
- [x] Historik (us:history) lämnas orörd
- [x] Återställning möjlig för soft-deleted poster (ta bort `deletedAt`)
- [x] Soft-deleted syns ej i aktiva listor/KPI nuet
- [x] Historik kvar
- [x] Återställ fungerar
- [x] 4 testfall skapade och dokumenterade

## Användarupplevelse

### Beteende:
- **"Ta bort" knapp**: Sätter `deletedAt` istället för att radera
- **Aktiva listor**: Visar endast entiteter utan `deletedAt`
- **KPI-beräkningar**: Exkluderar mjuk-raderade entiteter
- **Arkiv-vy**: Visar både arkiverade och mjuk-raderade entiteter
- **Återställ-knapp**: Tar bort `deletedAt` för att återställa

### Meddelanden:
- **Bekräftelsedialog**: "Klienten försvinner från aktiva listor men all historik bevaras"
- **Impact summary**: "Mjuk-raderar X planer, Y veckor, Z månadsrapporter (bevaras för historik)"
- **Status i arkiv**: "Borttagen: 2024-01-15" eller "Arkiverad: 2024-01-10"

## Kompatibilitet

- **Bakåtkompatibilitet**: Befintliga entiteter utan `deletedAt` fungerar som tidigare
- **Migration**: Ingen migration behövs - `deletedAt` är valfritt
- **Performance**: Filtrering sker i minnet, minimal påverkan
- **Storage**: Mjuk-raderade entiteter bevaras i localStorage

## Framtida utvidgningar

### Valfria funktioner:
- **Permanent radering**: Hård radering av gamla mjuk-raderade entiteter
- **Bulk-återställning**: Återställ flera entiteter samtidigt
- **Återställningshistorik**: Logg över återställningar
- **Automatisk cleanup**: Rensa gamla mjuk-raderade entiteter efter X månader

### Prestanda-optimering:
- **Indexering**: Indexera mjuk-raderade entiteter för snabbare sökning
- **Pagination**: Paginera stora listor av mjuk-raderade entiteter
- **Caching**: Cache filtrerade listor för bättre prestanda
