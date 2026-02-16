# Deploy GeNotify GRATUITO su Render.com

Deploy completo di GeNotify usando i piani gratuiti di Render e Vercel.

## 🆓 Piano Gratuito - Cosa Include

### Render.com (Backend)
- ✅ **Web Service gratuito**
  - 750 ore/mese di compute
  - Va in sleep dopo 15 min di inattività
  - Riavvio automatico alla prima richiesta (~30 sec)
- ✅ **PostgreSQL gratuito**
  - 1 GB storage
  - Scade dopo 90 giorni (poi serve upgrade o migrazione)

### Vercel (Frontend)
- ✅ **Completamente gratuito**
  - 100 GB bandwidth/mese
  - Deploy illimitati
  - HTTPS automatico

**Totale Costi: $0/mese** 🎉

## ⚠️ Limitazioni del Piano Gratuito

1. **Sleep Mode**: Dopo 15 minuti di inattività, il servizio va in sleep. Il primo accesso successivo richiede ~30 secondi per riavviare.

2. **Database**: Scade dopo 90 giorni. Dovrai:
   - Migrare a un nuovo database gratuito, oppure
   - Passare al piano Starter ($7/mese)

3. **Discord Bot**: Potrebbe disconnettersi durante il sleep. Si riconnette automaticamente al riavvio.

4. **Performance**: Più lento del piano a pagamento, ma sufficiente per test e uso personale.

## 🚀 Passaggi per il Deploy

### 1. Commit del Codice

```bash
cd /Users/andreacamolese/Genotify
git add .
git commit -m "Deploy configuration for free tier"
git push origin main
```

### 2. Deploy su Render.com

