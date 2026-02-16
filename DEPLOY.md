# Deploy GeNotify - Guida Completa

Questa guida spiega come deployare l'intera infrastruttura GeNotify.

## Architettura di Deploy

```
┌─────────────────────────────────────────────────┐
│              GeNotify Stack                      │
├─────────────────────────────────────────────────┤
│                                                  │
│  Backend (Render.com)                            │
│  ├─ API Service (genotify-api)                  │
│  ├─ Discord Bot Worker (genotify-discord-bot)   │
│  └─ PostgreSQL Database (genotify-db)           │
│                                                  │
│  Frontend (Vercel.com)                           │
│  └─ Dashboard Next.js (genotify-dashboard)      │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Quick Start

1. **Backend su Render.com** → Seguire questa guida
2. **Frontend su Vercel** → Vedere `dashboard/DEPLOY_VERCEL.md`

---

# Deploy Backend su Render.com

## Prerequisiti

1. Account Render.com
2. Repository Git con il codice di GeNotify
3. Discord Bot Token e Guild ID
4. API Key generata per l'autenticazione

## Passaggi per il Deploy

### 1. Prepara il Repository

```bash
# Assicurati che tutti i file siano committati
cd /Users/andreacamolese/Genotify
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 2. Crea i Servizi su Render

#### Opzione A: Deploy Automatico (Consigliato)

