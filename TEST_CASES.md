# Testfall för förbättrad "Ta bort"-flöde

## Testfall 1: Ta bort personal med klienter och data

**Scenario:** Ta bort en personal som har klienter med planer, veckodokumentation och månadsrapporter.

**Steg:**
1. Gå till "Personal"-vyn
2. Skapa en ny personal (t.ex. "Test Anna")
3. Lägg till 2 klienter till personalen (t.ex. "AB" och "CD")
4. Gå till klientvyn för AB och skapa en GFP-plan
5. Gå till klientvyn för CD och skapa en GFP-plan
6. Lägg till veckodokumentation för båda klienterna
7. Lägg till månadsrapporter för båda klienterna
8. Gå tillbaka till "Personal"-vyn
9. Klicka "Ta bort" på "Test Anna"

**Förväntat resultat:**
- Bekräftelsemodal öppnas
- Titel: "Ta bort personal"
- Beskrivning: "Är du säker på att du vill ta bort Test Anna? Detta går inte att ångra."
- Summering: "Detta påverkar: Tar bort 2 klienter, 2 planer, X veckor, Y månadsrapporter"
- Knappar: "Avbryt" (ljus) och "Ta bort" (röd #ff3b30)
- ESC stänger modalen
- Enter bekräftar borttagning

## Testfall 2: Ta bort klient med data

**Scenario:** Ta bort en klient som har planer, veckodokumentation och månadsrapporter.

**Steg:**
1. Gå till "Personal"-vyn
2. Välj en personal som har klienter
3. Klicka "Ta bort" på en klient som har data

**Förväntat resultat:**
- Bekräftelsemodal öppnas
- Titel: "Ta bort klient"
- Beskrivning: "Är du säker på att du vill ta bort [klientnamn]? Detta går inte att ångra."
- Summering: "Detta påverkar: Tar bort X planer, Y veckor, Z månadsrapporter"
- Knappar: "Avbryt" (ljus) och "Ta bort" (röd #ff3b30)
- ESC stänger modalen
- Enter bekräftar borttagning

## Testfall 3: Ta bort plan

**Scenario:** Ta bort en GFP-plan från en klient.

**Steg:**
1. Gå till klientvyn för en klient som har flera planer
2. Klicka på "×"-knappen bredvid en plan

**Förväntat resultat:**
- Bekräftelsemodal öppnas
- Titel: "Ta bort plan"
- Beskrivning: "Är du säker på att du vill ta bort [plannamn]? Detta går inte att ångra."
- Summering: "Detta påverkar: Tar bort 1 plan"
- Knappar: "Avbryt" (ljus) och "Ta bort" (röd #ff3b30)
- ESC stänger modalen
- Enter bekräftar borttagning

## Allmänna krav som ska testas:

- [ ] Ingen radering sker utan bekräftelse
- [ ] Summering visas korrekt för alla typer av borttagning
- [ ] Keyboard-stöd fungerar (ESC stänger, Enter bekräftar)
- [ ] Knappar har rätt färger (#ff3b30 för "Ta bort", ljus för "Avbryt")
- [ ] Modal har inline-styles enligt projektreglerna
- [ ] TypeScript strict mode följs
- [ ] Svenska texter används
- [ ] cleanupClientLocalStorage(...) körs vid bekräftelse