1. Vai su [Render Dashboard](https://dashboard.render.com)
2. Click **"New"** → **"Blueprint"**
3. Connetti il tuo repository GitHub/GitLab
4. Render leggerà `render.yaml` e creerà:
   - Database PostgreSQL gratuito
   - Web Service gratuito (API + Discord Bot combinati)

### 3. Configura Variabili d'Ambiente

Nel servizio `genotify`, aggiungi queste variabili:

```
API_KEY=2b77243035af61190f7603144640176382d458828d2c0610af55ad11119adfde
DISCORD_BOT_TOKEN=[tuo token da Discord Developer Portal]
DISCORD_GUILD_ID=[tuo server Discord ID]
```

**Come ottenere i valori:**
- `DISCORD_BOT_TOKEN`: Discord Developer Portal → Applications → Bot → Token
- `DISCORD_GUILD_ID`: Discord → Click destro sul server → "Copia ID" (abilita Developer Mode prima)

### 4. Esegui Migrazioni Database

Dopo il primo deploy:

1. Vai sul servizio `genotify`
2. Tab **"Shell"**
3. Esegui:
   ```bash
   npx prisma migrate deploy
   ```

### 5. Ottieni l'URL del Database

1. Vai su `genotify-db` nella dashboard
2. Copia **"External Database URL"**
3. Lo userai per il dashboard Vercel

### 6. Deploy Dashboard su Vercel

1. Vai su [Vercel Dashboard](https://vercel.com/dashboard)
2. **"Add New Project"** → Importa il repository
3. Configura:
   - **Root Directory**: `dashboard`
   - **Framework**: Next.js (rilevato automaticamente)
4. Aggiungi variabili d'ambiente:

```
DATABASE_URL=[URL da Render.com]
NEXTAUTH_URL=https://tuo-dominio.vercel.app
NEXTAUTH_SECRET=n/T3uqJ/FJXRUW3UezdSXfFI73Fmv8smU01znSspZmY=
GOOGLE_CLIENT_ID=[tuo Google Client ID]
GOOGLE_CLIENT_SECRET=[tuo Google Client Secret]
```

5. Click **"Deploy"**

### 7. Configura Google OAuth

1. Vai su [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Seleziona le tue OAuth credentials
3. Aggiungi agli **"Authorized redirect URIs"**:
   ```
   https://tuo-dominio.vercel.app/api/auth/callback/google
   ```

### 8. Aggiorna GeNomaPlanner

Nel backend di GeNomaPlanner, aggiorna `.env`:

```env
GENOTIFY_URL="https://genotify.onrender.com"
GENOTIFY_API_KEY="2b77243035af61190f7603144640176382d458828d2c0610af55ad11119adfde"
```

**⚠️ IMPORTANTE**: L'URL di Render sarà nel formato `https://genotify-xxxx.onrender.com` (verifica nella dashboard)

## ✅ Verifica Deploy

### Test Backend API:

```bash
# Health check
curl https://genotify-xxxx.onrender.com/health

# Test channels (con API key)
curl https://genotify-xxxx.onrender.com/channels \
  -H "x-api-key: 2b77243035af61190f7603144640176382d458828d2c0610af55ad11119adfde"
```

### Test Frontend:

Visita `https://tuo-dominio.vercel.app`:
- Dovresti vedere la pagina di login
- Il login Google dovrebbe funzionare
- Dashboard con notifiche visibili dopo login

## 💡 Consigli per il Piano Gratuito

### Evitare Sleep Mode

Se vuoi mantenere il servizio "sempre attivo" (senza sleep):

**Opzione 1: Ping Service (Gratis)**
- Usa [UptimeRobot](https://uptimerobot.com) (gratuito)
- Configura un ping ogni 5 minuti a `https://genotify-xxxx.onrender.com/health`
- Mantiene il servizio sveglio durante le ore di utilizzo

**Opzione 2: Cron Job**
```bash
# Sul tuo computer o altro server
*/5 * * * * curl https://genotify-xxxx.onrender.com/health
```

### Gestire Scadenza Database (90 giorni)

**Prima che scada:**

1. **Esporta i dati**:
   ```bash
   # Nel shell di Render
   pg_dump $DATABASE_URL > backup.sql
   ```

2. **Crea nuovo database gratuito** su Render

3. **Importa i dati**:
   ```bash
   psql $NEW_DATABASE_URL < backup.sql
   ```

4. **Aggiorna URL** nelle variabili d'ambiente

Oppure passa a piano Starter ($7/mese) per database permanente.

## 🔄 Aggiornamenti

Per aggiornare il servizio:

```bash
git add .
git commit -m "Update"
git push origin main
```

Render e Vercel rideploya no automaticamente.

## 🆙 Upgrade a Piano Pagamento

Quando vuoi migliorare performance:

1. Render Dashboard → Servizio → Settings → Change Plan
2. Scegli **Starter** ($7/mese):
   - No sleep mode
   - Migliori performance
   - Database permanente

## 📊 Monitoraggio

**Render:**
- Dashboard → Metrics per CPU/Memory
- Logs per debugging

**Vercel:**
- Analytics tab per traffico frontend
- Function logs per errori

## ⚡ Troubleshooting

**"Service unavailable" per 30 secondi:**
- Normale! È il cold start dopo lo sleep
- Considera UptimeRobot per evitarlo

**Database connection error:**
- Verifica che `DATABASE_URL` sia corretto
- Check che le migrazioni siano state eseguite
- Il database gratuito potrebbe essere scaduto (90 giorni)

**Bot Discord disconnesso:**
- Normale dopo sleep mode
- Si riconnette automaticamente al riavvio
- Per connessione stabile, considera upgrade a Starter

**Rate limit errors:**
- Piano gratuito ha rate limit più bassi
- Riduci frequenza delle richieste
- Considera upgrade se necessario

## 📞 Supporto

- **Render Docs**: https://render.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **GeNotify Issues**: [Il tuo repository]/issues

---

**🎯 Deploy completato! Tutto funziona gratuitamente con queste limitazioni. Quando serve più performance, upgrade è facile e immediato.**