1. Vai su [Render Dashboard](https://dashboard.render.com)
2. Click su "New" → "Blueprint"
3. Connetti il tuo repository GitHub/GitLab
4. Render leggerà automaticamente `render.yaml` e creerà:
   - Database PostgreSQL (`genotify-db`)
   - Web Service API (`genotify-api`)
   - Worker Service Bot (`genotify-discord-bot`)

#### Opzione B: Deploy Manuale

**Database:**
1. New → PostgreSQL
2. Name: `genotify-db`
3. Region: Frankfurt (o più vicino ai tuoi utenti)
4. Plan: Starter ($7/month)

**API Service:**
1. New → Web Service
2. Connect repository
3. Name: `genotify-api`
4. Runtime: Node
5. Build Command: `npm install && npx prisma generate && npm run build`
6. Start Command: `npm start`
7. Plan: Starter ($7/month)

**Discord Bot:**
1. New → Background Worker
2. Connect repository
3. Name: `genotify-discord-bot`
4. Build Command: `cd discord-bot && npm install && npx prisma generate && npm run build`
5. Start Command: `cd discord-bot && npm start`
6. Plan: Starter ($7/month)

### 3. Configura le Variabili d'Ambiente

#### Per `genotify-api`:

```
NODE_ENV=production
PORT=3060
DATABASE_URL=[copiato automaticamente dal database]
API_KEY=2b77243035af61190f7603144640176382d458828d2c0610af55ad11119adfde
```

#### Per `genotify-discord-bot`:

```
NODE_ENV=production
DATABASE_URL=[copiato automaticamente dal database]
DISCORD_BOT_TOKEN=[il tuo token da Discord Developer Portal]
DISCORD_GUILD_ID=[l'ID del tuo server Discord]
```

### 4. Esegui le Migrazioni del Database

Dopo il primo deploy:

1. Vai su `genotify-api` service
2. Click su "Shell" tab
3. Esegui: `npx prisma migrate deploy`

### 5. Verifica il Deploy

**Test Health Check:**
```bash
curl https://genotify-api.onrender.com/health
```

Dovresti ricevere:
```json
{
  "status": "ok",
  "timestamp": "...",
  "database": "connected"
}
```

**Test Channels Endpoint:**
```bash
curl https://genotify-api.onrender.com/channels \
  -H "x-api-key: 2b77243035af61190f7603144640176382d458828d2c0610af55ad11119adfde"
```

### 6. Ottieni il DATABASE_URL

Una volta creato il database su Render:

1. Vai su `genotify-db` nella dashboard
2. Copia "External Database URL"
3. Questo sarà necessario per il dashboard su Vercel

### 7. Aggiorna GeNomaPlanner

Aggiorna le variabili d'ambiente in GeNomaPlanner per puntare al servizio GeNotify deployato:

```env
GENOTIFY_URL="https://genotify-api.onrender.com"
GENOTIFY_API_KEY="2b77243035af61190f7603144640176382d458828d2c0610af55ad11119adfde"
```

---

## Deploy Frontend Dashboard

Il frontend dashboard viene deployato su **Vercel**.

📖 **Guida completa**: `dashboard/DEPLOY_VERCEL.md`

**Quick steps:**
1. Deploy su Vercel
2. Configura variabili d'ambiente (usa DATABASE_URL da Render)
3. Aggiungi redirect URI in Google OAuth

---

## Monitoraggio

- **Logs**: Visibili nella dashboard Render per ogni servizio
- **Metrics**: CPU, Memory, Request count nella tab Metrics
- **Alerts**: Configurabili per downtime o errori
- **Dashboard**: Accessibile via Vercel per monitoring frontend

## Costi Totali Stimati

### Render.com (Backend)
- Database PostgreSQL Starter: $7/mese
- API Web Service Starter: $7/mese
- Discord Bot Worker Starter: $7/mese
- **Subtotale Render: $21/mese**

### Vercel (Frontend)
- Hobby Plan: **GRATUITO**

### **TOTALE: ~$21/mese**

## Note Importanti

1. **Sleep Mode**: I servizi gratuiti su Render vanno in sleep dopo 15 minuti di inattività. Usa plan Starter per evitarlo.

2. **Database Backups**: Render fa backup automatici del database. Configurabili nelle impostazioni.

3. **Auto-Deploy**: Ogni push su `main` triggera un nuovo deploy automatico su entrambi i servizi.

4. **Environment Variables**: Sono sicure e criptate. NON commitare mai `.env` nel repository.

5. **Rate Limits**:
   - API generale: 100 req/15 min
   - Notifiche: 30 req/min (allineato ai limiti Discord)

6. **Database Condiviso**: Backend e Frontend usano lo stesso database PostgreSQL su Render.

## Sicurezza Implementata

✅ **API Key robusta**: 64 caratteri hex
✅ **Rate Limiting**: Protezione contro abusi
✅ **HTTPS**: Automatico su Render e Vercel
✅ **NextAuth**: Autenticazione sicura per dashboard
✅ **Environment Variables**: Criptate e sicure

## Troubleshooting

**Il bot non si connette a Discord:**
- Verifica che `DISCORD_BOT_TOKEN` sia corretto
- Controlla i logs del worker service
- Assicurati che il bot abbia i permessi necessari nel server

**Errori di connessione al database:**
- Verifica che `DATABASE_URL` sia configurato correttamente
- Controlla che le migrazioni siano state eseguite
- Assicurati che il database Render permetta connessioni esterne

**401 Unauthorized:**
- Verifica che l'header `x-api-key` sia presente e corretto
- Assicurati che GeNomaPlanner usi la stessa API key

**Dashboard login non funziona:**
- Verifica Google OAuth redirect URIs
- Controlla `NEXTAUTH_URL` e `NEXTAUTH_SECRET`
- Vedi troubleshooting in `dashboard/DEPLOY_VERCEL.md`

## Aggiornamenti

Per deployare aggiornamenti:

**Backend:**
```bash
cd /Users/andreacamolese/Genotify
git add .
git commit -m "Update: description"
git push origin main
```

**Frontend:**
```bash
cd /Users/andreacamolese/Genotify/dashboard
git add .
git commit -m "Update dashboard: description"
git push origin main
```

Render e Vercel rilevano automaticamente i push e rideploya no i servizi.

## Link Utili

- [Render Dashboard](https://dashboard.render.com)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Discord Developer Portal](https://discord.com/developers/applications)
- [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
