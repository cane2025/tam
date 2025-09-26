# Ungdomsstöd V2

Modern webapp för ungdomsstöd med SQLite, Express.js API och React TypeScript frontend.

## Funktioner

- **GDPR-kompatibel** - Inga personnummer lagras
- **Europe/Stockholm tidszon** - Alla datum hanteras korrekt
- **Idempotent API** - Säkra POST/PUT operationer
- **JWT autentisering** - Med dev-token för utveckling
- **SQLite databas** - Enkel deployment och backup
- **TypeScript strict mode** - Type-säker kod
- **Thunder Client tester** - Komplett API test suite

## Snabbstart

### 1. Installera dependencies
```bash
npm install
```

### 2. Kör databas migration
```bash
npm run db:migrate
```

### 3. Fyll databas med testdata
```bash
npm run db:seed
```

### 4. Starta utvecklingsservrar
```bash
npm run dev
```

Detta startar:
- API server på http://localhost:3001
- React frontend på http://localhost:5175

## API Endpoints

### Autentisering
- `POST /api/auth/login` - Logga in
- `POST /api/auth/register` - Registrera ny användare
- `POST /api/auth/verify` - Verifiera JWT token

### Klienter
- `GET /api/clients` - Hämta klienter
- `POST /api/clients` - Skapa ny klient
- `PUT /api/clients/:id` - Uppdatera klient
- `DELETE /api/clients/:id` - Ta bort klient

### Vårdplaner
- `GET /api/care-plans` - Hämta vårdplaner
- `POST /api/care-plans` - Skapa vårdplan
- `PUT /api/care-plans/:id` - Uppdatera vårdplan

### Veckodokumentation
- `GET /api/weekly-docs` - Hämta veckodokumentation
- `POST /api/weekly-docs` - Skapa veckodokumentation
- `PUT /api/weekly-docs/:id` - Uppdatera veckodokumentation

### Månadsrapporter
- `GET /api/monthly-reports` - Hämta månadsrapporter
- `POST /api/monthly-reports` - Skapa månadsrapport
- `PUT /api/monthly-reports/:id` - Uppdatera månadsrapport

### Visma Tid
- `GET /api/visma-time` - Hämta Visma tid
- `POST /api/visma-time` - Skapa Visma tidsregistrering
- `PUT /api/visma-time/:id` - Uppdatera Visma tid

### Dashboard
- `GET /api/dashboard/kpis` - Hämta KPI:er
- `GET /api/dashboard/weekly-stats` - Veckostatistik
- `GET /api/dashboard/monthly-stats` - Månadsstatistik

## Testdata

Efter `npm run db:seed` finns följande användare:

**Admin:**
- Email: `admin@ungdomsstod.se`
- Lösenord: `admin123`

**Personal:**
- Email: `anna@ungdomsstod.se` / Lösenord: `staff123`
- Email: `johan@ungdomsstod.se` / Lösenord: `staff123`
- Email: `maria@ungdomsstod.se` / Lösenord: `staff123`
- Email: `erik@ungdomsstod.se` / Lösenord: `staff123`

## Utveckling

### Dev Token
I utvecklingsläge kan du använda dev-token:
```
X-Dev-Token: dev-token-for-testing
```

### Thunder Client
Importera `thunder-tests/ungdomsstod-v2-api.json` i Thunder Client för att testa alla API endpoints.

### Tester
```bash
# Kör alla tester
npm test

# Kör endast timezone tester
npm run test:timezone

# Kör endast idempotency tester
npm run test:idempotency
```

### Idempotency
Alla POST/PUT operationer stöder idempotency keys:
```
Idempotency-Key: unique-key-123
```

### Tidszon
Alla datum hanteras i Europe/Stockholm tidszon med automatisk sommar/vintertid.

## Produktion

### Environment Variables
```bash
NODE_ENV=production
JWT_SECRET=your-secret-key
PORT=3001
DB_PATH=/path/to/database.db
```

### Build
```bash
npm run build
```

## Teknisk Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Express.js + TypeScript
- **Databas:** SQLite med better-sqlite3
- **Autentisering:** JWT tokens
- **Tidszon:** date-fns + date-fns-tz
- **Tester:** Vitest
- **API Tester:** Thunder Client

## GDPR Compliance

- Inga personnummer lagras
- Klienter identifieras med initialer (t.ex. "AB", "CD")
- Alla datum hanteras säkert i Stockholm tidszon
- Automatisk backup och cleanup av gamla data