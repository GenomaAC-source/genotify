# Genotify — Istruzioni per lo Sviluppo

## Panoramica

Devi creare un microservizio chiamato **Genotify**. È un servizio centralizzato che riceve richieste di notifica dalle app dell'agenzia e le instrada sui canali Discord corretti tramite webhook.

Il servizio NON include il bot Discord (lo gestisco io separatamente). Il servizio si occupa di:

- Esporre API REST per ricevere notifiche dalle app
- Esporre API REST per restituire la lista dei canali configurati
- Mandare messaggi su Discord tramite webhook URL salvati nel database
- Gestire retry e rate limiting verso Discord
- Eseguire cron job per polling di tool esterni
- Loggare tutte le notifiche mandate

## Stack Tecnologico (OBBLIGATORIO — non cambiare)

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Cron**: node-cron
- **Package manager**: npm
- **Bundler/compiler**: tsc (tsconfig con target ES2020, module NodeNext)

NON usare: Fastify, Drizzle, Bun, yarn, pnpm, o alternative allo stack indicato.

## Struttura del Progetto

```
genotify/
├── src/
│   ├── index.ts                    # Entry point: Express server + scheduler
│   ├── routes/
│   │   ├── notify.ts               # POST /notify, POST /notify/bulk
│   │   ├── channels.ts             # GET /channels
│   │   └── health.ts               # GET /health
│   ├── services/
│   │   ├── discord.service.ts      # Invio messaggi via webhook Discord
│   │   └── notification.service.ts # Orchestrazione: risolvi target → manda → logga
│   ├── jobs/
│   │   ├── scheduler.ts            # Registrazione cron jobs
│   │   └── poll-external.ts        # Template per polling tool esterni
│   ├── middleware/
│   │   └── auth.ts                 # Validazione API key
│   ├── lib/
│   │   └── prisma.ts               # Istanza Prisma client (singleton)
│   └── config/
│       └── env.ts                  # Parsing e validazione variabili d'ambiente
├── prisma/
│   └── schema.prisma
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

## Schema Prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Channel {
  id              String      @id @default(cuid())
  discordId       String      @unique @map("discord_channel_id")
  name            String
  type            ChannelType @default(CLIENT)
  clientSlug      String?     @unique @map("client_slug")
  clientName      String?     @map("client_name")
  webhookId       String?     @map("discord_webhook_id")
  webhookUrl      String?     @map("discord_webhook_url")
  categoryName    String?     @map("category_name")
  active          Boolean     @default(true)
  autoManaged     Boolean     @default(true) @map("auto_managed")
  createdAt       DateTime    @default(now()) @map("created_at")
  updatedAt       DateTime    @updatedAt @map("updated_at")
  notifications   Notification[]

  @@map("channels")
}

enum ChannelType {
  CLIENT
  INTERNAL
  VENDOR
}

model Notification {
  id          String             @id @default(cuid())
  channelId   String?            @map("channel_id")
  channel     Channel?           @relation(fields: [channelId], references: [id])
  target      String
  source      String
  title       String
  message     String
  metadata    Json?
  color       String?
  status      NotificationStatus @default(PENDING)
  sentAt      DateTime?          @map("sent_at")
  error       String?
  retries     Int                @default(0)
  createdAt   DateTime           @default(now()) @map("created_at")

  @@index([channelId, createdAt])
  @@index([status])
  @@map("notifications")
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
  RETRYING
}

model PollState {
  id          String   @id @default(cuid())
  source      String   @unique
  lastChecked DateTime @map("last_checked")
  metadata    Json?
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("poll_states")
}
```

## Variabili d'Ambiente

File `.env.example`:

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/notification_hub

# Autenticazione API (condivisa con le app che chiamano il hub)
API_KEY=cambiami-con-una-chiave-sicura

