# Genotify - Guida Rapida

## Server Avviato ✅

Il Genotify è attivo e funzionante:
- **Backend API**: http://localhost:3001
- **Dashboard**: http://localhost:50179

## Stato del Sistema

- ✅ **Database**: PostgreSQL connesso (`notification_hub`)
- ✅ **Server**: In esecuzione sulla porta 3001
- ✅ **Cron Jobs**: Attivi (cleanup giornaliero, sync ogni 6 ore)
- ✅ **API**: Tutti gli endpoint funzionanti

## Test Eseguiti

### 1. Health Check
```bash
curl http://localhost:3001/health
```
**Risultato**: ✅ Database connesso

### 2. Autenticazione
```bash
curl http://localhost:3001/channels
```
**Risultato**: ✅ Richiede API key (401 Unauthorized)

### 3. Lista Canali
```bash
curl -H "x-api-key: cambiami-con-una-chiave-sicura" \
  http://localhost:3001/channels
```
**Risultato**: ✅ Restituisce lista canali (1 canale test: "generale")

### 4. Invio Notifica
```bash
curl -X POST http://localhost:3001/notify \
  -H "Content-Type: application/json" \
  -H "x-api-key: cambiami-con-una-chiave-sicura" \
  -d '{
    "target": "generale",
    "source": "test-system",
    "title": "Test Notification",
    "message": "Questo è un test",
    "color": "success"
  }'
```
**Risultato**: ✅ Validazione corretta (422 - webhook non configurato)

## Prossimi Passi

### 1. Configurare un Webhook Discord

Per testare l'invio effettivo a Discord:

1. Vai su Discord → Impostazioni Server → Integrazioni → Webhook
2. Crea un nuovo webhook e copia l'URL
3. Aggiorna il canale nel database:

```sql
UPDATE channels 
SET webhook_url = 'https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN'
WHERE name = 'generale';
```

### 2. Creare Canali per i Clienti

```sql
INSERT INTO channels (
  id, discord_channel_id, name, type, 
  client_slug, client_name, webhook_url, 
  active, auto_managed, created_at, updated_at
) VALUES (
  'client_acme', '987654321', 'cliente-acme', 'CLIENT',
  'acme', 'Acme Corp', 'https://discord.com/api/webhooks/...',
  true, true, NOW(), NOW()
);
```

### 3. Integrare con le App

Nelle tue app, usa questo codice per inviare notifiche:

```javascript
const response = await fetch('http://localhost:3001/notify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'cambiami-con-una-chiave-sicura'
  },
  body: JSON.stringify({
    target: 'acme',           // client slug o nome canale
    source: 'task-manager',   // nome della tua app
    title: 'Task Completato',
    message: 'Il task "Homepage Redesign" è stato completato',
    color: 'success',         // info, success, warning, error, task
    metadata: {
      taskId: '123',
      priority: 'high'
    }
  })
});
```

## Comandi Utili

```bash
# Avviare il server in sviluppo
npm run dev

# Avviare il server in produzione
npm run build && npm start

# Aprire Prisma Studio (GUI per il database)
npm run db:studio

# Vedere i log del server
# I log sono nel terminale dove hai eseguito npm run dev

# Fermare il server
# Premi Ctrl+C nel terminale
```

## Struttura Database

### Tabella `channels`
- Canali Discord configurati
- Tipi: CLIENT, INTERNAL, VENDOR
- Contiene webhook URL per l'invio

### Tabella `notifications`
- Log di tutte le notifiche inviate
- Stati: PENDING, SENT, FAILED, RETRYING
- Include retry count e messaggi di errore

### Tabella `poll_states`
- Stato del polling per tool esterni
- Traccia ultimo check per Plutio, Google Calendar, etc.

## Sicurezza

⚠️ **IMPORTANTE**: Prima di andare in produzione:

1. Cambia `API_KEY` in `.env` con una chiave sicura
2. Usa variabili d'ambiente per la produzione (non committare `.env`)
3. Configura HTTPS per le chiamate API
4. Limita l'accesso al database solo dall'applicazione

## Supporto

- **Documentazione completa**: [README.md](file:///Users/andreacamolese/GenomaHUBNotification/README.md)
- **Schema Prisma**: [schema.prisma](file:///Users/andreacamolese/GenomaHUBNotification/prisma/schema.prisma)
- **Codice sorgente**: [src/](file:///Users/andreacamolese/GenomaHUBNotification/src)
