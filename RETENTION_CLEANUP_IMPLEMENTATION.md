# Retention Cleanup Implementation

## Sammanfattning

Automatisk rensning av gamla arkiverade/soft-deleted poster har nu implementerats enligt kraven. Funktionaliteten är integrerad i Arkiv-vyn och erbjuder säker export innan rensning.

## Implementerade funktioner

### 1. `retentionSweep(cutoffDays: number)` ✅
- **Placering**: `src/App.tsx:179-285`
- **Funktion**: Identifierar alla poster äldre än specificerat antal dagar
- **Söker genom**: 
  - Arkiverade klienter (`archivedAt`)
  - Soft-deleted klienter (`deletedAt`)
  - Soft-deleted planer inom aktiva klienter
  - Soft-deleted veckorapporter, månadsrapporter, Visma-veckor
- **Returnerar**: Lista med poster att rensa + cutoff-datum
- **TypeScript**: Fullständigt typad med `Client | GFPPlan | WeeklyDoc | MonthlyReport | VismaWeek`

### 2. Export-funktionalitet ✅
- **JSON Export**: `exportToJSON()` - Exporterar strukturerad data som JSON
- **CSV Export**: `exportToCSV()` - Konverterar till CSV-format med escape-hantering
- **Automatisk filnamn**: Tidsstämpel inkluderat (`ungdomsstod-retention-export-YYYY-MM-DDTHH-mm-ss`)
- **Datastruktur**: `{ type, id, staffId, clientId, deletedAt, data }`

### 3. UI-integration i ArchiveView ✅
- **Retention Controls**: Nytt kort högst upp i Arkiv-vyn
- **Inställning**: Konfigurerbar retention period (standard 180 dagar)
- **Knappar**: 
  - 🗃️ "Exportera gamla poster" - Exporterar utan att rensa
  - 🗑️ "Rensa gamla poster" - Visar bekräftelse innan rensning
- **Bekräftelsedialog**: Använder befintlig `ConfirmDialog` med impact summary

### 4. Rensningsfunktion ✅
- **`executeRetentionCleanup()`**: Tar bort identifierade poster från AppState
- **Säker borttagning**: Kontrollerar att staff/klienter existerar innan rensning
- **Typer av rensning**:
  - Hela klienter (arkiverade/soft-deleted)
  - Individuella poster inom aktiva klienter (planer, docs, reports, visma)
- **Feedback**: Alert med antal rensade poster

### 5. Testfall ✅
**Fil**: `tests/retention-cleanup.test.ts`

**Test 1**: Identifierar gamla poster korrekt
- Skapar testdata med gamla (200 dagar) och nya (50 dagar) poster
- Verifierar att endast gamla poster hittas med 180-dagars cutoff

**Test 2**: Hanterar tomma resultat
- Kontrollerar att funktionen returnerar tom lista när inga gamla poster finns

**Test 3**: Olika retention-perioder
- Testar 100, 300, och 60 dagars cutoffs
- Verifierar att olika perioder ger rätt resultat

**Test 4**: Export-datastruktur
- Kontrollerar att export-data har korrekt struktur
- Verifierar JSON-serialisering av data

**Test 5**: Impact summary kategorisering
- Räknar poster per typ för impact summary
- Verifierar korrekt formatering av sammanfattning

## Användarflöde

1. **Användare navigerar till Arkiv-vyn**
2. **Ställer in retention period** (standard 180 dagar)
3. **Klickar "Exportera gamla poster"** (valfritt)
   - Laddar ner JSON och CSV med data som kommer rensas
4. **Klickar "Rensa gamla poster"**
   - Ser bekräftelsedialog med antal poster per typ
   - Bekräftar rensning
5. **Systemet rensar posterna** och visar bekräftelse

## Tekniska detaljer

### Datatyper som stöds för rensning:
- `client` - Hela klienter (arkiverade/soft-deleted)
- `plan` - GFP-planer (soft-deleted)
- `weeklyDoc` - Veckorapporter (soft-deleted)
- `monthlyReport` - Månadsrapporter (soft-deleted)
- `vismaWeek` - Visma-veckor (soft-deleted)

### Säkerhetsåtgärder:
- Bekräftelsedialog med detaljerad impact summary
- Export-möjlighet innan rensning
- Kontroll av att poster verkligen är gamla nog
- Säker borttagning med null-checks

### Historik bevaras:
- `us:history` localStorage-data påverkas INTE av retention cleanup
- Endast live AppState-data rensas
- Historiska KPI-data finns kvar för rapporter

## Acceptance Criteria - Uppfyllda ✅

✅ **Retention**: Konfigurerbar retention period (180 dagar default)  
✅ **"Rensa arkiv"**: Visar antal poster, kräver bekräftelse  
✅ **Export före rensning**: JSON/CSV export av data som ska rensas  
✅ **Historik bevaras**: `us:history` lämnas orörd  
✅ **Kan exportera innan rensning**: Separat export-knapp  
✅ **Rensning tar inte bort history**: Endast AppState påverkas  
✅ **LS är rent efter rensning**: Gamla poster tas bort från localStorage  

## Filer modifierade:
- `src/App.tsx` - Huvudimplementation
- `tests/retention-cleanup.test.ts` - Testfall (nytt)
- `RETENTION_CLEANUP_IMPLEMENTATION.md` - Denna dokumentation (nytt)

**Status**: ✅ Komplett implementering enligt alla krav