# Tool Esterni (opzionali, per cron jobs futuri)
# PLUTIO_API_KEY=
# GOOGLE_CALENDAR_CREDENTIALS=
```

Il file `src/config/env.ts` deve:
- Leggere le variabili con `process.env`
- Validare che PORT, DATABASE_URL e API_KEY siano presenti
- Esportare un oggetto `env` tipizzato

## API Endpoints — Specifiche Dettagliate

### Middleware Auth

Tutte le route (tranne GET /health) richiedono l'header `x-api-key`. Il middleware controlla che il valore corrisponda a `env.API_KEY`. Se non corrisponde, risponde 401.

### GET /health

Nessuna autenticazione richiesta.

Risposta 200:
```json
{
  "status": "ok",
  "timestamp": "2025-02-15T10:30:00.000Z",
  "database": "connected"
}
```

Se il database non è raggiungibile, risponde comunque 200 ma con `"database": "disconnected"`. Non deve crashare.

### GET /channels

Restituisce tutti i canali attivi (`active: true`), raggruppati per tipo.

Risposta 200:
```json
{
  "clients": [
    {
      "slug": "acme",
      "name": "Acme Corp",
      "channelName": "cliente-acme",
      "active": true
    }
  ],
  "internal": [
    {
      "name": "generale",
      "channelName": "generale"
    }
  ],
  "vendors": [
    {
      "name": "fornitore-design",
      "channelName": "fornitore-design"
    }
  ]
}
```

### POST /notify

Manda una singola notifica.

Request body:
```json
{
  "target": "acme",
  "source": "app1",
  "title": "Task completato",
  "message": "Il task 'Redesign homepage' è stato completato.",
  "color": "success",
  "metadata": {
    "taskId": "abc123",
    "priority": "high"
  }
}
```

Campi obbligatori: `target`, `source`, `title`, `message`.
Campi opzionali: `color` (default: "info"), `metadata`.

Valori ammessi per `color`: "info", "success", "warning", "error", "task".

**Logica di risoluzione del target:**
1. Cerca un Channel con `clientSlug === target` e `type === CLIENT`
2. Se non trovato, cerca un Channel con `name === target` (qualsiasi tipo)
3. Se non trovato, risponde 404

Se il canale trovato non ha `webhookUrl`, risponde 422 con messaggio esplicativo.

Risposta 200:
```json
{
  "success": true,
  "notificationId": "clxyz123..."
}
```

Risposta 404:
```json
{
  "success": false,
  "error": "Target 'xyz' not found"
}
```

Risposta 422:
```json
{
  "success": false,
  "error": "Channel 'acme' has no webhook configured"
}
```

### POST /notify/bulk

Manda la stessa notifica a più target.

Request body:
```json
{
  "targets": ["acme", "beta", "generale"],
  "source": "cron-weekly-report",
  "title": "Report settimanale",
  "message": "Il report è disponibile.",
  "color": "info"
}
```

Risolve ogni target indipendentemente. Se alcuni falliscono, li riporta nel risultato senza bloccare gli altri.

Risposta 200:
```json
{
  "success": true,
  "results": [
    { "target": "acme", "success": true, "notificationId": "cl..." },
    { "target": "beta", "success": true, "notificationId": "cl..." },
    { "target": "inesistente", "success": false, "error": "Target 'inesistente' not found" }
  ]
}
```

## Discord Service — Specifiche Dettagliate

Il file `discord.service.ts` gestisce l'invio dei messaggi ai webhook Discord.

### Formato del Messaggio

Ogni messaggio viene inviato come embed Discord tramite POST HTTP al webhook URL:

```typescript
// Payload inviato al webhook Discord
{
  username: "Genotify",
  embeds: [{
    title: notification.title,
    description: notification.message,
    color: colorMap[notification.color || "info"],
    fields: [
      { name: "Fonte", value: notification.source, inline: true },
      // Se il canale è di tipo CLIENT, aggiungi anche:
      { name: "Cliente", value: channel.clientName || channel.clientSlug, inline: true }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: "Genotify" }
  }]
}
```

### Mappa Colori

```typescript
const colorMap: Record<string, number> = {
  info:    0x5865F2,  // Blu Discord
  success: 0x57F287,  // Verde
  warning: 0xFEE75C,  // Giallo
  error:   0xED4245,  // Rosso
  task:    0xEB459E,  // Viola
};
```

### Rate Limiting

Discord permette 30 messaggi/minuto per webhook. Il servizio deve:
- Rispettare il rate limit
- Se riceve una risposta 429 da Discord, leggere l'header `retry-after` e attendere quel numero di secondi

### Retry Logic

In caso di fallimento (errore di rete, 5xx da Discord, 429):
1. Primo retry dopo 1 secondo
2. Secondo retry dopo 5 secondi
3. Terzo retry dopo 15 secondi
4. Dopo 3 tentativi falliti, la notifica viene marcata come `FAILED`

Ogni tentativo aggiorna il campo `retries` nel database. Lo status passa a `RETRYING` durante i retry e a `FAILED` o `SENT` alla fine.

### Invio HTTP

Usa `fetch` nativo di Node.js (disponibile da Node 18+). NON installare axios o node-fetch.

```typescript
const response = await fetch(webhookUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
```

## Notification Service — Specifiche

Il file `notification.service.ts` orchestra il flusso completo:

1. Riceve il payload dalla route
2. Risolve il target (clientSlug → Channel, oppure name → Channel)
3. Crea il record Notification con status PENDING
4. Chiama il discord service per mandare il messaggio
5. Aggiorna lo status a SENT (con sentAt) o FAILED (con error)
6. Ritorna il risultato

Il servizio deve essere una classe o un oggetto con metodi `send()` e `sendBulk()`.

## Cron Jobs — Specifiche

### scheduler.ts

Registra i cron job all'avvio del servizio. Per ora crea solo:

1. **Cleanup log** — ogni giorno a mezzanotte: elimina le notifiche con status SENT più vecchie di 30 giorni. Le FAILED vengono mantenute per review.
2. **Channel sync backup** — ogni 6 ore: placeholder che logga "Channel sync backup triggered" (il sync vero lo farà il bot Discord che gestisco io).

### poll-external.ts

Template per il polling dei tool esterni. NON implementare l'integrazione vera con Plutio o Google Calendar, ma crea la struttura con commenti che spiegano dove andrà il codice. Deve includere:

- Una funzione `pollPlutio()` con body placeholder
- Una funzione `pollGoogleCalendar()` con body placeholder
- Uso del modello PollState per salvare l'ultimo check
- Registrazione nel scheduler (commentata, con frequenze consigliate nei commenti)

## Prisma Client Singleton

```typescript
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

## Entry Point (index.ts)

L'entry point deve:
1. Importare e configurare Express con `express.json()`
2. Montare il middleware auth (su tutte le route tranne /health)
3. Montare le route
4. Avviare il server sulla porta da env
5. Avviare lo scheduler
6. Gestire graceful shutdown (SIGTERM, SIGINT) chiudendo Prisma

## Validazione Input

Usa una validazione manuale leggera (niente Zod, niente Joi — per coerenza con le app esistenti che non li usano). Ogni route valida i campi obbligatori e ritorna 400 con messaggio chiaro se mancano.

Esempio:
```json
{
  "success": false,
  "error": "Missing required fields: target, message"
}
```

## Configurazione TypeScript

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Package.json — Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:studio": "prisma studio"
  }
}
```

Dipendenze da installare:
- **dependencies**: express, @prisma/client, node-cron
- **devDependencies**: typescript, @types/express, @types/node, @types/node-cron, prisma, tsx

## .gitignore

```
node_modules/
dist/
.env
*.db
```

## README.md

Crea un README conciso con:
- Descrizione del servizio (2-3 righe)
- Come installare (`npm install`, `npx prisma generate`)
- Come configurare (copiare .env.example in .env)
- Come avviare in dev (`npm run dev`)
- Come buildare (`npm run build && npm start`)
- Lista degli endpoint con metodo e path (senza dettagli — quelli sono nella doc)

## Ordine di Esecuzione

1. Inizializza il progetto (package.json, tsconfig, .gitignore)
2. Installa le dipendenze
3. Crea lo schema Prisma e genera il client
4. Crea config/env.ts e lib/prisma.ts
5. Crea il middleware auth
6. Crea discord.service.ts
7. Crea notification.service.ts
8. Crea le route (health, channels, notify)
9. Crea lo scheduler e i job template
10. Crea index.ts
11. Crea .env.example e README.md
12. Verifica che compili con `npm run build`

## Note Importanti

- Tutto il codice deve essere in TypeScript con tipi espliciti (niente `any` dove evitabile)
- I log devono usare `console.log` e `console.error` con prefisso `[NotificationHub]` per facile grep
- Le risposte API seguono sempre il formato `{ success: boolean, ... }`
- Gli errori non gestiti NON devono crashare il server — usa try/catch nei punti critici
- Il servizio deve partire anche se il database non è raggiungibile (graceful degradation)
