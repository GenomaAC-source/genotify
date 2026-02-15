# Genotify & Dashboard

Questo progetto contiene sia il microservizio di gestione notifiche (backend) che la dashboard di amministrazione (frontend).

## Struttura del Progetto

```
.
├── src/                # Backend (Node.js/Express)
├── dashboard/          # Frontend Dashboard (Next.js)
├── prisma/             # Schema Database condiviso
└── package.json        # Script di root
```

## Setup Rapido

### 1. Requisiti
- Node.js 18+
- PostgreSQL in esecuzione

### 2. Installazione
```bash
npm install
cd dashboard && npm install
```

### 3. Configurazione
Crea i file `.env` sia nella root che in `dashboard/` seguendo gli esempi:
- `.env` (root): Database URL e API Key principale.
- `dashboard/.env`: Database URL, NextAuth Secret e Google OAuth Client ID/Secret.

### 4. Database
```bash
npx prisma migrate dev
```

## Esecuzione

Per avviare entrambi i servizi contemporaneamente:

```bash
# In un terminale (Backend - porta 3001)
npm run dev

# In un altro terminale (Dashboard - porta 3000)
cd dashboard && npm run dev
```

## Roadmap Dashboard
- ✅ Autenticazione Google OAuth
- ✅ Gestione Canali (CRUD)
- ✅ Visualizzazione Log in tempo reale
- ✅ System Tester integrato
- 🏗️ Statistiche avanzate

---

Per dettagli specifici sul backend, consulta il [README.md](README.md) principale.
Per iniziare subito a testare, vedi [QUICK_START.md](QUICK_START.md).
